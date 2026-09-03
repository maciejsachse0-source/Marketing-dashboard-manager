'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { artistInputSchema, idSchema, type ArtistInput } from './schemas';

export async function createArtist(input: ArtistInput) {
  await requireSession();
  const parsed = artistInputSchema.parse(input);
  const [row] = await db.insert(schema.artists).values(parsed).returning();
  revalidatePath('/artists');
  return row;
}

export async function updateArtist(id: number, input: Partial<ArtistInput>) {
  await requireSession();
  idSchema.parse(id);
  const parsed = artistInputSchema.partial().parse(input);
  const [row] = await db
    .update(schema.artists)
    .set(parsed)
    .where(eq(schema.artists.id, id))
    .returning();
  revalidatePath('/artists');
  return row;
}

export async function deleteArtist(id: number) {
  await requireSession();
  idSchema.parse(id);
  await db.delete(schema.artists).where(eq(schema.artists.id, id));
  revalidatePath('/artists');
}

export async function touchLastContact(id: number) {
  await requireSession();
  idSchema.parse(id);
  await db
    .update(schema.artists)
    .set({ lastContactAt: new Date() })
    .where(eq(schema.artists.id, id));
  revalidatePath('/artists');
}

export async function listArtists() {
  await requireSession();
  return db.query.artists.findMany({ orderBy: schema.artists.name });
}
