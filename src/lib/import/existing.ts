/**
 * Osoby już w bazie, w kształcie, którego oczekuje wykrywanie duplikatów.
 * Jedno miejsce dla strony importu i dla zapisu, żeby podgląd i zapis liczyły
 * duplikaty z tego samego zbioru.
 */
import type { db as Db, schema as Schema } from '@/lib/db';
import type { ExistingPerson } from './dedup';

export async function existingPeople(
  db: typeof Db,
  schema: typeof Schema,
): Promise<ExistingPerson[]> {
  const [artists, videographers] = await Promise.all([
    db.query.artists.findMany({ orderBy: schema.artists.name }),
    db.query.videographers.findMany({ orderBy: schema.videographers.name }),
  ]);

  return [
    ...artists.map((row) => ({
      id: row.id,
      role: 'artist' as const,
      name: row.name,
      handle: row.handle,
      email: row.email,
      phone: row.phone,
      location: row.location,
      status: null,
      notes: row.notes,
    })),
    ...videographers.map((row) => ({
      id: row.id,
      role: 'videographer' as const,
      name: row.name,
      handle: row.handle,
      email: row.email,
      phone: row.phone,
      location: row.location,
      status: row.status,
      notes: row.notes,
    })),
  ];
}
