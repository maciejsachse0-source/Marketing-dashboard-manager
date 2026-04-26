import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import JSZip from 'jszip';
import { db, schema } from '@/lib/db';
import type { Platform } from '../../../../../../drizzle/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeFilename(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'package';
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pkgId = Number(id);
  if (!Number.isFinite(pkgId)) {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  const pkg = await db.query.packages.findFirst({
    where: eq(schema.packages.id, pkgId),
  });
  if (!pkg) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const zip = new JSZip();
  const slug = safeFilename(pkg.title);

  // Per-platform caption + hashtags files
  for (const platform of pkg.platforms as Platform[]) {
    const caption = (pkg.captions as Record<string, string | undefined>)[platform] ?? '';
    const hashtags = (pkg.hashtags as Record<string, string[] | undefined>)[platform] ?? [];
    const tags = hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
    const captionWithTags = [caption, tags].filter(Boolean).join('\n\n');
    zip.file(`${platform}/caption.txt`, captionWithTags);
    zip.file(`${platform}/hashtags.txt`, tags);
  }

  // Asset (if exists on disk)
  if (pkg.assetPath) {
    const assetFull = join(process.cwd(), pkg.assetPath);
    if (existsSync(assetFull)) {
      try {
        const buf = await readFile(assetFull);
        zip.file(`asset${extname(pkg.assetPath) || ''}`, buf);
      } catch {
        // ignore read errors — asset section becomes a note
        zip.file('asset-MISSING.txt', `Could not read asset at ${pkg.assetPath}`);
      }
    } else {
      zip.file('asset-MISSING.txt', `Asset path "${pkg.assetPath}" does not exist on disk.`);
    }
  }

  // Metadata README
  const readme = [
    `# ${pkg.title}`,
    '',
    `Status: ${pkg.status}`,
    `Platformy: ${(pkg.platforms as string[]).join(', ')}`,
    pkg.cta ? `CTA: ${pkg.cta}` : null,
    pkg.scheduledFor ? `Zaplanowane na: ${pkg.scheduledFor.toISOString()}` : null,
    pkg.campaignId ? `Kampania: #${pkg.campaignId}` : null,
    `Wygenerowane: ${new Date().toISOString()}`,
    pkg.assetPath ? `Asset path (źródło): ${pkg.assetPath}` : null,
    '',
    '## Jak użyć',
    '',
    '1. Otwórz odpowiedni folder per platforma',
    '2. Skopiuj caption.txt do okna posta na socialu',
    '3. Hashtagi możesz wkleić w pierwszym komentarzu (IG/TT) lub na końcu',
    '4. Wgraj `asset.*` jako video/zdjęcie',
    '',
  ]
    .filter(Boolean)
    .join('\n');
  zip.file('README.md', readme);

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const filename = `${slug}-${pkg.id}.zip`;

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
