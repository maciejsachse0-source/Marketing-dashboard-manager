'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { videographerInputSchema, type VideographerInput } from './schemas';

export async function createVideographer(input: VideographerInput) {
  const parsed = videographerInputSchema.parse(input);
  const [row] = await db.insert(schema.videographers).values(parsed).returning();
  revalidatePath('/videographers');
  return row;
}

export async function updateVideographer(id: number, input: Partial<VideographerInput>) {
  const parsed = videographerInputSchema.partial().parse(input);
  const [row] = await db
    .update(schema.videographers)
    .set(parsed)
    .where(eq(schema.videographers.id, id))
    .returning();
  revalidatePath('/videographers');
  return row;
}

export async function deleteVideographer(id: number) {
  await db.delete(schema.videographers).where(eq(schema.videographers.id, id));
  revalidatePath('/videographers');
}

export async function listVideographers() {
  return db.query.videographers.findMany({ orderBy: schema.videographers.name });
}
