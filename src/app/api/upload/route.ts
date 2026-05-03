import { NextRequest } from 'next/server';
import { z } from 'zod';
import { saveBuffer, type FileCategory } from '@/lib/files';
import { getSessionEmail } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const categorySchema = z.enum(['assets', 'briefs', 'csv', 'outreach']);

const MAX_BYTES = 100 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const categoryRaw = form.get('category');

  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing file' }, { status: 400 });
  }

  const categoryParsed = categorySchema.safeParse(categoryRaw);
  if (!categoryParsed.success) {
    return Response.json({ error: 'Invalid category' }, { status: 400 });
  }
  const category: FileCategory = categoryParsed.data;

  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File too large (>100MB)' }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const path = await saveBuffer(category, file.name, buf);

  return Response.json({ path, size: file.size, name: file.name });
}
