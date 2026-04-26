import { mkdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';

export type FileCategory = 'assets' | 'briefs' | 'packages' | 'csv' | 'outreach';

function rootDir(): string {
  return join(process.cwd(), 'data', 'files');
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function safeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 120);
}

export function categoryDir(category: FileCategory): string {
  const dir = join(rootDir(), category);
  ensureDir(dir);
  return dir;
}

export function buildPath(category: FileCategory, filename: string): string {
  const safe = safeName(filename);
  if (!safe) throw new Error('Invalid filename');
  const dir = categoryDir(category);
  const full = normalize(join(dir, safe));
  if (!full.startsWith(dir + sep) && full !== dir) {
    throw new Error('Path traversal detected');
  }
  return full;
}

export function relativePath(full: string): string {
  const root = process.cwd();
  return full.startsWith(root) ? full.slice(root.length + 1).split(sep).join('/') : full;
}

export async function saveText(category: FileCategory, filename: string, content: string): Promise<string> {
  const full = buildPath(category, filename);
  await writeFile(full, content, 'utf8');
  return relativePath(full);
}

export async function saveBuffer(category: FileCategory, filename: string, buf: Buffer): Promise<string> {
  const full = buildPath(category, filename);
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
