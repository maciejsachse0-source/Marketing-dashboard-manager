import 'server-only';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { list } from '@vercel/blob';

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const useBlob = Boolean(blobToken);

export type OutreachFile = {
  filename: string;
  /** Public CDN URL when using Vercel Blob, repo-relative path otherwise. */
  path: string;
  modifiedAt: Date;
  /** Sanitized prefix that should match an artist's safeName(name). */
  prefix: string;
};

function safeSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export async function listOutreachFiles(): Promise<OutreachFile[]> {
  if (useBlob) {
    const result = await list({ prefix: 'outreach/', token: blobToken });
    return result.blobs
      .filter((b) => b.pathname.endsWith('.md'))
      .map((b) => {
        const filename = b.pathname.slice('outreach/'.length);
        const prefix = filename.replace(/\.md$/, '').split('-').slice(0, 2).join('-');
        return {
          filename,
          path: b.url,
          modifiedAt: new Date(b.uploadedAt),
          prefix,
        };
      })
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  }

  const dir = join(process.cwd(), 'data', 'files', 'outreach');
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir).filter((f) => f.endsWith('.md'));
  return entries
    .map((filename) => {
      const full = join(dir, filename);
      const stats = statSync(full);
      const prefix = filename.replace(/\.md$/, '').split('-').slice(0, 2).join('-');
      return {
        filename,
        path: `data/files/outreach/${filename}`,
        modifiedAt: stats.mtime,
        prefix,
      };
    })
    .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

export function outreachFilesForArtist(name: string, all: OutreachFile[]): OutreachFile[] {
  const slug = safeSlug(name);
  if (!slug) return [];
  const root = slug.split('-')[0];
  return all.filter((f) => f.filename.toLowerCase().startsWith(slug) || f.filename.toLowerCase().startsWith(root + '-'));
}
