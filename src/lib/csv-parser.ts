import Papa from 'papaparse';
import type { CsvSource } from '../../drizzle/schema';

export function parseCsvBuffer(text: string): Record<string, unknown>[] {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  return result.data;
}

const META_HINTS = ['post id', 'reach', 'page name', 'permalink', 'impressions'];
const TIKTOK_HINTS = ['video views', 'avg. watch time', 'for you', 'total play time'];
const YT_HINTS = ['youtube', 'subscribers', 'watch time (hours)', 'impressions click-through rate'];

export function detectCsvSource(text: string): CsvSource | null {
  const head = text.slice(0, 2000).toLowerCase();
  const score = (hints: string[]) => hints.reduce((n, h) => n + (head.includes(h) ? 1 : 0), 0);

  const m = score(META_HINTS);
  const t = score(TIKTOK_HINTS);
  const y = score(YT_HINTS);

  const max = Math.max(m, t, y);
  if (max === 0) return null;
  if (m === max) return 'meta';
  if (t === max) return 'tiktok';
  return 'youtube';
}
