import 'server-only';
import { mkdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import { put } from '@vercel/blob';

export type FileCategory = 'assets' | 'briefs' | 'csv' | 'outreach';

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const useBlob = Boolean(blobToken);

function safeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/^\.+$/, '')
    .toLowerCase()
    .slice(0, 120);
}

// ---- Local-disk implementation (dev fallback) -------------------------------

function localRootDir(): string {
  return join(process.cwd(), 'data', 'files');
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function localCategoryDir(category: FileCategory): string {
  const dir = join(localRootDir(), category);
  ensureDir(dir);
  return dir;
}

function buildLocalPath(category: FileCategory, filename: string): string {
  const safe = safeName(filename);
  if (!safe) throw new Error('Invalid filename');
  const dir = localCategoryDir(category);
  const full = normalize(join(dir, safe));
  if (!full.startsWith(dir + sep) && full !== dir) {
    throw new Error('Path traversal detected');
  }
  return full;
}

function relativePath(full: string): string {
  const root = process.cwd();
  return full.startsWith(root) ? full.slice(root.length + 1).split(sep).join('/') : full;
}

// ---- Public API -------------------------------------------------------------

export async function saveText(category: FileCategory, filename: string, content: string): Promise<string> {
  const safe = safeName(filename);
  if (!safe) throw new Error('Invalid filename');

  if (useBlob) {
    const { url } = await put(`${category}/${safe}`, content, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: contentTypeFor(safe),
      token: blobToken,
    });
    return url;
  }

  const full = buildLocalPath(category, filename);
  await writeFile(full, content, 'utf8');
  return relativePath(full);
}

export async function saveBuffer(category: FileCategory, filename: string, buf: Buffer): Promise<string> {
  const safe = safeName(filename);
  if (!safe) throw new Error('Invalid filename');

  if (useBlob) {
    const { url } = await put(`${category}/${safe}`, buf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: contentTypeFor(safe),
      token: blobToken,
    });
    return url;
  }

  const full = buildLocalPath(category, filename);
  await writeFile(full, buf);
  return relativePath(full);
}

export function dateStamp(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function isoWeek(d: Date = new Date()): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function contentTypeFor(name: string): string | undefined {
  const ext = name.toLowerCase().split('.').pop();
  switch (ext) {
    case 'md':
      return 'text/markdown; charset=utf-8';
    case 'txt':
      return 'text/plain; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'csv':
      return 'text/csv; charset=utf-8';
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'mp4':
      return 'video/mp4';
    default:
      return undefined;
  }
}
