/**
 * One-shot import of people from Google Sheet
 * https://docs.google.com/spreadsheets/d/1Ylfyo69nVDn_dRF0GPhu5uz6K1P0V_SSRsPZfd1kDDY
 *
 * Two columns:
 *   - Kamerzyści (videographers): imie, Insta, status, lokalizacja
 *   - Artyści (artists): imie, insta, lokalizacja, status (always empty)
 *
 * Dedup by handle (artists) / contact (videographers). Skips inserts when
 * a row with the same insta handle already exists.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { db, schema } from '../src/lib/db';

type VRow = { name: string; insta: string; status?: string; location?: string };
type ARow = { name: string; insta?: string; location?: string };

const videographers: VRow[] = [
  { name: 'mati',    insta: '@noyasnee',           status: 'cena',                  location: 'trojmiasto' },
  { name: 'Gosia',   insta: '@arcovidia',          status: 'wyjeżdża',              location: 'trójmiasto' },
  { name: 'Maria',   insta: '@mariabendykowska',   status: 'chętna',                location: 'warszawa' },
  { name: 'Jan',     insta: '@janojumper777',      status: 'chętna',                location: 'warszawa' },
  { name: 'Róża',    insta: '@rozawykland',        status: 'chętna',                location: 'łódź' },
  { name: 'Matylda', insta: '@matyldanizegorodcew', status: 'chętna',               location: 'warszawa' },
  { name: 'Nina',    insta: '@nina.jjjiiijjj',     status: 'cena może być za niska', location: 'warszawa' },
  { name: 'Maja',    insta: '@maja.dybuk',         status: 'wyjechana',             location: 'trójmiasto' },
  { name: 'Emil',    insta: '@kuduatv',            status: 'chętny',                location: 'toruń' },
  { name: 'zbojk',   insta: '@zbojk',              status: 'cena',                  location: 'tricity' },
  { name: 'pawelcuper', insta: '@pawelcuper',      status: 'chętny',                location: 'tricity' },
  { name: 'Tyna',    insta: '@r.u.tyna',           status: 'chętna',                location: 'tricity' },
  { name: 'zurobarb', insta: '@zurobarb',          status: 'chętna',                location: 'tricity' },
];

const artists: ARow[] = [
  { name: 'Weronika',  insta: '@akku.wav',                   location: 'wrocław' },
  { name: 'Szymon',    insta: '@szymekumi',                  location: 'warszawa' },
  { name: 'Paweł',     insta: '@niesukcesy',                 location: 'warszawa' },
  { name: 'Mela',      insta: '@melatyszka',                 location: 'warszawa' },
  { name: 'Sandra',    insta: '@londa_blond_',               location: 'trójmiasto' },
  { name: 'Maria',     insta: '@maria_lisicka' },
  { name: 'Michał',    insta: '@mihunos',                    location: 'gdańsk' },
  { name: 'Dasza',     insta: '@dariavoicel',                location: 'trójmiasto' },
  { name: 'Maks',      insta: '@makskaoo',                   location: 'trójmiasto' },
  { name: 'Michał',    insta: '@szydelko.tatu',              location: 'trójmiasto' },
  { name: 'Vincent',   insta: '@vins.wrz',                   location: 'trójmiasto' },
  { name: 'Paweł',     insta: '@ponchee.193',                location: 'trójmiasto' },
  { name: 'Fauna',     insta: '@fauna_excrement',            location: 'kraków' },
  { name: 'Kinga',     insta: '@zieminksa' },
  { name: 'Paula',     insta: '@paulachran' },
  { name: 'Zosia',     insta: '@flisofia',                   location: 'trójmiasto' },
  { name: 'Magda',     insta: '@magdalena.rzepecka',         location: 'trójmiasto' },
  { name: 'Ola',       insta: '@ola.marchewka',              location: 'trójmiasto' },
  { name: 'Szatrycja', insta: '@szatrycja_pymczak',          location: 'trójmiasto' },
  { name: 'Eryk',      insta: '@samololot',                  location: 'warszawa' },
  { name: 'Zosia',     insta: '@mierzejewskaz',              location: 'warszawa' },
  { name: 'Ola',       insta: '@croshetetti',                location: 'warszawa' },
  { name: 'Awa',       insta: '@_h_awwwa',                   location: 'warszawa' },
  { name: 'Tadeusz',   insta: '@tblajer',                    location: 'warszawa' },
  { name: 'Ania',      insta: '@ania.falk',                  location: 'warszawa' },
  { name: 'Olga',      insta: '@olgaszzz',                   location: 'warszawa' },
  { name: 'Sonya',     insta: '@sonya_90e_',                 location: 'warszawa' },
  { name: 'Lucy',      insta: '@ludzka.lucka',               location: 'warszawa' },
  { name: 'Maria',     insta: '@marludzka',                  location: 'antwerpia' },
  { name: 'Filip',     insta: '@fifi_matwi',                 location: 'warszawa' },
  { name: 'Antoni',    insta: '@pilat_anto',                 location: 'warszawa' },
  { name: 'Antek',     insta: '@tonybzl',                    location: 'trójmiasto' },
  { name: 'Marta',     insta: '@skuzastudio',                location: 'warszawa' },
  { name: 'Szymon',    insta: '@szymonsobieski',             location: 'warszawa' },
  { name: 'Robert',    insta: '@baggyfingers',               location: 'warszawa' },
  { name: 'Mateusz',   insta: '@mateusz.mozejko',            location: 'warszawa' },
  { name: 'Zuzia',     insta: '@biuro_rzeczy_zagubionych',   location: 'warszawa' },
  { name: 'Ola',       insta: '@docalypso',                  location: 'łódź' },
  { name: 'Aniela',    insta: '@aniela.radtke' },
  { name: 'Kasia',     insta: '@aila_quynh',                 location: 'warszawa' },
  { name: 'Agata',     insta: '@skielkoska',                 location: 'warszawa' },
  { name: 'Bogna',     insta: '@klamantarnowska',            location: 'trójmiasto' },
  { name: 'Mati',      insta: '@matiszczanowicz',            location: 'warszawa' },
  { name: 'Dominika',  insta: '@nvrsp',                      location: 'trójmiasto' },
  { name: 'Marta',     insta: '@martvjakim',                 location: 'trójmiasto' },
  { name: 'Tosia',     insta: '@_guura_',                    location: 'trójmiasto' },
  { name: 'Zosia',     insta: '@zozdanowicz',                location: 'haga/warszawa' },
];

function buildVideographerNotes(r: VRow): string | null {
  const parts: string[] = [];
  if (r.location) parts.push(`Lokalizacja: ${r.location}`);
  return parts.length ? parts.join(' · ') : null;
}

function buildArtistNotes(r: ARow): string | null {
  return r.location ? `Lokalizacja: ${r.location}` : null;
}

async function main() {
  const existingArtists = await db.query.artists.findMany({
    columns: { id: true, name: true, handle: true },
  });
  const existingVideos = await db.query.videographers.findMany({
    columns: { id: true, name: true, contact: true },
  });

  const artistHandles = new Set(
    existingArtists
      .map((a) => (a.handle ?? '').trim().toLowerCase())
      .filter(Boolean),
  );
  const videoContacts = new Set(
    existingVideos
      .map((v) => (v.contact ?? '').trim().toLowerCase())
      .filter(Boolean),
  );

  let vInserted = 0;
  let vSkipped = 0;
  for (const r of videographers) {
    const key = r.insta.trim().toLowerCase();
    if (videoContacts.has(key)) {
      vSkipped++;
      continue;
    }
    await db.insert(schema.videographers).values({
      name: r.name,
      contact: r.insta,
      availabilityNotes: r.status ?? null,
      notes: buildVideographerNotes(r),
    });
    vInserted++;
    videoContacts.add(key);
  }

  let aInserted = 0;
  let aSkipped = 0;
  for (const r of artists) {
    const key = (r.insta ?? '').trim().toLowerCase();
    if (key && artistHandles.has(key)) {
      aSkipped++;
      continue;
    }
    await db.insert(schema.artists).values({
      name: r.name,
      handle: r.insta ?? null,
      notes: buildArtistNotes(r),
    });
    aInserted++;
    if (key) artistHandles.add(key);
  }

  console.log(`Videographers: ${vInserted} inserted, ${vSkipped} skipped (already existed)`);
  console.log(`Artists:       ${aInserted} inserted, ${aSkipped} skipped (already existed)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
