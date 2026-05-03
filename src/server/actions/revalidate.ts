import { revalidatePath as nextRevalidatePath } from 'next/cache';

/**
 * Calls Next's revalidatePath — but silently no-ops when run outside a request
 * (e.g. from `tsx` scripts used by Claude Code agents). Inside Next handlers it
 * behaves identically to the original.
 */
export function safeRevalidatePath(path: string) {
  try {
    nextRevalidatePath(path);
  } catch (err) {
    // Tolerate the "no static generation store" path — that's the expected
    // case when called from a tsx script, not a real failure. Anything else
    // is a real revalidate problem (Next runtime regression, malformed path)
    // and silently swallowing it would mask stale-UI bugs.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('static generation store')) return;
    console.warn(`[revalidate] failed for ${path}:`, err);
  }
}
