// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parseWorkbook, checkFile, megabytes, IMPORT_LIMITS } from './parse';
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
    // Nazwy i kolejność arkuszy jak w prawdziwym skoroszycie (F4-06).
    expect(sheets.map((s) => s.name)).toEqual([
      'Kamerzyści',
      'Arkusz1',
      'Artyści',
      'Szablony',
      'Do weryfikacji',
    ]);
    const rows = sheets.reduce((sum, s) => sum + s.rows.length, 0);
    expect(rows).toBeGreaterThanOrEqual(1000);
  });

  it('nagłówki fixture mapują się automatycznie, bez ręcznego przestawiania', async () => {
    const [kamerzysci, arkusz1, artysci] = await fixtureSheets();
    // Prawdziwe nagłówki: reszta kolumn nie ma odpowiednika w bazie i zostaje pomijana.
    expect(autoMap(artysci.headers, 'artist').filter(Boolean)).toEqual([
      'name',
      'handle',
      'email',
      'location',
      'notes',
    ]);
    expect(autoMap(kamerzysci.headers, 'videographer').filter(Boolean)).toEqual([
      'name',
      'handle',
      'status',
      'location',
      'notes',
    ]);
    // Arkusz z nagłówkami „Imię i nazwisko", „Nr telefonu" i „Notatka".
    expect(autoMap(arkusz1.headers, 'artist').filter(Boolean)).toEqual([
      'name',
      'location',
      'handle',
      'phone',
      'notes',
    ]);
  });

  it('fixture zawiera wiersze błędne, puste i duplikaty', async () => {
    const [, , artysci] = await fixtureSheets();
    const mapping = autoMap(artysci.headers, 'artist');
    const wyniki = artysci.rows.map((cells) => normalizeRow(toRawRow(cells, mapping), 'artist'));
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
    const pusty = sheets.find((s) => s.name === 'Szablony');
    expect(pusty?.rows).toEqual([]);
  });
});

describe('checkFile i megabytes - sprawdzenie pliku bez otwierania go', () => {
  it('inne rozszerzenie niż xlsx jest odrzucone niezależnie od wielkości liter', () => {
    expect(checkFile('osoby.csv', 10).ok).toBe(false);
    expect(checkFile('OSOBY.XLSX', 10).ok).toBe(true);
  });

  it('plik w limicie przechodzi, a komunikat o przekroczeniu podaje rozmiar po polsku', () => {
    expect(checkFile('osoby.xlsx', IMPORT_LIMITS.maxBytes).ok).toBe(true);
    const over = checkFile('osoby.xlsx', 12 * 1024 * 1024);
    expect(over.ok === false && over.message).toBe('Plik ma 12,0 MB, a limit to 10,0 MB');
  });

  it('megabytes zaokrągla do jednego miejsca i używa przecinka', () => {
    expect(megabytes(1_572_864)).toBe('1,5');
  });
});
