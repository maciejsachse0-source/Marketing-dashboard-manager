/**
 * Pięć przypadków statusu produkcji na osi czasu, użytych jako dowód w F2-03:
 * nowa, w połowie, z krokami własnymi, ukończona, bez kroków.
 *
 * Deterministyczny i idempotentny: kasuje produkcje o tytułach `F2-03 …`
 * i wstawia je od nowa, z T-0 zakotwiczonym na poniedziałku bieżącego tygodnia
 * plus siedem dni, żeby wszystkie pięć wierszy wpadło w domyślne okno
 * `/calendar?view=week` (okno startuje tydzień wstecz i obejmuje pięć tygodni).
 *
 * Uruchomienie: npx tsx scripts/seed-gantt-cases.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

import postgres from 'postgres';
import type { ProductionStage, ProductionStep } from '../drizzle/schema';

const CANONICALS: { id: string; category: ProductionStage; label: string }[] = [
  { id: 'email-sent', category: 'outreach', label: 'Mail wysłany' },
  { id: 'terms-accepted', category: 'outreach', label: 'Warunki zaakceptowane' },
  { id: 'cam-meeting-set', category: 'outreach', label: 'Spotkanie z kamerzystą' },
  { id: 'cam-date-shared', category: 'ustalenia', label: 'Data przekazana' },
  { id: 'script-discussed', category: 'ustalenia', label: 'Scenariusz omówiony' },
  { id: 'script-sent', category: 'ustalenia', label: 'Scenariusz wysłany' },
  { id: 'shooting', category: 'nagrywanie', label: 'Nagrywka' },
  { id: 'editing', category: 'obrobka', label: 'Obróbka' },
  { id: 'publishing', category: 'publikacja', label: 'Publikacja' },
];

/** `doneCount` pierwszych kanoników odhaczonych, reszta oczekująca. */
function canonicalSteps(doneCount: number, doneIso: string): ProductionStep[] {
  return CANONICALS.map((c, i) => ({
    id: c.id,
    category: c.category,
    label: c.label,
    doneAt: i < doneCount ? doneIso : null,
    ...(c.id === 'shooting' ? { isT0Anchor: true } : {}),
  }));
}

function customStep(
  id: string,
  category: ProductionStage,
  label: string,
  doneAt: string | null,
): ProductionStep {
  return { id, category, label, doneAt };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('brak DATABASE_URL');
  const sql = postgres(url, { max: 1 });

  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const t0 = new Date(monday);
  t0.setDate(t0.getDate() + 7);
  const doneIso = new Date(monday).toISOString();

  const cases: { title: string; steps: ProductionStep[] }[] = [
    { title: 'F2-03 nowa', steps: canonicalSteps(0, doneIso) },
    { title: 'F2-03 w polowie', steps: canonicalSteps(5, doneIso) },
    {
      title: 'F2-03 kroki wlasne',
      steps: [
        ...canonicalSteps(4, doneIso).slice(0, 6),
        customStep('cs-brief', 'ustalenia', 'Brief dla kamerzysty', doneIso),
        ...canonicalSteps(0, doneIso).slice(6),
        customStep('cs-napisy', 'obrobka', 'Napisy i korekta koloru', null),
      ],
    },
    { title: 'F2-03 ukonczona', steps: canonicalSteps(9, doneIso) },
    { title: 'F2-03 bez krokow', steps: [] },
  ];

  await sql`DELETE FROM productions WHERE title LIKE 'F2-03 %'`;
  for (const c of cases) {
    await sql`
      INSERT INTO productions (type, title, slug, t0_at, steps)
      VALUES ('solo', ${c.title}, ${c.title.toLowerCase().replace(/\s+/g, '-')},
              ${t0}, ${sql.json(c.steps as unknown as never)})
    `;
  }
  const rows = await sql`SELECT id, title FROM productions WHERE title LIKE 'F2-03 %' ORDER BY id`;
  console.log(`[seed-gantt-cases] T-0 = ${t0.toISOString()}`);
  for (const r of rows) console.log(`  #${r.id} ${r.title}`);
  await sql.end();
}

main();
