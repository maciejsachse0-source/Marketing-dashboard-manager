import { mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';

const ROOT = () => join(process.cwd(), 'data', 'files', 'productions');

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

function productionDir(slug: string, stage?: string): string {
  const safe = safeName(slug);
  if (!safe) throw new Error('Invalid production slug');
  const stagePart = stage ? safeName(stage) : '';
  const dir = stagePart ? join(ROOT(), safe, stagePart) : join(ROOT(), safe);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function relativePath(full: string): string {
  const root = process.cwd();
  return full.startsWith(root) ? full.slice(root.length + 1).split(sep).join('/') : full;
}

export type Attachment = {
  filename: string;
  relativePath: string;
  size: number;
  uploadedAt: Date;
  stage: string;
};

export function listProductionAttachments(slug: string): Attachment[] {
  const root = join(ROOT(), safeName(slug));
  if (!existsSync(root)) return [];
  const stages = readdirSync(root).filter((entry) => {
    try {
      return statSync(join(root, entry)).isDirectory();
    } catch {
      return false;
    }
  });
  const out: Attachment[] = [];
  for (const stage of stages) {
    const stageDir = join(root, stage);
    const files = readdirSync(stageDir);
    for (const f of files) {
      const full = join(stageDir, f);
      try {
        const s = statSync(full);
        if (!s.isFile()) continue;
        out.push({
          filename: f,
          relativePath: relativePath(full),
          size: s.size,
          uploadedAt: s.mtime,
          stage,
        });
      } catch {
        /* skip */
      }
    }
  }
  return out.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

export async function saveProductionAttachment(
  slug: string,
  stage: string,
  filename: string,
  data: ArrayBuffer | Buffer,
): Promise<Attachment> {
  const dir = productionDir(slug, stage);
  const safe = safeName(filename);
  if (!safe) throw new Error('Invalid filename');
  const full = normalize(join(dir, safe));
  if (!full.startsWith(dir + sep) && full !== dir) throw new Error('Path traversal');

  const buffer: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await writeFile(full, buffer);
  return {
    filename: safe,
    relativePath: relativePath(full),
    size: buffer.length,
    uploadedAt: new Date(),
    stage,
  };
}
