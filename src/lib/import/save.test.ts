// @vitest-environment node
/**
 * Testy zapisu chodzą po prawdziwym Postgresie (TEST_DATABASE_URL, baza
 * marketing_test), bo transakcji i wycofania nie da się udowodnić na atrapie.
 */
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../../drizzle/schema';
import { savePlans, BATCH_SIZE } from './save';
import type { PlannedRow } from './dry-run';

config({ path: '.env.local', quiet: true });

const client = postgres(process.env.TEST_DATABASE_URL!, { prepare: false, max: 2 });
const db = drizzle(client, { schema });

function osoba(i: number): PlannedRow {
  const numer = String(i).padStart(4, '0');
  return {
    line: i + 1,
    person: {
      name: `Atrapa Testowa ${numer}`,
      handle: `@atrapa_zapis_${numer}`,
      email: `zapis${numer}@przyklad.test`,
      phone: null,
      location: 'Warszawa',
      status: null,
      notes: null,
    },
    plan: { action: 'insert' },
  };
}

async function ile(): Promise<number> {
  const [row] = await client`select count(*)::int as n from artists`;
  return row.n as number;
}

beforeEach(async () => {
  await client`delete from artists`;
});

afterAll(async () => {
  await client`delete from artists`;
  await client.end();
});

describe('savePlans', () => {
  it('wstawia paczkami po 100 i melduje każdą zapisaną paczkę', async () => {
    const plans = Array.from({ length: 250 }, (_, i) => osoba(i));
    const paczki: number[] = [];

    const counts = await db.transaction((tx) =>
      savePlans(tx, 'artist', plans, (done) => paczki.push(done)),
    );

    expect(BATCH_SIZE).toBe(100);
    expect(counts).toEqual({ inserted: 250, updated: 0, skipped: 0 });
    expect(paczki).toEqual([0, 1, 2, 3]);
    expect(await ile()).toBe(250);
  });

  it('błąd w drugiej paczce wycofuje całą transakcję', async () => {
    const plans = Array.from({ length: 150 }, (_, i) => osoba(i));
    // Wiersz nr 120 wpada do drugiej paczki i łamie NOT NULL na `name`.
    plans[120] = {
      ...plans[120],
      person: { ...plans[120].person, name: null as unknown as string },
    };

    const przed = await ile();
    await expect(db.transaction((tx) => savePlans(tx, 'artist', plans))).rejects.toThrow();
    expect(await ile()).toBe(przed);
  });

  it('nie usuwa osób nieobecnych w arkuszu', async () => {
    await db.transaction((tx) =>
      savePlans(tx, 'artist', Array.from({ length: 200 }, (_, i) => osoba(i))),
    );
    const przed = await ile();

    await db.transaction((tx) => savePlans(tx, 'artist', [osoba(9999)]));

    expect(await ile()).toBe(przed + 1);
  });

  it('aktualizacja bez zmian jest pomijana, nie wywraca transakcji', async () => {
    await db.transaction((tx) => savePlans(tx, 'artist', [osoba(1)]));
    const [wiersz] = await client`select id from artists limit 1`;

    const counts = await db.transaction((tx) =>
      savePlans(tx, 'artist', [
        {
          line: 2,
          person: osoba(1).person,
          plan: { action: 'update', id: wiersz.id as number, level: 'certain', reason: 'handle', changes: {} },
        },
      ]),
    );

    expect(counts).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(await ile()).toBe(1);
  });

  it('aktualizacja zmienia tylko pola z planu', async () => {
    await db.transaction((tx) => savePlans(tx, 'artist', [osoba(1)]));
    const [wiersz] = await client`select id, name, location from artists limit 1`;

    await db.transaction((tx) =>
      savePlans(tx, 'artist', [
        {
          line: 2,
          person: osoba(1).person,
          plan: { action: 'update', id: wiersz.id as number, level: 'certain', reason: 'handle', changes: { location: 'Kraków' } },
        },
      ]),
    );

    const [po] = await client`select name, location from artists where id = ${wiersz.id}`;
    expect(po.location).toBe('Kraków');
    expect(po.name).toBe(wiersz.name);
  });
});
