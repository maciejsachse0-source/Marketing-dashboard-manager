/**
 * Generator fixture'a do importu osób: tests/fixtures/osoby.xlsx.
 *
 * Wszystkie dane są syntetyczne i wygenerowane deterministycznie z licznika.
 * Żadne prawdziwe imię, nazwisko, handle, email ani telefon nie ma prawa
 * trafić do tego pliku ani do repozytorium (zasada z MASTER-PROMPT).
 *
 * Uruchomienie: npx tsx scripts/make-fixture-xlsx.ts
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';

const OUT = path.join(process.cwd(), 'tests', 'fixtures', 'osoby.xlsx');

const IMIONA = ['Ala', 'Bea', 'Cyla', 'Dena', 'Ewa', 'Fela', 'Gaja', 'Hela', 'Iga', 'Jaga'];
const NAZWISKA = ['Przykładowa', 'Testowa', 'Atrapowa', 'Makietowa', 'Wzorcowa'];
const MIASTA = ['Warszawa', 'Kraków', 'Poznań', 'trojmiasto', 'Wrocław', 'tricity'];
const STATUSY = ['wolny od marca', 'zajęty do czerwca', 'tylko weekendy', ''];

function osoba(i: number) {
  const imie = IMIONA[i % IMIONA.length];
  const nazwisko = NAZWISKA[i % NAZWISKA.length];
  const numer = String(i).padStart(4, '0');
  return {
    name: `${imie} ${nazwisko} ${numer}`,
    handle: `@atrapa_${numer}`,
    email: `atrapa${numer}@przyklad.test`,
    phone: `+48 500 ${numer.slice(0, 2)} ${numer.slice(2)}${i % 10}`,
    location: MIASTA[i % MIASTA.length],
    status: STATUSY[i % STATUSY.length],
    notes: i % 7 === 0 ? `notatka syntetyczna ${numer}` : '',
  };
}

type Wiersz = (string | number | null)[];

/** 1000 wierszy danych: poprawne, błędne i duplikaty. */
function wierszeTworcow(): Wiersz[] {
  const rows: Wiersz[] = [];
  for (let i = 1; i <= 960; i += 1) {
    const o = osoba(i);
    rows.push([o.name, o.handle, o.email, o.phone, o.location, o.notes]);
  }

  // Wiersze błędne: bez nazwy, zły email, zły telefon, komórka pusta w środku.
  for (let i = 0; i < 10; i += 1) {
    rows.push(['', `@bez_nazwy_${i}`, '', '', 'Warszawa', 'wiersz bez nazwy']);
    rows.push([`Ala Testowa 9${i}0`, '', `zly-email-${i}.przyklad.test`, '', '', 'zły email']);
    rows.push([`Bea Wzorcowa 9${i}1`, '', '', `12 34 5${i}`, '', 'zły telefon']);
  }

  // Wiersze puste, pomijane bez błędu.
  for (let i = 0; i < 5; i += 1) rows.push(['', '', '', '', '', '']);

  // Duplikaty pewne (ten sam handle, potem ten sam email) i prawdopodobne
  // (ta sama nazwa i lokalizacja, inny handle).
  for (let i = 1; i <= 5; i += 1) {
    const o = osoba(i);
    rows.push([`${o.name} (kopia)`, o.handle, '', '', o.location, 'duplikat po handle']);
    rows.push([`${o.name} (kopia 2)`, '', o.email, '', o.location, 'duplikat po emailu']);
    rows.push([o.name, `@inny_${i}`, '', '', o.location, 'duplikat prawdopodobny']);
  }

  return rows;
}

function wierszeKamerzystow(): Wiersz[] {
  const rows: Wiersz[] = [];
  for (let i = 1; i <= 120; i += 1) {
    const o = osoba(i + 5000);
    rows.push([o.name, o.handle, o.email, o.phone, o.location, o.status, o.notes]);
  }
  // Duplikat pewny wewnątrz arkusza kamerzystów.
  const o = osoba(5001);
  rows.push([`${o.name} (kopia)`, o.handle, '', '', o.location, '', 'duplikat po handle']);
  return rows;
}

async function main() {
  const workbook = new ExcelJS.Workbook();

  // Nagłówki celowo w różnych aliasach z plan/04 sekcja 4.
  const tworcy = workbook.addWorksheet('Twórcy');
  tworcy.addRow(['Imię', 'Instagram', 'E-mail', 'Telefon', 'Miasto', 'Uwagi']);
  for (const row of wierszeTworcow()) tworcy.addRow(row);

  const kamerzysci = workbook.addWorksheet('Kamerzyści');
  kamerzysci.addRow(['Osoba', 'Nick', 'Mail', 'Numer', 'Region', 'Dostępność', 'Notatki']);
  for (const row of wierszeKamerzystow()) kamerzysci.addRow(row);

  // Arkusz z samym nagłówkiem: sprawdza stan pusty ekranu importu.
  const pusty = workbook.addWorksheet('Pusty');
  pusty.addRow(['Imię', 'Instagram']);

  await mkdir(path.dirname(OUT), { recursive: true });
  await workbook.xlsx.writeFile(OUT);

  const dane = wierszeTworcow().length + wierszeKamerzystow().length;
  console.log(`[fixture] ${OUT}: 3 arkusze, ${dane} wierszy danych`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
