'use server';

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  WORK_STAGES,
  type WorkStage,
  ensureWorkFolderStructure,
  resolveSafeStagePath,
  countWorkFolderFiles,
} from '@/lib/production-work-folder';

type Result = { ok: true } | { ok: false; error: string };

function isValidStage(stage: string): stage is WorkStage {
  return (WORK_STAGES as readonly string[]).includes(stage);
}

async function loadProductionWithArtist(productionId: number) {
  const production = await db.query.productions.findFirst({
    where: eq(schema.productions.id, productionId),
    columns: { id: true, title: true, artistId: true, periods: true },
  });
  if (!production) return null;
  if (!production.artistId) return { production, artist: null as null };
  const artist = await db.query.artists.findFirst({
    where: eq(schema.artists.id, production.artistId),
    columns: { name: true },
  });
  return { production, artist: artist ?? null };
}

/**
 * Open a production's work-folder stage (nagrywanie / obrobka / publikacja)
 * in the OS file manager. Server-side action because the dev/local-app model
 * means the server runs on the same machine as the user.
 *
 * Cross-platform launcher:
 *   - win32: `explorer.exe <path>`
 *   - darwin: `open <path>`
 *   - linux:  `xdg-open <path>`
 *
 * spawn() with `detached: true` so the child outlives the action call.
 */
export async function openProductionFolder(
  productionId: number,
  stage: WorkStage,
): Promise<Result> {
  if (!isValidStage(stage)) return { ok: false, error: `Nieznana faza: ${stage}` };

  const ctx = await loadProductionWithArtist(productionId);
  if (!ctx) return { ok: false, error: 'Brak produkcji' };
  if (!ctx.artist) {
    return {
      ok: false,
      error: 'Produkcja nie ma przypisanego artysty — przypisz artystę, by używać folderu roboczego',
    };
  }

  let target: string;
  try {
    const codes = (ctx.production.periods ?? []).map((p) => p.code);
    ensureWorkFolderStructure(
      ctx.artist.name,
      ctx.production.title,
      codes.length > 0 ? codes : ['T1', 'T2', 'T3'],
    );
    target = resolveSafeStagePath(ctx.artist.name, ctx.production.title, stage);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Nie można utworzyć folderu' };
  }
  if (!existsSync(target)) {
    return { ok: false, error: `Folder nie istnieje: ${target}` };
  }

  try {
    const { command, args } =
      process.platform === 'win32'
        ? { command: 'explorer.exe', args: [target] }
        : process.platform === 'darwin'
          ? { command: 'open', args: [target] }
          : { command: 'xdg-open', args: [target] };
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Nie udało się otworzyć folderu' };
  }
}

/** Lightweight RPC for the gantt — file counts per stage for badges. */
export async function getProductionFolderStats(
  productionId: number,
): Promise<{ stage: WorkStage; fileCount: number }[]> {
  const ctx = await loadProductionWithArtist(productionId);
  if (!ctx || !ctx.artist) return WORK_STAGES.map((stage) => ({ stage, fileCount: 0 }));
  return countWorkFolderFiles(ctx.artist.name, ctx.production.title);
}
