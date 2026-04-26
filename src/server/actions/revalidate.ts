import { revalidatePath as nextRevalidatePath } from 'next/cache';

/**
 * Calls Next's revalidatePath — but silently no-ops when run outside a request
 * (e.g. from `tsx` scripts used by Claude Code agents). Inside Next handlers it
 * behaves identically to the original.
 */
export function safeRevalidatePath(path: string) {
  try {
    nextRevalidatePath(path);
  } catch {
    /* outside Next request context — no UI to revalidate */
  }
}
