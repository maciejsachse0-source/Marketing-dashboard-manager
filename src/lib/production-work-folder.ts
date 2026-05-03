import { mkdirSync, existsSync, readdirSync, statSync, renameSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

/**
 * Production "work folder" — where the user keeps raw footage, edit projects,
 * drafts, and per-platform finals during a production.
 *
 * Lives outside the repo, in the user's OneDrive so files sync across
 * machines. Layout is keyed by artist name (one folder per artist) and
 * production title (one subfolder per production), then T-coded inner
 * folders matching the gantt frames:
 *
 *   <ROOT>/
 *     <Artist Name>/
 *       <Production Title>/
 *         T2/                          ← nagrywka + obróbka
 *           nagrywanie/  raw/, audio/, bts/
 *           obrobka/     project/, drafts/, assets/
 *         T3/                          ← publikacja
 *           publikacja/
 *         T4/                          ← forward-compat empty placeholder
 *
 * T1 is communication-only (outreach + ustalenia) so it gets no folder.
 *
 * Resolution order for the root:
 *   1. `MARKETING_CONTENT_ROOT` env var (explicit override — wins always)
 *   2. `<OneDrive>\MARKETPLACE DOCS\Marketing Content` — auto-detected from
 *      the per-user OneDrive env vars Windows sets automatically. Works
 *      across machines/accounts because the shared `MARKETPLACE DOCS`
 *      folder is synced to each user's OneDrive root.
 *   3. Hardcoded fallback (rarely hit) — keeps the app from crashing on
 *      machines without OneDrive while still surfacing "folder missing"
 *      errors at the call site.
 */

const FOLDER_TAIL = ['MARKETPLACE DOCS', 'Marketing Content'] as const;
const HARDCODED_FALLBACK = 'C:\\Users\\Hp omen\\OneDrive\\MARKETPLACE DOCS\\Marketing Content';

function detectOneDriveRoot(): string | null {
  // Windows sets one of these automatically per signed-in profile:
  //   OneDrive            — primary OneDrive (consumer or business)
  //   OneDriveConsumer    — personal OneDrive when both are present
  //   OneDriveCommercial  — OneDrive for Business when both are present
  const candidates = [
    process.env.OneDrive,
    process.env.OneDriveConsumer,
    process.env.OneDriveCommercial,
  ];
  for (const c of candidates) {
    if (c && c.trim().length > 0) return c;
  }
  return null;
}

function getRoot(): string {
  const override = process.env.MARKETING_CONTENT_ROOT;
  if (override && override.trim().length > 0) return override;

  const oneDrive = detectOneDriveRoot();
  if (oneDrive) return join(oneDrive, ...FOLDER_TAIL);

  return HARDCODED_FALLBACK;
}

export const WORK_STAGES = ['nagrywanie', 'obrobka', 'publikacja'] as const;
export type WorkStage = (typeof WORK_STAGES)[number];

const STAGE_TO_FRAME: Record<WorkStage, 'T2' | 'T3'> = {
  nagrywanie: 'T2',
  obrobka: 'T2',
  publikacja: 'T3',
};

const STAGE_SUBFOLDERS: Record<WorkStage, string[]> = {
  nagrywanie: ['raw', 'audio', 'bts'],
  obrobka: ['project', 'drafts', 'assets'],
  publikacja: [],
};

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Sanitise a string for use as a Windows/macOS/Linux folder name. Less
 * destructive than slugify — keeps spaces and Polish characters where
 * possible — but still strips chars that are illegal on Windows
 * (`<>:"/\\|?*` + control chars) and trailing dots/spaces.
 */
function safeFolderName(name: string): string {
  let s = (name ?? '')
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (!s) s = 'unnamed';
  if (WINDOWS_RESERVED.test(s)) s = `${s}_`;
  return s.slice(0, 100);
}

export function getArtistFolderRoot(artistName: string): string {
  return join(getRoot(), safeFolderName(artistName));
}

export function getProductionFolderRoot(
  artistName: string,
  productionTitle: string,
): string {
  return join(getArtistFolderRoot(artistName), safeFolderName(productionTitle));
}

export function getStagePath(
  artistName: string,
  productionTitle: string,
  stage: WorkStage,
): string {
  const frame = STAGE_TO_FRAME[stage];
  return join(getProductionFolderRoot(artistName, productionTitle), frame, stage);
}

/**
 * Idempotently create the folder layout for a production. T1 is skipped
 * (no work folder). T2/T3 get their predefined stage subfolders. Any
 * other T-code (T4+) gets an empty placeholder so the user can drop
 * files in even before a stage convention exists.
 *
 * `frameCodes` should come from `production.periods.map(p => p.code)`.
 * Falls back to T1/T2/T3 for legacy productions persisted before the
 * flexible-periods migration.
 */
export function ensureWorkFolderStructure(
  artistName: string,
  productionTitle: string,
  frameCodes: readonly string[] = ['T1', 'T2', 'T3'],
): string {
  const root = getProductionFolderRoot(artistName, productionTitle);
  if (!existsSync(root)) mkdirSync(root, { recursive: true });

  for (const code of frameCodes) {
    if (code === 'T1') continue;
    const framePath = join(root, code);
    if (!existsSync(framePath)) mkdirSync(framePath, { recursive: true });

    if (code === 'T2') {
      for (const stage of ['nagrywanie', 'obrobka'] as const) {
        const stagePath = join(framePath, stage);
        if (!existsSync(stagePath)) mkdirSync(stagePath, { recursive: true });
        for (const sub of STAGE_SUBFOLDERS[stage]) {
          const subPath = join(stagePath, sub);
          if (!existsSync(subPath)) mkdirSync(subPath, { recursive: true });
        }
      }
    } else if (code === 'T3') {
      const stagePath = join(framePath, 'publikacja');
      if (!existsSync(stagePath)) mkdirSync(stagePath, { recursive: true });
    }
    // T4+ stays as an empty placeholder
  }
  return root;
}

export type WorkStageStats = {
  stage: WorkStage;
  fileCount: number;
};

/** Count files (recursively) inside each stage subfolder. */
export function countWorkFolderFiles(
  artistName: string,
  productionTitle: string,
): WorkStageStats[] {
  return WORK_STAGES.map((stage) => {
    const path = getStagePath(artistName, productionTitle, stage);
    return { stage, fileCount: countFilesRecursive(path) };
  });
}

function countFilesRecursive(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    try {
      const s = statSync(full);
      if (s.isDirectory()) count += countFilesRecursive(full);
      else if (s.isFile()) count += 1;
    } catch {
      /* skip unreadable entries */
    }
  }
  return count;
}

/**
 * Resolve a stage path with path-traversal guard. Throws if the resolved
 * absolute path would escape the production folder root.
 */
export function resolveSafeStagePath(
  artistName: string,
  productionTitle: string,
  stage: WorkStage,
): string {
  const root = getProductionFolderRoot(artistName, productionTitle);
  const stagePath = normalize(getStagePath(artistName, productionTitle, stage));
  if (!stagePath.startsWith(root + sep) && stagePath !== root) {
    throw new Error('Path traversal detected');
  }
  return stagePath;
}

/**
 * Rename the production folder by appending " (nieaktualne)" — used when
 * a production is deleted from the DB. Best-effort: idempotent if the
 * folder doesn't exist, and suffixes a numeric counter if a previous
 * "(nieaktualne)" sibling already lives in the artist folder.
 */
export function markProductionFolderObsolete(
  artistName: string,
  productionTitle: string,
):
  | { renamed: false; reason: string }
  | { renamed: true; from: string; to: string } {
  const src = getProductionFolderRoot(artistName, productionTitle);
  if (!existsSync(src)) return { renamed: false, reason: 'Folder nie istnieje' };

  const artistRoot = getArtistFolderRoot(artistName);
  const base = `${safeFolderName(productionTitle)} (nieaktualne)`;
  let candidate = join(artistRoot, base);
  let counter = 2;
  while (existsSync(candidate)) {
    candidate = join(artistRoot, `${base} ${counter}`);
    counter++;
  }
  renameSync(src, candidate);
  return { renamed: true, from: src, to: candidate };
}
