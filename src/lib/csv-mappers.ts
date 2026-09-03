import type { CsvSource, Platform } from '../../drizzle/schema';

export type NormalizedPost = {
  title: string;
  platform: Platform;
  publishedAt: Date;
  reach?: number;
  impressions?: number;
  engagementRate?: number;
  completionRate?: number;
  saves?: number;
  shares?: number;
  comments?: number;
  followersGained?: number;
};

/** Case-insensitive key lookup with multiple aliases. */
function pick(row: Record<string, unknown>, ...aliases: string[]): unknown {
  const lowered = aliases.map((a) => a.toLowerCase().trim());
  for (const k of Object.keys(row)) {
    const kl = k.toLowerCase().trim();
    if (lowered.includes(kl)) return row[k];
  }
  return undefined;
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[\s,%]/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function date(v: unknown): Date | undefined {
  if (!v) return undefined;
  const s = typeof v === 'string' ? v : String(v);
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d;
  // Try YYYY-MM-DD as date-only
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d2 = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
    if (Number.isFinite(d2.getTime())) return d2;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

/** Suma metryk zaangazowania; brakujaca metryka liczy sie jako zero. */
function engSum(...vals: (number | undefined)[]): number {
  return vals.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

/** Udzial a w b w procentach; puste albo niedodatnie b daje undefined. */
function pct(a: number, b: number | undefined): number | undefined {
  return !b || b <= 0 ? undefined : (a / b) * 100;
}

/** Procent obejrzenia materialu, przyciety do 100 i zaokraglony do pelnych. */
function watchedPct(part: number | undefined, whole: number | undefined): number | undefined {
  const p = pct(part ?? 0, whole);
  return p === undefined || !part ? undefined : Math.min(100, Math.round(p));
}

function round1(v: number | undefined): number | undefined {
  return v === undefined ? undefined : Math.round(v * 10) / 10;
}

function round0(v: number | undefined): number | undefined {
  return v === undefined ? undefined : Math.round(v);
}

function mapMetaRow(row: Record<string, unknown>): NormalizedPost | null {
  const title = str(pick(row, 'Title', 'Tytuł', 'Post Title', 'Description', 'Opis', 'Treść postu'));
  const publishedAt = date(pick(row, 'Posted', 'Date', 'Data publikacji', 'Publication Time', 'Czas publikacji', 'Posted at', 'Opublikowano'));
  if (!title || !publishedAt) return null;

  const reach = num(pick(row, 'Reach', 'Zasięg'));
  const impressions = num(pick(row, 'Impressions', 'Views', 'Wyświetlenia'));
  const reactions = num(pick(row, 'Reactions', 'Reakcje', 'Likes', 'Polubienia'));
  const comments = num(pick(row, 'Comments', 'Komentarze'));
  const shares = num(pick(row, 'Shares', 'Udostępnienia'));
  const saves = num(pick(row, 'Saves', 'Zapisane', 'Saved'));
  const followersGained = num(pick(row, 'Follows', 'New followers', 'Nowi obserwujący'));
  // Engagement rate: gdy CSV go nie podaje, liczymy go z zasiegu.
  const engagementRate =
    num(pick(row, 'Engagement rate', 'Wskaźnik zaangażowania', 'ER')) ??
    pct(engSum(reactions, comments, shares, saves), reach);

  // Platform: Meta CSVs cover IG/FB. Fall back to facebook unless permalink hints instagram.
  const permalink = str(pick(row, 'Permalink', 'URL', 'Link'));
  const platform: Platform = permalink && /instagram\.com/i.test(permalink) ? 'instagram' : 'facebook';

  return {
    title,
    platform,
    publishedAt,
    reach,
    impressions,
    engagementRate: round1(engagementRate),
    saves,
    shares,
    comments,
    followersGained,
  };
}

function mapTikTokRow(row: Record<string, unknown>): NormalizedPost | null {
  const title = str(pick(row, 'Video title', 'Title', 'Tytuł', 'Caption', 'Description'));
  const publishedAt = date(pick(row, 'Posted', 'Post time', 'Publish time', 'Date', 'Data'));
  if (!title || !publishedAt) return null;

  const views = num(pick(row, 'Video views', 'Views', 'Total views', 'Wyświetlenia'));
  const likes = num(pick(row, 'Like count', 'Likes', 'Polubienia'));
  const comments = num(pick(row, 'Comment count', 'Comments', 'Komentarze'));
  const shares = num(pick(row, 'Share count', 'Shares', 'Udostępnienia'));
  const avgWatch = num(pick(row, 'Average watch time', 'Avg watch time'));
  const totalPlay = num(pick(row, 'Total play time'));
  const reach = num(pick(row, 'Reach', 'Reached audience', 'Zasięg'));
  const followersGained = num(pick(row, 'New followers', 'Followers gained'));
  const duration = num(pick(row, 'Video duration', 'Duration'));

  // Wskaznik ukonczenia podany wprost wygrywa z policzonym ze sredniego czasu ogladania.
  const completionRate =
    num(pick(row, 'Completion rate', 'Wskaźnik ukończenia')) ?? watchedPct(avgWatch, duration);
  // ER dla TikToka: (polubienia + komentarze + udostepnienia) / wyswietlenia.
  const engagementRate = pct(engSum(likes, comments, shares), views);

  return {
    title,
    platform: 'tiktok',
    publishedAt,
    reach: reach ?? views,
    impressions: views,
    engagementRate: round1(engagementRate),
    completionRate: round0(completionRate),
    saves: undefined,
    shares,
    comments,
    followersGained,
  };
}

function mapYouTubeRow(row: Record<string, unknown>): NormalizedPost | null {
  // Skip totals/summary rows
  const content = str(pick(row, 'Content', 'Video', 'Title'));
  if (!content || /^total/i.test(content)) return null;

  const title = str(pick(row, 'Video title', 'Title', 'Tytuł', 'Content')) ?? content;
  const publishedAt = date(pick(row, 'Video publish time', 'Publish time', 'Date', 'Data publikacji'));
  if (!publishedAt) return null;

  const views = num(pick(row, 'Views', 'Wyświetlenia'));
  const watchHours = num(pick(row, 'Watch time (hours)', 'Watch time'));
  const ctr = num(pick(row, 'Impressions click-through rate (%)', 'CTR (%)', 'Click-through rate'));
  const subsGained = num(pick(row, 'Subscribers gained', 'New subscribers'));
  const likes = num(pick(row, 'Likes', 'Polubienia'));
  const comments = num(pick(row, 'Comments', 'Komentarze'));
  const shares = num(pick(row, 'Shares', 'Udostępnienia'));
  const avgViewDur = num(pick(row, 'Average view duration', 'Avg view duration'));
  const videoDur = num(pick(row, 'Video duration', 'Duration'));

  const completionRate = watchedPct(avgViewDur, videoDur);
  const engagementRate = pct(engSum(likes, comments, shares), views);

  return {
    title,
    platform: 'youtube',
    publishedAt,
    reach: views,
    impressions: views,
    engagementRate: round1(engagementRate),
    completionRate: round0(completionRate),
    shares,
    comments,
    followersGained: subsGained,
  };
}

export function normalizeRow(source: CsvSource, row: Record<string, unknown>): NormalizedPost | null {
  if (source === 'meta') return mapMetaRow(row);
  if (source === 'tiktok') return mapTikTokRow(row);
  if (source === 'youtube') return mapYouTubeRow(row);
  return null;
}

/** Levenshtein-ish similarity (cheap normalised hamming-ish). */
function titleSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const nb = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  // Substring shortcut
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  // Token overlap
  const ta = new Set(na.split(/\W+/).filter((t) => t.length > 2));
  const tb = new Set(nb.split(/\W+/).filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

export function isLikelyMatch(
  candidate: { title: string; platform: Platform; publishedAt: Date },
  existing: { title: string; platform: Platform; publishedAt: Date },
): boolean {
  if (candidate.platform !== existing.platform) return false;
  const dt = Math.abs(candidate.publishedAt.getTime() - existing.publishedAt.getTime());
  if (dt > 60 * 60 * 1000) return false; // > 1h apart
  const sim = titleSimilarity(candidate.title, existing.title);
  return sim >= 0.7;
}
