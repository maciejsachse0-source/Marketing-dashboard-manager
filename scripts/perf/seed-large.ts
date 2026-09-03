/**
 * Zestaw L, generator. Wypełnia bazę wskazaną przez PERF_DATABASE_URL liczbami
 * wierszy z plan/03-wydajnosc.md sekcja 2. Deterministyczny: ziarno 1337, zero
 * Math.random(), więc dwa przebiegi na czystej bazie dają identyczne dane.
 *
 * Uruchomienie: npx tsx scripts/perf/seed-large.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import postgres from 'postgres';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const SEED = 1337;

const COUNTS = {
  artists: 200,
  videographers: 60,
  campaigns: 40,
  productions: 500,
  calendarEntries: 3000,
  posts: 5000,
  csvUploads: 20,
  csvRows: 12000,
  // Katalogi. Bez nich strony /templates i /agents renderowały pustkę, więc krok
  // P3 (cache katalogów) nie miał czego mierzyć — znalezisko F7-10.
  productionTemplates: 5,
  marketingTemplates: 5,
  agents: 6,
} as const;

// ---------------------------------------------------------------------------
// Losowość z ziarnem. mulberry32: 32 bity stanu, jedna linia, ten sam ciąg na
// każdej maszynie. Math.random() nie da się zasiać, więc go tu nie ma.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: readonly T[]): T => arr[int(0, arr.length - 1)];
const chance = (p: number) => rand() < p;

// Polskie znaki są w części imion celowo: sortowanie i LIKE po tekście z ogonkami
// zachowują się inaczej niż po czystym ASCII, a mierzymy realny kształt danych.
const FIRST = [
  'Anna', 'Bartek', 'Celina', 'Damian', 'Ewa', 'Filip', 'Gabriela', 'Hubert',
  'Iwona', 'Jakub', 'Kamila', 'Łukasz', 'Małgorzata', 'Norbert', 'Olga', 'Paweł',
  'Renata', 'Sławek', 'Śnieżana', 'Tomasz', 'Urszula', 'Wiktor', 'Zofia', 'Żaneta',
];
const LAST = [
  'Nowak', 'Kowalski', 'Wiśniewska', 'Wójcik', 'Kowalczyk', 'Kamiński', 'Lewandowska',
  'Zieliński', 'Szymańska', 'Woźniak', 'Dąbrowski', 'Kozłowska', 'Jankowski',
  'Mazur', 'Krawczyk', 'Piotrowska', 'Grabowski', 'Pawłowska', 'Michalski', 'Król',
];
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin'] as const;
const CALENDAR_TYPES = ['shoot', 'edit', 'publish', 'meeting', 'deadline'] as const;
const CALENDAR_STATUSES = ['planned', 'done', 'cancelled'] as const;
const CAMPAIGN_PHASES = ['build-up', 'teaser', 'reveal', 'release', 'afterglow', 'done'] as const;
const STAGES = ['outreach', 'ustalenia', 'nagrywanie', 'obrobka', 'publikacja'] as const;
const CSV_SOURCES = ['meta', 'tiktok', 'youtube'] as const;

/** Punkt zero osi czasu. Data stała, nie `new Date()`, inaczej generator
 *  przestałby być deterministyczny między dniami. */
const T0 = new Date('2026-01-05T09:00:00.000Z').getTime();
const DAY = 86_400_000;
const at = (days: number, hour = 9) => new Date(T0 + days * DAY + hour * 3_600_000);

function personName(): string {
  return `${pick(FIRST)} ${pick(LAST)}`;
}

function slugify(s: string, i: number): string {
  const base = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}-${i}`;
}

function buildSteps(count: number, t0: Date) {
  const steps = [];
  for (let i = 0; i < count; i++) {
    const category = STAGES[Math.min(Math.floor((i / count) * STAGES.length), STAGES.length - 1)];
    steps.push({
      id: `s${i}`,
      category,
      label: `${category} ${i + 1}`,
      doneAt: chance(0.4) ? new Date(t0.getTime() - int(1, 20) * DAY).toISOString() : null,
      dateMode: 'record',
      isT0Anchor: category === 'nagrywanie' && i % 3 === 0 ? true : undefined,
    });
  }
  return steps;
}

/** 70% postow ma metryki, zgodnie z plan/03 sekcja 2. Osobna funkcja, bo osiem
 *  pol warunkowych w jednym literale obiektu podbija zlozonosc arrow-a ponad
 *  prog 10 z Z11, a to jest NOWY kod, wiec progu nie wolno mu przekroczyc. */
function postMetrics() {
  if (!chance(0.7)) {
    return {
      reach: null, impressions: null, engagement_rate: null, completion_rate: null,
      saves: null, shares: null, comments: null, followers_gained: null,
    };
  }
  return {
    reach: int(200, 250000),
    impressions: int(300, 400000),
    engagement_rate: int(1, 1500) / 100,
    completion_rate: int(1, 9900) / 100,
    saves: int(0, 4000),
    shares: int(0, 3000),
    comments: int(0, 900),
    followers_gained: int(0, 1200),
  };
}

/** Wstawia wiersze paczkami. Jedno `insert ... values` na 500 wierszy zamiast
 *  12 000 pojedynczych round-tripów. */
async function insertChunked(
  sql: postgres.Sql,
  table: string,
  rows: Array<Record<string, unknown>>,
  size = 500,
): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < rows.length; i += size) {
    // postgres-js opisuje `sql(rows)` typem warunkowym, ktorego nie da sie
    // spelnic heterogenicznym Record<string, unknown>. Rzutowanie jest tu,
    // w jednym miejscu, zamiast rozlewac sie po kazdym wywolaniu.
    const chunk = rows.slice(i, i + size) as never;
    const out = await sql`insert into ${sql(table)} ${sql(chunk)} returning id`;
    for (const r of out) ids.push(r.id as number);
  }
  return ids;
}

/** Jak `insertChunked`, ale dla tabel z kluczem tekstowym (`slug`), które nie
 *  mają kolumny `id`, więc nie ma czego zwracać. */
async function insertChunkedNoIds(
  sql: postgres.Sql,
  table: string,
  rows: Array<Record<string, unknown>>,
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size) as never;
    await sql`insert into ${sql(table)} ${sql(chunk)}`;
  }
}

const SIDE_PANELS = ['calendar-14', 'recent-posts', 'artists-list', 'active-campaigns', 'trend-bookmarks'] as const;
const WIDGET_KINDS = ['stale-artists', 'upcoming-campaigns', 'overdue-calendar-entries', 'recent-csv-uploads'] as const;

/** Trzy okresy T1/T2/T3 po siedem dni, licząc od startu. */
const PERIODS_3 = [
  { code: 'T1', startOffsetDays: 0, endOffsetDays: 6 },
  { code: 'T2', startOffsetDays: 7, endOffsetDays: 13 },
  { code: 'T3', startOffsetDays: 14, endOffsetDays: 20 },
];

/** Kroki szablonu produkcji — ten sam kształt, co `TemplateStep`. */
function templateSteps(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const category = STAGES[Math.min(Math.floor((i / count) * STAGES.length), STAGES.length - 1)];
    return {
      id: `ts${i}`,
      category,
      label: `${category} ${i + 1}`,
      description: `Opis kroku ${i + 1}`,
      dateMode: 'record',
      durationMinutes: 60,
    };
  });
}

/** Kamienie milowe szablonu kampanii — kształt `MarketingMilestone`. */
function templateMilestones(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    period: PERIODS_3[i % PERIODS_3.length].code,
    label: `Kamień ${i + 1}`,
    description: `Opis kamienia ${i + 1}`,
    submilestones: Array.from({ length: 3 }, (_, j) => ({
      id: `m${i}s${j}`,
      label: `Podkrok ${j + 1}`,
    })),
  }));
}

async function main() {
  const perfUrl = process.env.PERF_DATABASE_URL;
  const workUrl = process.env.DATABASE_URL;

  if (!perfUrl) {
    console.error('[seed-large] PERF_DATABASE_URL nie jest ustawiony');
    process.exit(1);
  }
  // Bez tego jedno przeoczenie w .env.local wsypuje 500 syntetycznych produkcji
  // do bazy roboczej usera. Sprawdzenie jest PRZED jakimkolwiek zapisem.
  if (workUrl && perfUrl === workUrl) {
    console.error('[seed-large] PERF_DATABASE_URL jest rowny DATABASE_URL, odmawiam zapisu');
    process.exit(1);
  }

  const sql = postgres(perfUrl, { max: 1, prepare: false });

  console.log('[seed-large] czyszczenie bazy pomiarowej');
  await sql`truncate table posts, csv_rows, csv_uploads, calendar_entries, productions,
            campaigns, videographers, artists restart identity cascade`;
  await sql`truncate table production_templates, marketing_templates, agents cascade`;

  console.log(`[seed-large] artists: ${COUNTS.artists}`);
  const artistIds = await insertChunked(
    sql,
    'artists',
    Array.from({ length: COUNTS.artists }, (_, i) => {
      const name = personName();
      return {
        name,
        handle: chance(0.75) ? `@${slugify(name, i)}` : null,
        email: chance(0.6) ? `${slugify(name, i)}@example.pl` : null,
        phone: chance(0.4) ? `+48${int(500000000, 899999999)}` : null,
        notes: chance(0.3) ? 'notatka testowa' : null,
        last_contact_at: chance(0.5) ? at(-int(1, 300)) : null,
        created_at: at(-int(300, 700)),
      };
    }),
  );

  console.log(`[seed-large] videographers: ${COUNTS.videographers}`);
  const videographerIds = await insertChunked(
    sql,
    'videographers',
    Array.from({ length: COUNTS.videographers }, (_, i) => {
      const name = personName();
      return {
        name,
        contact: chance(0.7) ? `${slugify(name, i)}@kamera.pl` : null,
        hourly_rate: chance(0.8) ? int(80, 400) : null,
        equipment: chance(0.6) ? 'Sony FX3, 24-70' : null,
        availability_notes: chance(0.5) ? null : 'weekendy',
        created_at: at(-int(300, 700)),
      };
    }),
  );

  console.log(`[seed-large] campaigns: ${COUNTS.campaigns}`);
  // 40 kampanii rozłożonych na 18 miesięcy, czyli ok. 548 dni.
  const campaignIds = await insertChunked(
    sql,
    'campaigns',
    Array.from({ length: COUNTS.campaigns }, (_, i) => ({
      name: `Kampania ${i + 1}`,
      goal: `Cel kampanii ${i + 1}`,
      release_at: at(Math.round((i / COUNTS.campaigns) * 548) - 274),
      phase: pick(CAMPAIGN_PHASES),
      kpis: sql.json({ reach: int(10000, 500000), engagement: int(1, 12) }),
      notes: chance(0.5) ? 'notatka kampanii' : null,
      created_at: at(-int(300, 600)),
    })),
  );

  console.log(`[seed-large] productions: ${COUNTS.productions}`);
  const productionIds = await insertChunked(
    sql,
    'productions',
    Array.from({ length: COUNTS.productions }, (_, i) => {
      const title = `Produkcja ${i + 1}`;
      const t0 = at(int(-270, 270));
      return {
        type: chance(0.8) ? 'with-artist' : 'solo',
        title,
        slug: slugify(title, i),
        t0_at: t0,
        steps: sql.json(buildSteps(int(6, 14), t0)),
        // 20% bez artysty, 15% bez kampanii, zgodnie z plan/03 sekcja 2.
        artist_id: chance(0.8) ? pick(artistIds) : null,
        videographer_id: chance(0.7) ? pick(videographerIds) : null,
        campaign_id: chance(0.85) ? pick(campaignIds) : null,
        platforms: sql.json([pick(PLATFORMS)]),
        cancelled_at: chance(0.05) ? at(int(-200, 0)) : null,
        created_at: at(-int(1, 400)),
      };
    }),
  );

  console.log(`[seed-large] calendar_entries: ${COUNTS.calendarEntries}`);
  await insertChunked(
    sql,
    'calendar_entries',
    Array.from({ length: COUNTS.calendarEntries }, (_, i) => {
      const starts = at(int(-270, 270), int(7, 19));
      // 60% powiązanych z produkcją, zgodnie z plan/03 sekcja 2.
      const linked = chance(0.6);
      return {
        type: pick(CALENDAR_TYPES),
        title: `Wpis ${i + 1}`,
        description: chance(0.4) ? 'opis wpisu' : null,
        starts_at: starts,
        ends_at: new Date(starts.getTime() + int(1, 6) * 3_600_000),
        platforms: sql.json([pick(PLATFORMS)]),
        artist_id: chance(0.5) ? pick(artistIds) : null,
        campaign_id: chance(0.5) ? pick(campaignIds) : null,
        production_id: linked ? pick(productionIds) : null,
        stage: linked ? pick(STAGES) : null,
        status: pick(CALENDAR_STATUSES),
        created_at: at(-int(1, 400)),
      };
    }),
  );

  console.log(`[seed-large] csv_uploads: ${COUNTS.csvUploads}, csv_rows: ${COUNTS.csvRows}`);
  const perUpload = COUNTS.csvRows / COUNTS.csvUploads;
  const uploadIds = await insertChunked(
    sql,
    'csv_uploads',
    Array.from({ length: COUNTS.csvUploads }, (_, i) => ({
      filename: `export-${i + 1}.csv`,
      source: pick(CSV_SOURCES),
      uploaded_at: at(-int(1, 400)),
      row_count: perUpload,
    })),
  );

  const csvRowIds = await insertChunked(
    sql,
    'csv_rows',
    Array.from({ length: COUNTS.csvRows }, (_, i) => ({
      upload_id: uploadIds[Math.floor(i / perUpload)],
      data: sql.json({ reach: int(100, 90000), plays: int(100, 200000), row: i }),
    })),
  );

  console.log(`[seed-large] posts: ${COUNTS.posts}`);
  await insertChunked(
    sql,
    'posts',
    Array.from({ length: COUNTS.posts }, (_, i) => ({
      published_at: at(int(-400, 30), int(6, 22)),
      platform: pick(PLATFORMS),
      title: `Post ${i + 1}`,
      caption: `Opis posta ${i + 1}`,
      hashtags: sql.json(['#short', '#video']),
      campaign_id: chance(0.7) ? pick(campaignIds) : null,
      production_id: chance(0.6) ? pick(productionIds) : null,
      ...postMetrics(),
      raw_csv_row_id: chance(0.5) ? pick(csvRowIds) : null,
      created_at: at(-int(1, 400)),
    })),
  );

  console.log(
    `[seed-large] katalogi: production_templates ${COUNTS.productionTemplates}, ` +
      `marketing_templates ${COUNTS.marketingTemplates}, agents ${COUNTS.agents}`,
  );
  await insertChunkedNoIds(
    sql,
    'production_templates',
    Array.from({ length: COUNTS.productionTemplates }, (_, i) => ({
      slug: `szablon-produkcji-${i + 1}`,
      name: `Szablon produkcji ${i + 1}`,
      type: i % 2 === 0 ? 'with-artist' : 'solo',
      summary: `Skrót szablonu ${i + 1}`,
      description: `Opis szablonu produkcji ${i + 1}`,
      steps: sql.json(templateSteps(9 + i)),
      periods: sql.json(PERIODS_3),
      created_at: at(-int(1, 400)),
      updated_at: at(-int(1, 200)),
    })),
  );

  await insertChunkedNoIds(
    sql,
    'marketing_templates',
    Array.from({ length: COUNTS.marketingTemplates }, (_, i) => ({
      slug: `szablon-kampanii-${i + 1}`,
      name: `Szablon kampanii ${i + 1}`,
      summary: `Skrót szablonu kampanii ${i + 1}`,
      description: `Opis szablonu kampanii ${i + 1}`,
      periods: sql.json(PERIODS_3),
      milestones: sql.json(templateMilestones(4 + i)),
      created_at: at(-int(1, 400)),
      updated_at: at(-int(1, 200)),
    })),
  );

  await insertChunkedNoIds(
    sql,
    'agents',
    Array.from({ length: COUNTS.agents }, (_, i) => ({
      slug: `agent-${i + 1}`,
      name: `Agent ${i + 1}`,
      description: `Co robi agent ${i + 1} i kiedy go uruchomić.`,
      system_prompt: `Jesteś agentem numer ${i + 1}.\n`.repeat(40),
      side_panel: SIDE_PANELS[i % SIDE_PANELS.length],
      dashboard_widget: sql.json({
        kind: WIDGET_KINDS[i % WIDGET_KINDS.length],
        days: 14,
        template: `Wynik: {{count}}`,
      }),
      created_at: at(-int(1, 400)),
      updated_at: at(-int(1, 200)),
    })),
  );

  // Harness z F0-05 składa z tego URL-e /productions/<id> i /campaigns/<id>.
  // Bierzemy pierwsze id, a nie losowe, żeby plik też był deterministyczny.
  const fixtures = {
    seed: SEED,
    generatedFrom: 'scripts/perf/seed-large.ts',
    productionId: productionIds[0],
    campaignId: campaignIds[0],
    artistId: artistIds[0],
  };
  const outPath = 'perf/fixtures-ids.json';
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(fixtures, null, 2) + '\n');
  console.log(`[seed-large] zapisano ${outPath}:`, fixtures);

  await sql.end();
  console.log('[seed-large] gotowe');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
