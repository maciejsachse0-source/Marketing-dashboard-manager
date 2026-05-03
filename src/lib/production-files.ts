import 'server-only';
import { mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import { put, list } from '@vercel/blob';

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
const useBlob = Boolean(blobToken);

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

function diskRelativePath(full: string): string {
  const root = process.cwd();
  return full.startsWith(root) ? full.slice(root.length + 1).split(sep).join('/') : full;
}

export type Attachment = {
  filename: string;
  /** For Blob storage this is the public CDN URL; for disk it's a path
   *  relative to the project root. UI treats both as opaque hrefs. */
  relativePath: string;
  size: number;
  uploadedAt: Date;
  stage: string;
};

export async function listProductionAttachments(slug: string): Promise<Attachment[]> {
  const safeSlug = safeName(slug);
  if (!safeSlug) return [];

  if (useBlob) {
    const prefix = `productions/${safeSlug}/`;
    const result = await list({ prefix, token: blobToken });
    return result.blobs
      .map((b) => {
        const rel = b.pathname.slice(prefix.length); // <stage>/<filename>
        const slashIdx = rel.indexOf('/');
        const stage = slashIdx >= 0 ? rel.slice(0, slashIdx) : '';
        const filename = slashIdx >= 0 ? rel.slice(slashIdx + 1) : rel;
        return {
          filename,
          relativePath: b.url,
          size: b.size,
          uploadedAt: new Date(b.uploadedAt),
          stage,
        };
      })
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  const root = join(ROOT(), safeSlug);
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
          relativePath: diskRelativePath(full),
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
  const safeSlug = safeName(slug);
  const safeStage = safeName(stage);
  const safeFile = safeName(filename);
  if (!safeSlug) throw new Error('Invalid production slug');
  if (!safeStage) throw new Error('Invalid stage');
  if (!safeFile) throw new Error('Invalid filename');

  const buffer: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (useBlob) {
    const path = `productions/${safeSlug}/${safeStage}/${safeFile}`;
    const { url } = await put(path, buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: blobToken,
    });
    return {
      filename: safeFile,
      relativePath: url,
      size: buffer.length,
      uploadedAt: new Date(),
      stage: safeStage,
    };
  }

  const dir = productionDir(slug, stage);
  const full = normalize(join(dir, safeFile));
  if (!full.startsWith(dir + sep) && full !== dir) throw new Error('Path traversal');
  await writeFile(full, buffer);
  return {
    filename: safeFile,
    relativePath: diskRelativePath(full),
    size: buffer.length,
    uploadedAt: new Date(),
    stage: safeStage,
  };
}
