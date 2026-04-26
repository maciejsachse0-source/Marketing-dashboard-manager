import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

export type BriefFile = {
  filename: string;
  path: string;
  modifiedAt: Date;
  sizeBytes: number;
  /** Heuristic — `wrap-` prefix → wrap, else brief. */
  kind: 'brief' | 'wrap';
};

const BRIEFS_DIR = () => join(process.cwd(), 'data', 'files', 'briefs');

export function listBriefFiles(): BriefFile[] {
  const dir = BRIEFS_DIR();
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir).filter((f) => f.endsWith('.md'));
  return entries
    .map((filename) => {
      const full = join(dir, filename);
      const stats = statSync(full);
      const kind: 'brief' | 'wrap' = filename.startsWith('wrap-') ? 'wrap' : 'brief';
      return {
        filename,
        path: `data/files/briefs/${filename}`,
        modifiedAt: stats.mtime,
        sizeBytes: stats.size,
        kind,
      };
    })
    .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

export function readBriefFile(filename: string): string | null {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
  const dir = BRIEFS_DIR();
  const full = join(dir, filename);
  if (!full.startsWith(dir + sep)) return null;
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}
