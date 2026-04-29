import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from './db';
import type { Platform } from '../../drizzle/schema';

function safeSlug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function fmtMonthDay(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type GenerateResult = {
  folderPath: string;
  assetIncluded: boolean;
  platforms: Platform[];
  filesWritten: number;
};

/**
 * Generate the publish-ready output folder for an approved production.
 * Idempotent — overwrites existing files with current data.
 */
export async function generateOutputFolder(productionId: number): Promise<GenerateResult> {
  const production = await db.query.productions.findFirst({
    where: eq(schema.productions.id, productionId),
  });
  if (!production) throw new Error(`Production #${productionId} not found`);

  const year = production.t0At.getFullYear();
  const monthDay = fmtMonthDay(production.t0At);
  const baseSlug = safeSlug(production.title) || `production-${productionId}`;
  const folderName = `${monthDay}-${baseSlug}`;
  const yearDir = join(process.cwd(), 'data', 'files', 'output', String(year));
  const fullPath = join(yearDir, folderName);

  await mkdir(fullPath, { recursive: true });

  let filesWritten = 0;
  const writeText = async (relPath: string, content: string) => {
    await writeFile(join(fullPath, relPath), content, 'utf8');
    filesWritten++;
  };

  // Latest package linked to this production
  const linkedPackages = await db.query.packages.findMany({
    where: eq(schema.packages.productionId, productionId),
    orderBy: desc(schema.packages.createdAt),
    limit: 1,
  });
  const pkg = linkedPackages[0] ?? null;

  // Asset
  let assetIncluded = false;
  if (pkg?.assetPath) {
    const assetSource = join(process.cwd(), pkg.assetPath);
    if (existsSync(assetSource)) {
      const ext = extname(pkg.assetPath) || '.bin';
      const targetName = `video${ext}`;
      await copyFile(assetSource, join(fullPath, targetName));
      filesWritten++;
      assetIncluded = true;
    } else {
      await writeText('asset-MISSING.txt', `Source asset path "${pkg.assetPath}" not found on disk.`);
    }
  } else {
    await writeText(
      'NO-ASSET.txt',
      'Brak assetu wideo. Dodaj przez modal pakietu w /packages — pakiet musi być powiązany z tą produkcją.',
    );
  }

  // Per-platform files
  const platforms: Platform[] = pkg ? pkg.platforms : production.platforms ?? [];
  if (pkg) {
    for (const platform of pkg.platforms) {
      const caption = (pkg.captions as Record<string, string | undefined>)[platform] ?? '';
      const tags = (pkg.hashtags as Record<string, string[] | undefined>)[platform] ?? [];
      const tagsStr = tags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');

      const platformDir = join(fullPath, platform);
      await mkdir(platformDir, { recursive: true });

      const captionWithMeta = [
        `# ${platform}`,
        '',
        caption || '_(brak captiona)_',
        '',
        tagsStr ? `## Hashtagi\n\n${tagsStr}` : '',
        pkg.cta ? `## CTA\n\n${pkg.cta}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await writeFile(join(platformDir, 'caption.md'), captionWithMeta, 'utf8');
      await writeFile(join(platformDir, 'hashtags.md'), tagsStr, 'utf8');
      if (pkg.cta) {
        await writeFile(join(platformDir, 'cta.md'), pkg.cta, 'utf8');
      }
      filesWritten += pkg.cta ? 3 : 2;
    }
  } else {
    await writeText(
      'NO-PACKAGE.txt',
      'Brak pakietu publikacyjnego. Wygeneruj przez social-publishera i zapisz z productionId tej produkcji.',
    );
  }

  // Brief — z calendar entries z briefPath
  const briefEntries = await db.query.calendarEntries.findMany({
    where: eq(schema.calendarEntries.productionId, productionId),
  });
  const entryWithBrief = briefEntries.find((e) => e.briefPath);
  if (entryWithBrief?.briefPath) {
    const briefSource = join(process.cwd(), entryWithBrief.briefPath);
    if (existsSync(briefSource)) {
      await copyFile(briefSource, join(fullPath, 'brief.md'));
      filesWritten++;
    }
  }

  // README
  const readme = [
    `# ${production.title}`,
    '',
    `**Status:** approved`,
    `**Typ:** ${production.type === 'with-artist' ? 'z artystą' : 'solo'}`,
    `**T-0:** ${production.t0At.toISOString()}`,
    platforms.length ? `**Platformy:** ${platforms.join(', ')}` : '',
    production.notes ? `**Notatki:** ${production.notes}` : '',
    `**Wygenerowane:** ${new Date().toISOString()}`,
    '',
    '## Zawartość folderu',
    '',
    assetIncluded ? '- `video.*` — finalne wideo gotowe do uploadu' : '- (brak assetu)',
    pkg ? '- `<platforma>/caption.md` — pełny tekst do wklejenia' : '',
    pkg ? '- `<platforma>/hashtags.md` — same hashtagi (do pierwszego komentarza)' : '',
    entryWithBrief?.briefPath ? '- `brief.md` — brief produkcyjny' : '',
    '',
    '## Jak uploadować',
    '',
    '1. Otwórz `<platforma>/caption.md`, skopiuj treść',
    '2. Otwórz aplikację socialową (Meta Suite / TikTok / YT Studio)',
    '3. Wgraj wideo, wklej caption',
    '4. Po publikacji wróć do aplikacji i zmień status produkcji na `published`',
    '',
  ]
    .filter(Boolean)
    .join('\n');
  await writeText('README.md', readme);

  // Save folderPath in DB (relative for portability)
  const relativePath = ['data', 'files', 'output', String(year), folderName].join('/');
  await db
    .update(schema.productions)
    .set({ folderPath: relativePath })
    .where(eq(schema.productions.id, productionId));

  return { folderPath: relativePath, assetIncluded, platforms, filesWritten };
}

export type OutputFolderInfo = {
  productionId: number;
  title: string;
  status: string;
  type: 'with-artist' | 'solo';
  t0At: string;
  folderPath: string;
  thumbnailPath: string | null;
  videoPath: string | null;
  platforms: Platform[];
};

/** List all production output folders. Reads from DB folderPath, not filesystem. */
export async function listOutputFolders(): Promise<OutputFolderInfo[]> {
  const productions = await db.query.productions.findMany({
    orderBy: desc(schema.productions.t0At),
  });
  const result: OutputFolderInfo[] = [];
  for (const p of productions) {
    if (!p.folderPath) continue;
    const fullDir = join(process.cwd(), p.folderPath);
    if (!existsSync(fullDir)) continue;

    let videoPath: string | null = null;
    let thumbnailPath: string | null = null;
    try {
      const entries = readdirSync(fullDir);
      for (const f of entries) {
        if (f.startsWith('video.')) videoPath = `${p.folderPath}/${f}`;
        if (f.startsWith('thumbnail.')) thumbnailPath = `${p.folderPath}/${f}`;
      }
    } catch {
      /* ignore */
    }

    result.push({
      productionId: p.id,
      title: p.title,
      status: p.status,
      type: p.type,
      t0At: p.t0At.toISOString(),
      folderPath: p.folderPath,
      thumbnailPath,
      videoPath,
      platforms: p.platforms ?? [],
    });
  }
  return result;
}

/** Read caption/hashtags content for a production+platform from disk. */
export function readPlatformCaption(folderPath: string, platform: string): string | null {
  const file = join(process.cwd(), folderPath, platform, 'caption.md');
  if (!existsSync(file)) return null;
  try {
    return require('node:fs').readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
