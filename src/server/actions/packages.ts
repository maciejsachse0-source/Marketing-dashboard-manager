'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { packageInputSchema, type PackageInput } from './schemas';

export async function createPackage(input: PackageInput) {
  const parsed = packageInputSchema.parse(input);
  const [row] = await db
    .insert(schema.packages)
    .values({
      title: parsed.title,
      assetPath: parsed.assetPath ?? null,
      platforms: parsed.platforms,
      captions: parsed.captions,
      hashtags: parsed.hashtags,
      cta: parsed.cta ?? null,
      status: parsed.status ?? 'draft',
      campaignId: parsed.campaignId ?? null,
      scheduledFor: parsed.scheduledFor ? new Date(parsed.scheduledFor) : null,
    })
    .returning();
  revalidatePath('/packages');
  return row;
}

export async function updatePackage(id: number, input: Partial<PackageInput>) {
  const parsed = packageInputSchema.partial().parse(input);
  const { scheduledFor, ...rest } = parsed;
  const [row] = await db
    .update(schema.packages)
    .set({
      ...rest,
      ...(scheduledFor ? { scheduledFor: new Date(scheduledFor) } : {}),
    })
    .where(eq(schema.packages.id, id))
    .returning();
  revalidatePath('/packages');
  return row;
}

export async function deletePackage(id: number) {
  await db.delete(schema.packages).where(eq(schema.packages.id, id));
  revalidatePath('/packages');
}

export async function listPackages() {
  return db.query.packages.findMany({ orderBy: schema.packages.createdAt });
}
