// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parseWorkbook, checkFile, IMPORT_LIMITS } from './parse';
import { autoMap, mappingConflicts, toRawRow, FIELD_ALIASES, PERSON_FIELDS, type PersonField } from './mapping';
import { normalizeRow } from './normalize';

const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'osoby.xlsx');

async function fixtureSheets() {
  const data = await readFile(FIXTURE);
  const result = await parseWorkbook('osoby.xlsx', data);
  if (!result.ok) throw new Error(result.message);
  return result.sheets;
}

describe('parseWorkbook - fixture', () => {
  it('czyta wszystkie arkusze i ponad 1000 wierszy danych', async () => {
    const sheets = await fixtureSheets();
    expect(sheets.map((s) => s.name)).toEqual(['Twórcy', 'Kamerzyści', 'Pusty']);
    const rows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
    expect(rows).toBeGreaterThanOrEqual(1000);
  });

  it('nagłówki fixture mapują się automatycznie na wszystkie pola roli', async () => {
    const [tworcy, kamerzysci] = await fixtureSheets();
    expect(autoMap(tworcy.headers, 'artist')).toEqual(['name', 'handle', 'email', 'phone', 'location', 'notes']);
    expect(autoMap(kamerzysci.headers, 'videographer')).toEqual([
      'name',
      'handle',
      'email',
      'phone',
      'location',
      'status',
      'notes',
    ]);
  });

  it('fixture zawiera wiersze błędne, puste i duplikaty', async () => {
    const [tworcy] = await fixtureSheets();
    const mapping = autoMap(tworcy.headers, 'artist');
    const wyniki = tworcy.rows.map((cells) => normalizeRow(toRawRow(cells, mapping), 'artist'));
    expect(wyniki.filter((w) => w.kind === 'error').length).toBeGreaterThan(0);
    expect(wyniki.filter((w) => w.kind === 'empty').length).toBeGreaterThan(0);
    const handles = wyniki.flatMap((w) => (w.kind === 'ok' && w.person.handle ? [w.person.handle] : []));
    expect(new Set(handles).size).toBeLessThan(handles.length);
  });
});

describe('autoMap - aliasy z plan/04 sekcja 4', () => {
  it.each(PERSON_FIELDS.flatMap((field) => FIELD_ALIASES[field].map((alias) => [alias, field] as const)))(
    'nagłówek %s trafia do pola %s',
    (alias, field) => {
      expect(autoMap([alias], 'videographer')[0]).toBe(field);
    },
  );

  it('nagłówek bez dopasowania jest pomijany', () => {
    expect(autoMap(['kolumna techniczna'], 'artist')[0]).toBeNull();
  });

  it('status nie jest proponowany dla roli twórcy', () => {
    expect(autoMap(['Status'], 'artist')[0]).toBeNull();
  });

  it('to samo pole zmapowane dwa razy to konflikt', () => {
    expect(mappingConflicts(['name', 'name', 'email'] as PersonField[])).toEqual(['name']);
  });
});

describe('parseWorkbook - odrzucenia', () => {
  it('inne rozszerzenie niż xlsx jest odrzucone bez czytania pliku', async () => {
    const result = await parseWorkbook('osoby.csv', Buffer.from('cokolwiek'));
    expect(result).toEqual({ ok: false, message: 'Ten format nie jest obsługiwany. Wgraj plik xlsx' });
  });

  it('plik powyżej 10 MB jest odrzucony z podaniem rozmiaru i limitu', () => {
    const result = checkFile('osoby.xlsx', IMPORT_LIMITS.maxBytes + 1024 * 1024);
    expect(result).toEqual({ ok: false, message: 'Plik ma 11,0 MB, a limit to 10,0 MB' });
  });

  it('arkusz powyżej 5000 wierszy jest odrzucony', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Duży');
    sheet.addRow(['Imię']);
    for (let i = 0; i < IMPORT_LIMITS.maxRows + 1; i += 1) sheet.addRow([`Ala Testowa ${i}`]);
    const buffer = await workbook.xlsx.writeBuffer();

    const result = await parseWorkbook('duzy.xlsx', buffer as unknown as Buffer);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('limit to 5000');
  });
});

describe('parseWorkbook - arkusz bez danych', () => {
  it('arkusz z samym nagłówkiem daje zero wierszy, nie błąd', async () => {
    const sheets = await fixtureSheets();
    const pusty = sheets.find((s) => s.name === 'Pusty');
    expect(pusty?.rows).toEqual([]);
  });
});
