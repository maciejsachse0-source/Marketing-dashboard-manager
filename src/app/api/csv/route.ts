import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { saveBuffer } from '@/lib/files';
import { db, schema } from '@/lib/db';
import { getSessionEmail } from '@/lib/auth';
import { detectCsvSource, parseCsvBuffer } from '@/lib/csv-parser';
import { normalizeRow, isLikelyMatch, type NormalizedPost } from '@/lib/csv-mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 50 * 1024 * 1024;

type PreviewRow =
  | {
      action: 'create';
      title: string;
      platform: string;
      publishedAt: string;
      reach?: number;
      engagementRate?: number;
    }
  | {
      action: 'update';
      title: string;
      platform: string;
      publishedAt: string;
      matchedPostId: number;
      changes: Record<string, string>;
    }
  | {
      action: 'skip';
      reason: string;
      raw?: string;
    };

export async function POST(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File too large (>50MB)' }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const text = buf.toString('utf8');
  const detected = detectCsvSource(text);
  if (!detected) {
    return Response.json(
      { error: 'Could not detect CSV source. Expected Meta / TikTok / YouTube export headers.' },
      { status: 400 },
    );
  }

  const rows = parseCsvBuffer(text);

  const cutoff = new Date(Date.now() - 180 * 86400000);
  const candidates = await db.query.posts.findMany({
    where: (post, { gte }) => gte(post.publishedAt, cutoff),
    limit: 500,
  });

  // First pass: analyze every row → action plan
  const plan: { row: Record<string, unknown>; normalized: NormalizedPost | null; matchId: number | null }[] = [];
  for (const raw of rows) {
    const r = raw as Record<string, unknown>;
    const normalized = normalizeRow(detected, r);
    let matchId: number | null = null;
    if (normalized) {
      const match = candidates.find((p) =>
        isLikelyMatch(
          { title: normalized.title, platform: normalized.platform, publishedAt: normalized.publishedAt },
          { title: p.title, platform: p.platform, publishedAt: p.publishedAt },
        ),
      );
      matchId = match?.id ?? null;
    }
    plan.push({ row: r, normalized, matchId });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const preview: PreviewRow[] = [];

  for (const { row, normalized, matchId } of plan) {
    if (!normalized) {
      skipped++;
      preview.push({
        action: 'skip',
        reason: 'Nie udało się wyciągnąć tytułu / daty publikacji',
        raw: JSON.stringify(row).slice(0, 120),
      });
      continue;
    }

    if (matchId !== null) {
      const match = candidates.find((p) => p.id === matchId)!;
      const metrics = collectMetrics(normalized);
      const changes: Record<string, string> = {};
      for (const [k, v] of Object.entries(metrics)) {
        if (v === null) continue;
        const existing = (match as Record<string, unknown>)[k];
        if (existing === null || existing === undefined) {
          changes[k] = `— → ${v}`;
        } else if (typeof existing === 'number' && typeof v === 'number' && v > existing) {
          changes[k] = `${existing} → ${v}`;
        }
      }
      if (Object.keys(changes).length === 0) {
        skipped++;
        preview.push({
          action: 'skip',
          reason: 'Match znaleziony ale brak nowych metryk do zapisu',
        });
        continue;
      }
      updated++;
      preview.push({
        action: 'update',
        title: normalized.title,
        platform: normalized.platform,
        publishedAt: normalized.publishedAt.toISOString(),
        matchedPostId: matchId,
        changes,
      });
    } else {
      created++;
      preview.push({
        action: 'create',
        title: normalized.title,
        platform: normalized.platform,
        publishedAt: normalized.publishedAt.toISOString(),
        reach: normalized.reach,
        engagementRate: normalized.engagementRate,
      });
    }
  }

  if (dryRun) {
    return Response.json({
      dryRun: true,
      source: detected,
      rowCount: rows.length,
      created,
      updated,
      skipped,
      preview,
    });
  }

  // Commit phase — file save outside the transaction (idempotent on retry,
  // and FS writes can't be rolled back anyway). DB operations all-or-nothing
  // inside a single transaction so a mid-loop failure doesn't leave
  // csv_uploads.row_count saying 100 while only 50 posts were upserted.
  const path = await saveBuffer('csv', file.name, buf);

  const uploadId = await db.transaction(async (tx) => {
    const [upload] = await tx
      .insert(schema.csvUploads)
      .values({ filename: file.name, source: detected, rowCount: rows.length })
      .returning();

    if (rows.length === 0) return upload.id;

    const insertedRows = await tx
      .insert(schema.csvRows)
      .values(rows.map((data) => ({ uploadId: upload.id, data: data as Record<string, unknown> })))
      .returning({ id: schema.csvRows.id });

    for (let i = 0; i < plan.length; i++) {
      const { normalized, matchId } = plan[i];
      const csvRowId = insertedRows[i]?.id ?? null;
      if (!normalized) continue;
      const metrics = collectMetrics(normalized);

      if (matchId !== null) {
        const match = candidates.find((p) => p.id === matchId)!;
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
        if (Object.keys(updates).length > 1) {
          await tx.update(schema.posts).set(updates).where(eq(schema.posts.id, matchId));
        }
      } else {
        await tx.insert(schema.posts).values({
          title: normalized.title,
          platform: normalized.platform,
          publishedAt: normalized.publishedAt,
          caption: '',
          ...metrics,
          rawCsvRowId: csvRowId,
        });
      }
    }

    return upload.id;
  });

  return Response.json({
    uploadId,
    source: detected,
    rowCount: rows.length,
    path,
    created,
    updated,
    skipped,
  });
}

function collectMetrics(normalized: NormalizedPost): Record<string, number | null> {
  return {
    reach: normalized.reach ?? null,
    impressions: normalized.impressions ?? null,
    engagementRate: normalized.engagementRate ?? null,
    completionRate: normalized.completionRate ?? null,
    saves: normalized.saves ?? null,
    shares: normalized.shares ?? null,
    comments: normalized.comments ?? null,
    followersGained: normalized.followersGained ?? null,
  };
}
