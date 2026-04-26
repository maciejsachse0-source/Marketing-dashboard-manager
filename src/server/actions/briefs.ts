'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { saveText } from '@/lib/files';
import { briefInputSchema, type BriefInput } from './schemas';

export async function saveBrief(input: BriefInput) {
  const parsed = briefInputSchema.parse(input);
  const path = await saveText('briefs', parsed.filename, parsed.markdown);

  if (parsed.calendarEntryId) {
    await db
      .update(schema.calendarEntries)
      .set({ briefPath: path })
      .where(eq(schema.calendarEntries.id, parsed.calendarEntryId));
  }
  revalidatePath('/calendar');
  return { path };
}
