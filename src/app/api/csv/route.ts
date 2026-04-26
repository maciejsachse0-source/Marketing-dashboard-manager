import { NextRequest } from 'next/server';
import { saveBuffer } from '@/lib/files';
import { db, schema } from '@/lib/db';
import { detectCsvSource, parseCsvBuffer } from '@/lib/csv-parser';

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
      {
        error: 'Could not detect CSV source. Expected Meta / TikTok / YouTube export headers.',
        path,
      },
      { status: 400 },
    );
  }

  const rows = parseCsvBuffer(text);

  const [upload] = await db
    .insert(schema.csvUploads)
    .values({
      filename: file.name,
      source: detected,
      rowCount: rows.length,
    })
    .returning();

  if (rows.length > 0) {
    await db.insert(schema.csvRows).values(
      rows.map((data) => ({
        uploadId: upload.id,
        data,
      })),
    );
  }

  return Response.json({
    uploadId: upload.id,
    source: detected,
    rowCount: rows.length,
    path,
    matchedPosts: 0,
  });
}
