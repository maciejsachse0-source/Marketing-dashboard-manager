/**
 * Zapis planu importu (plan/04 sekcja 2, krok 6). Wszystko w jednej transakcji,
 * wstawki paczkami po 100 wierszy. Przerwanie w dowolnym miejscu wycofuje całość,
 * bo połowa zaimportowanej listy osób jest gorsza niż brak importu.
 * Import nigdy nie usuwa osób nieobecnych w arkuszu (plan/04 sekcja 7).
 */
import { eq } from 'drizzle-orm';
import { artists, videographers } from '../../../drizzle/schema';
import type { db } from '@/lib/db';
import type { PlannedRow } from './dry-run';
import type { NormalizedPerson, PersonRole } from './normalize';

export const BATCH_SIZE = 100;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type SaveCounts = { inserted: number; updated: number; skipped: number };

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function insertValues(person: NormalizedPerson, role: PersonRole) {
  const base = {
    name: person.name,
    handle: person.handle,
    email: person.email,
    phone: person.phone,
    location: person.location,
    notes: person.notes,
  };
  // Tabela `artists` nie ma kolumny `status`, normalizacja i tak zwraca tam null.
  return role === 'artist' ? base : { ...base, status: person.status };
}

/**
 * @param onBatch wołane po każdej zapisanej paczce, do licznika postępu.
 *   Licznik pokazuje paczki faktycznie zapisane, nie zgadywane (plan/04 sekcja 7).
 */
export async function savePlans(
  tx: Tx,
  role: PersonRole,
  plans: readonly PlannedRow[],
  onBatch?: (done: number, total: number) => void,
): Promise<SaveCounts> {
  const table = role === 'artist' ? artists : videographers;

  const inserts = plans.filter((row) => row.plan.action === 'insert');
  // Duplikat pewny, w którym arkusz nie wnosi żadnej nowej wartości, ma pusty
  // zestaw zmian. `set({})` wywraca całą transakcję („No values to set"), a i tak
  // nie byłoby czego zapisać, więc taki wiersz liczy się jako pominięty.
  const updates = plans.filter(
    (row) => row.plan.action === 'update' && Object.keys(row.plan.changes).length > 0,
  );
  const skipped = plans.length - inserts.length - updates.length;

  const insertBatches = chunk(inserts, BATCH_SIZE);
  const updateBatches = chunk(updates, BATCH_SIZE);
  const total = insertBatches.length + updateBatches.length;
  let done = 0;
  // Zerowa paczka: przeglądarka poznaje liczbę paczek, zanim poleci pierwszy
  // zapis, więc licznik nigdy nie pokazuje „0 z 0" ani zmyślonego postępu.
  onBatch?.(done, total);

  for (const batch of insertBatches) {
    await tx.insert(table).values(batch.map((row) => insertValues(row.person, role)));
    done += 1;
    onBatch?.(done, total);
  }

  for (const batch of updateBatches) {
    for (const row of batch) {
      if (row.plan.action !== 'update') continue;
      await tx.update(table).set(row.plan.changes).where(eq(table.id, row.plan.id));
    }
    done += 1;
    onBatch?.(done, total);
  }

  return { inserted: inserts.length, updated: updates.length, skipped };
}
