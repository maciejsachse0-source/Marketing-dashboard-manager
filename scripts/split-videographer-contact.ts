/**
 * Jednorazowe rozdzielenie `videographers.contact` na `handle`, `email` i `phone`
 * (znalezisko F7-19). Migracja 0003 dołożyła kolumny, ale była wyłącznie addytywna:
 * stare pole nadal trzyma wymieszaną treść, więc ekran kamerzystów czyta jedno pole,
 * a import zapisuje do drugiego.
 *
 * Reguły rozpoznawania są JEDNE — te z `normalizeRow` w `src/lib/import/normalize.ts`.
 * Skrypt tylko decyduje, do którego pola wrzucić surową treść, i pyta normalizator,
 * czy się nadaje. Kształt nierozpoznany zostaje w `contact` nietknięty; zgadywanie
 * jest gorsze niż wiersz na liście do ręcznego przejrzenia.
 *
 * Odwracalność: przebieg zapisujący NIE kasuje `contact`. Wypełnia tylko puste pola
 * docelowe, więc dane sprzed migracji zostają na miejscu i cofnięcie to wyzerowanie
 * kolumn docelowych. Czyszczenie `contact` to osobne, jawne uruchomienie z flagą.
 *
 * Uruchomienie (DATABASE_URL musi być w środowisku, patrz F7-30):
 *   set -a; . ./.env.local; set +a
 *   npx tsx scripts/split-videographer-contact.ts            # sucha próba, nic nie pisze
 *   npx tsx scripts/split-videographer-contact.ts --apply    # zapis do handle/email/phone
 *   npx tsx scripts/split-videographer-contact.ts --apply --clear-contact
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, inArray, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';
import { contactField, normalizeRow } from '../src/lib/import/normalize';

type Wynik =
  | { kind: 'ok'; pole: 'email' | 'phone' | 'handle'; wartosc: string }
  /** Treść jest już w kolumnie docelowej, ten sam przebieg albo wcześniejszy. */
  | { kind: 'juz'; pole: 'email' | 'phone' | 'handle'; wartosc: string }
  | { kind: 'pomin'; powod: string };

type Wiersz = { handle: string | null; email: string | null; phone: string | null };

/** Jeden wiersz: gdzie trafia treść i czy normalizator ją przyjmuje. */
function rozdziel(surowy: string, name: string, w: Wiersz): Wynik {
  const pole = contactField(surowy);
  if (pole === null) return { kind: 'pomin', powod: 'nieznany kształt' };

  // Jedne reguły: normalizator dostaje wiersz w kształcie arkusza importu.
  const wynik = normalizeRow({ name, [pole]: surowy }, 'videographer');
  if (wynik.kind === 'error') return { kind: 'pomin', powod: wynik.errors.join(', ') };
  const wartosc = wynik.kind === 'ok' ? wynik.person[pole] : null;
  if (wartosc === null) return { kind: 'pomin', powod: 'normalizator zwrócił pustkę' };

  const obecna = w[pole];
  if (obecna !== null && obecna !== '') {
    // Ta sama treść w kolumnie docelowej znaczy, że przeniesienie już było —
    // taki wiersz wolno wyczyścić. Inna treść to konflikt: nie ruszamy niczego.
    return obecna === wartosc
      ? { kind: 'juz', pole, wartosc }
      : { kind: 'pomin', powod: `${pole} ma już inną wartość: ${obecna}` };
  }
  return { kind: 'ok', pole, wartosc };
}

type Baza = ReturnType<typeof drizzle<typeof schema>>;

async function przetworz(db: Baza, apply: boolean) {
  const wiersze = await db
    .select()
    .from(schema.videographers)
    .where(sql`coalesce(${schema.videographers.contact}, '') <> ''`);

  const liczniki = { handle: 0, email: 0, phone: 0, nierozpoznane: 0, juz: 0, konflikt: 0 };
  const doPrzejrzenia: { id: number; name: string; contact: string; powod: string }[] = [];
  const przeniesione: number[] = [];

  for (const w of wiersze) {
    const surowy = w.contact!.trim();
    const wynik = rozdziel(surowy, w.name, w);
    if (wynik.kind === 'pomin') {
      if (wynik.powod.startsWith('nieznany')) liczniki.nierozpoznane += 1;
      else liczniki.konflikt += 1;
      doPrzejrzenia.push({ id: w.id, name: w.name, contact: surowy, powod: wynik.powod });
      continue;
    }
    if (wynik.kind === 'juz') {
      liczniki.juz += 1;
      przeniesione.push(w.id);
      continue;
    }
    liczniki[wynik.pole] += 1;
    przeniesione.push(w.id);
    if (apply) {
      await db
        .update(schema.videographers)
        .set({ [wynik.pole]: wynik.wartosc })
        .where(eq(schema.videographers.id, w.id));
    }
  }

  return { wszystkie: wiersze.length, liczniki, doPrzejrzenia, przeniesione };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL nie jest ustawiony');
  const apply = process.argv.includes('--apply');
  const clear = process.argv.includes('--clear-contact');
  if (clear && !apply) throw new Error('--clear-contact ma sens tylko razem z --apply');

  const sqlClient = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sqlClient, { schema });
  const { wszystkie, liczniki, doPrzejrzenia, przeniesione } = await przetworz(db, apply);

  // Kasujemy TYLKO te wiersze, których treść ten przebieg naprawdę przeniósł.
  // Wiersz nierozpoznany albo pominięty zostaje z `contact` nietkniętym.
  if (clear && przeniesione.length > 0) {
    await db
      .update(schema.videographers)
      .set({ contact: null })
      .where(inArray(schema.videographers.id, przeniesione));
  }

  const tryb = apply ? (clear ? 'zapis + czyszczenie contact' : 'zapis') : 'sucha próba';
  console.log(`baza: ${new URL(url).pathname.slice(1)}, tryb: ${tryb}`);
  console.log(`wierszy z niepustym contact: ${wszystkie}`);
  console.log(`  handle: ${liczniki.handle}`);
  console.log(`  email: ${liczniki.email}`);
  console.log(`  phone: ${liczniki.phone}`);
  console.log(`  już przeniesione wcześniej: ${liczniki.juz}`);
  console.log(`  konflikt, pole docelowe ma inną treść: ${liczniki.konflikt}`);
  console.log(`  nierozpoznane, zostają w contact: ${liczniki.nierozpoznane}`);
  if (doPrzejrzenia.length > 0) {
    console.log('\ndo ręcznego przejrzenia:');
    for (const r of doPrzejrzenia) console.log(`  #${r.id} ${r.name}: "${r.contact}" (${r.powod})`);
  }

  await sqlClient.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
