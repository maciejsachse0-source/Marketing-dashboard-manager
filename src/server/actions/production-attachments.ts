'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { saveProductionAttachment } from '@/lib/production-files';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function uploadProductionAttachment(
  productionId: number,
  stage: string,
  formData: FormData,
): Promise<{ ok: true; filename: string } | { ok: false; error: string }> {
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'Brak pliku' };
  if (file.size === 0) return { ok: false, error: 'Plik jest pusty' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'Plik > 25 MB' };

  const production = await db.query.productions.findFirst({
    where: eq(schema.productions.id, productionId),
    columns: { id: true, slug: true },
  });
  if (!production) return { ok: false, error: 'Brak produkcji' };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const att = await saveProductionAttachment(production.slug, stage, file.name, buffer);
    revalidatePath(`/productions/${productionId}`);
    return { ok: true, filename: att.filename };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'upload failed' };
  }
}
