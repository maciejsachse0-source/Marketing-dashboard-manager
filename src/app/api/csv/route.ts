import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { saveBuffer } from '@/lib/files';
import { db, schema } from '@/lib/db';
import { detectCsvSource, parseCsvBuffer } from '@/lib/csv-parser';
import { normalizeRow, isLikelyMatch } from '@/lib/csv-mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const path = await saveBuffer('csv', file.name, buf);

  const text = buf.toString('utf8');
  const detected = detectCsvSource(text);
  if (!detected) {
    return Response.json(
      { error: 'Could not detect CSV source. Expected Meta / TikTok / YouTube export headers.', path },
      { status: 400 },
    );
  }

  const rows = parseCsvBuffer(text);

  const [upload] = await db
    .insert(schema.csvUploads)
    .values({ filename: file.name, source: detected, rowCount: rows.length })
    .returning();

  if (rows.length === 0) {
    return Response.json({
      uploadId: upload.id,
      source: detected,
      rowCount: 0,
      path,
      created: 0,
      updated: 0,
      skipped: 0,
    });
  }

  const insertedRows = await db
    .insert(schema.csvRows)
    .values(rows.map((data) => ({ uploadId: upload.id, data })))
    .returning({ id: schema.csvRows.id });

  const cutoff = new Date(Date.now() - 180 * 86400000);
  const candidates = await db.query.posts.findMany({
    where: (post, { gte }) => gte(post.publishedAt, cutoff),
    limit: 500,
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as Record<string, unknown>;
    const csvRowId = insertedRows[i]?.id ?? null;
    const normalized = normalizeRow(detected, raw);
    if (!normalized) {
      skipped++;
      continue;
    }

    const match = candidates.find((p) =>
      isLikelyMatch(
        { title: normalized.title, platform: normalized.platform, publishedAt: normalized.publishedAt },
        { title: p.title, platform: p.platform, publishedAt: p.publishedAt },
      ),
    );

    const metrics = {
      reach: normalized.reach ?? null,
      impressions: normalized.impressions ?? null,
      engagementRate: normalized.engagementRate ?? null,
      completionRate: normalized.completionRate ?? null,
      saves: normalized.saves ?? null,
      shares: normalized.shares ?? null,
      comments: normalized.comments ?? null,
      followersGained: normalized.followersGained ?? null,
    };

    if (match) {
      const updates: Record<string, unknown> = { rawCsvRowId: csvRowId };
      for (const [k, v] of Object.entries(metrics)) {
        if (v === null) continue;
        const existing = (match as Record<string, unknown>)[k];
        if (existing === null || existing === undefined) {
          updates[k] = v;
        } else if (typeof existing === 'number' && typeof v === 'number' && v > existing) {
          updates[k] = v;
        }
      }
      await db.update(schema.posts).set(updates).where(eq(schema.posts.id, match.id));
      updated++;
    } else {
      await db.insert(schema.posts).values({
        title: normalized.title,
        platform: normalized.platform,
        publishedAt: normalized.publishedAt,
        caption: '',
        ...metrics,
        rawCsvRowId: csvRowId,
      });
      created++;
    }
  }

  return Response.json({
    uploadId: upload.id,
    source: detected,
    rowCount: rows.length,
    path,
    created,
    updated,
    skipped,
  });
}
