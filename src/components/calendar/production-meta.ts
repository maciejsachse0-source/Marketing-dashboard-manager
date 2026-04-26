import type {
  Platform,
  ProductionStatus,
  ProductionType,
} from '../../../drizzle/schema';

/**
 * Lightweight production meta passed to calendar tiles. Includes the resolved
 * artist + videographer so the tile can show "↳ Świt · T-7 · @ania_test"
 * inline without extra round trips on the client.
 */
export type ProductionMeta = {
  id: number;
  title: string;
  slug: string;
  status: ProductionStatus;
  type: ProductionType;
  t0At: Date;
  platforms: Platform[] | null;
  folderPath: string | null;
  artistName: string | null;
  artistHandle: string | null;
  videographerName: string | null;
};

/**
 * Day offset from production T-0. Returns "T-0" / "T-7" / "T+12" or null
 * when production has no T-0 reference.
 */
export function tOffsetLabel(entryStartsAt: Date, t0At: Date): string {
  const ms = entryStartsAt.getTime() - t0At.getTime();
  const days = Math.round(ms / 86_400_000);
  if (days === 0) return 'T-0';
  if (days > 0) return `T+${days}`;
  return `T-${Math.abs(days)}`;
}
