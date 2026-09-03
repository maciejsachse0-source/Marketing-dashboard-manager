/**
 * Generator fixture'a do importu osób: tests/fixtures/osoby.xlsx.
 *
 * Nagłówki i układ arkuszy są zdjęte 1:1 z prawdziwego skoroszytu usera
 * (issue F4-06), żeby test end-to-end sprawdzał ten sam kształt pliku, jaki
 * naprawdę wchodzi do importu. DANE są w całości wymyślone i generowane
 * deterministycznie z licznika: żadne prawdziwe imię, nazwisko, handle, email
 * ani telefon nie ma prawa trafić do tego pliku ani do repozytorium
 * (zasada z MASTER-PROMPT). Prawdziwy arkusz nie jest tu ani kopiowany,
 * ani czytany.
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

/** Nagłówki dokładnie z prawdziwego skoroszytu, z pustymi kolumnami włącznie. */
const NAGLOWKI_ARTYSCI = [
  'Imię', 'Instagram', 'E-mail', 'W trakcie', 'Link', 'Lokalizacja', 'Status', 'Od kogo',
  'Plan/Data', 'Polecenia?', 'Wrócić?', 'Czyj ruch?', 'Etap produkcji', 'Kamerzysta',
  'Data nagrywek', 'Materiały otrzymane', 'Ostatni kontakt', 'Notatki', 'Prio', 'Status2',
  'Status3', '_StatusRank', '', '', 'Legenda — Etap produkcji', '', '', '🔄 SORTUJ TABELĘ',
];
const NAGLOWKI_KAMERZYSCI = [
  'Imię', 'Instagram', 'Status', 'Lokalizacja', 'Cena', 'Plan/Data', 'Czyj ruch?', 'Notatki',
  'Prio', 'Legenda statusów', 'Column1', '',
];
const NAGLOWKI_ARKUSZ1 = ['Imię i nazwisko', 'Miasto', 'Instagram', 'Nr telefonu', 'Notatka'];
const NAGLOWKI_SZABLONY = ['Kategoria', 'Nazwa szablonu', 'Treść do skopiowania'];
const NAGLOWKI_WERYFIKACJA = ['Wiersz', 'Aktualne imię', 'Instagram', 'E-mail', 'Propozycja', 'Werdykt'];

type Wiersz = (string | number | null)[];

function osoba(i: number) {
  const imie = IMIONA[i % IMIONA.length];
  const nazwisko = NAZWISKA[i % NAZWISKA.length];
  const numer = String(i).padStart(4, '0');
  return {
    name: `${imie} ${nazwisko} ${numer}`,
    handle: `atrapa_${numer}`,
    email: `atrapa${numer}@przyklad.test`,
    phone: `+48 500 ${numer.slice(0, 2)} ${numer.slice(2)}${i % 10}`,
    location: MIASTA[i % MIASTA.length],
    status: STATUSY[i % STATUSY.length],
    notes: i % 7 === 0 ? `notatka syntetyczna ${numer}` : '',
  };
}

/** Wiersz o długości arkusza, wypełniony tylko pod wskazanymi indeksami. */
function wiersz(dlugosc: number, komorki: Record<number, string>): Wiersz {
  const out: Wiersz = Array.from({ length: dlugosc }, () => null);
  for (const [index, value] of Object.entries(komorki)) out[Number(index)] = value;
  return out;
}

/** Kolumny arkusza artystów, których dotyka import. */
function artysta(o: ReturnType<typeof osoba>, nadpisz: Partial<Record<string, string>> = {}): Wiersz {
  return wiersz(NAGLOWKI_ARTYSCI.length, {
    0: nadpisz.name ?? o.name,
    1: nadpisz.handle ?? o.handle,
    2: nadpisz.email ?? o.email,
    5: nadpisz.location ?? o.location,
    6: nadpisz.status ?? o.status,
    17: nadpisz.notes ?? o.notes,
  });
}

/** 1000 wierszy: poprawne, błędne, puste i duplikaty w obrębie pliku. */
function wierszeArtystow(): Wiersz[] {
  const rows: Wiersz[] = [];
  for (let i = 1; i <= 960; i += 1) rows.push(artysta(osoba(i)));

  // Wiersze błędne: bez nazwy (prawdziwy arkusz ma takie osoby, znane tylko
  // z Instagrama) oraz zły email.
  for (let i = 0; i < 10; i += 1) {
    rows.push(artysta(osoba(9000 + i), { name: '', notes: 'wiersz bez nazwy' }));
    rows.push(
      artysta(osoba(9100 + i), { email: `zly-email-${i}.przyklad.test`, notes: 'zły email' }),
    );
  }

  // Wiersze puste, pomijane bez błędu.
  // Komórki puste, nie brak komórek: wiersz bez ani jednej wartości ExcelJS
  // pomija przy zapisie, a chodzi o to, żeby import go zobaczył i pominął sam.
  for (let i = 0; i < 5; i += 1) {
    rows.push(wiersz(NAGLOWKI_ARTYSCI.length, { 0: '', 1: '', 2: '', 5: '', 6: '', 17: '' }));
  }

  // Duplikaty w obrębie pliku: ten sam handle, ten sam email, ta sama nazwa
  // z lokalizacją. Wszystkie trzy występują też w prawdziwym arkuszu.
  for (let i = 1; i <= 5; i += 1) {
    const o = osoba(i);
    rows.push(artysta(o, { name: `${o.name} (kopia)`, email: '', notes: 'duplikat po handle' }));
    rows.push(artysta(o, { name: `${o.name} (kopia 2)`, handle: '', notes: 'duplikat po emailu' }));
    rows.push(artysta(o, { handle: `inny_${i}`, email: '', notes: 'duplikat prawdopodobny' }));
  }

  return rows;
}

function wierszeKamerzystow(): Wiersz[] {
  const rows: Wiersz[] = [];
  const kamerzysta = (o: ReturnType<typeof osoba>, nadpisz: Record<string, string> = {}) =>
    wiersz(NAGLOWKI_KAMERZYSCI.length, {
      0: nadpisz.name ?? o.name,
      1: nadpisz.handle ?? o.handle,
      2: o.status,
      3: o.location,
      7: nadpisz.notes ?? o.notes,
    });

  for (let i = 1; i <= 120; i += 1) rows.push(kamerzysta(osoba(i + 5000)));
  const o = osoba(5001);
  rows.push(kamerzysta(o, { name: `${o.name} (kopia)`, notes: 'duplikat po handle' }));
  return rows;
}

/** Mały arkusz z innym zestawem nagłówków: imię z nazwiskiem i telefon. */
function wierszeArkusza1(): Wiersz[] {
  const rows: Wiersz[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const o = osoba(i + 7000);
    rows.push([o.name, o.location, o.handle, o.phone, o.notes]);
  }
  for (let i = 0; i < 10; i += 1) {
    const o = osoba(i + 7100);
    rows.push([o.name, o.location, o.handle, `12 34 5${i}`, 'zły telefon']);
  }
  return rows;
}

async function main() {
  const workbook = new ExcelJS.Workbook();

  // Kolejność arkuszy jak w prawdziwym skoroszycie.
  const kamerzysci = workbook.addWorksheet('Kamerzyści');
  kamerzysci.addRow(NAGLOWKI_KAMERZYSCI);
  for (const row of wierszeKamerzystow()) kamerzysci.addRow(row);

  const arkusz1 = workbook.addWorksheet('Arkusz1');
  arkusz1.addRow(NAGLOWKI_ARKUSZ1);
  for (const row of wierszeArkusza1()) arkusz1.addRow(row);

  const artysci = workbook.addWorksheet('Artyści');
  artysci.addRow(NAGLOWKI_ARTYSCI);
  for (const row of wierszeArtystow()) artysci.addRow(row);

  // Arkusze pomocnicze skoroszytu: w fixture zostają same nagłówki, bo to nie
  // są osoby. „Szablony" sprawdza przy okazji stan pusty ekranu importu.
  workbook.addWorksheet('Szablony').addRow(NAGLOWKI_SZABLONY);
  workbook.addWorksheet('Do weryfikacji').addRow(NAGLOWKI_WERYFIKACJA);

  await mkdir(path.dirname(OUT), { recursive: true });
  await workbook.xlsx.writeFile(OUT);

  const dane = wierszeArtystow().length + wierszeKamerzystow().length + wierszeArkusza1().length;
  console.log(`[fixture] ${OUT}: 5 arkuszy, ${dane} wierszy danych`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
