'use server';

import { safeRevalidatePath as revalidatePath } from './revalidate';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { postInputSchema, type PostInput } from './schemas';

export async function createPost(input: PostInput) {
  const parsed = postInputSchema.parse(input);
  const [row] = await db
    .insert(schema.posts)
    .values({
      publishedAt: new Date(parsed.publishedAt),
      platform: parsed.platform,
      title: parsed.title,
      caption: parsed.caption ?? '',
      hashtags: parsed.hashtags ?? null,
      assetPath: parsed.assetPath ?? null,
      campaignId: parsed.campaignId ?? null,
    })
    .returning();
  revalidatePath('/analytics');
  return row;
}

export async function updatePostMetrics(
  id: number,
  metrics: Partial<{
    reach: number;
    impressions: number;
    engagementRate: number;
    completionRate: number;
    saves: number;
    shares: number;
    comments: number;
    followersGained: number;
    rawCsvRowId: number;
  }>,
) {
  const [row] = await db
    .update(schema.posts)
    .set(metrics)
    .where(eq(schema.posts.id, id))
    .returning();
  revalidatePath('/analytics');
  return row;
}

export async function deletePost(id: number) {
  await db.delete(schema.posts).where(eq(schema.posts.id, id));
  revalidatePath('/analytics');
}

export async function listPosts() {
  return db.query.posts.findMany({ orderBy: schema.posts.publishedAt });
}
