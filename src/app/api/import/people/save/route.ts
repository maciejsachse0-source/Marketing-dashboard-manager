/**
 * Zapis importu osób (plan/04 sekcja 2, kroki 6 i 7).
 *
 * Odpowiedź jest strumieniem NDJSON, bo krok 6 wymaga licznika faktycznie
 * zapisanych paczek, a jedno wywołanie server action nie ma jak go pokazać.
 * Cały zapis siedzi w jednej transakcji: linia postępu wychodzi po zapisie
 * paczki, a gdy cokolwiek padnie, transakcja wycofuje wszystko i ostatnia
 * linia strumienia niesie błąd.
 *
 * Granica zaufania (Z13): wiersze przychodzą z przeglądarki, więc schemat Zod
 * sprawdza kształt, a `dryRun` liczy plan od zera na serwerze. To, co policzyła
 * przeglądarka, jest wyłącznie podglądem.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSessionEmail } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { dryRun } from '@/lib/import/dry-run';
import { PERSON_FIELDS } from '@/lib/import/mapping';
import { IMPORT_LIMITS } from '@/lib/import/limits';
import { savePlans } from '@/lib/import/save';
import { existingPeople } from '@/lib/import/existing';

export const runtime = 'nodejs';
// F7-41: trasa czyta ciało żądania i pisze do bazy, nie ma czego wyliczyć przy budowaniu.
export const dynamic = 'force-dynamic';

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const saveSchema = z.object({
  role: z.enum(['artist', 'videographer']),
  policy: z.enum(['skip', 'update']),
  mapping: z.array(z.enum(PERSON_FIELDS).nullable()).max(IMPORT_LIMITS.maxColumns),
  rows: z.array(z.array(cell).max(IMPORT_LIMITS.maxColumns)).max(IMPORT_LIMITS.maxRows),
});

function line(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

export async function POST(req: NextRequest) {
  const email = await getSessionEmail();
  if (!email) return Response.json({ error: 'Brak sesji' }, { status: 401 });

  const parsed = saveSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: 'Nieprawidłowe dane importu' }, { status: 400 });
  }
  const { role, policy, mapping, rows } = parsed.data;

  const existing = await existingPeople(db, schema);
  const plan = dryRun(rows, mapping, role, existing, policy);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const counts = await db.transaction((tx) =>
          savePlans(tx, role, plan.plans, (done, total) =>
            controller.enqueue(line({ batch: done, of: total })),
          ),
        );
        controller.enqueue(line({ done: true, ...counts, errors: plan.errors }));
      } catch (err) {
        controller.enqueue(
          line({
            error: err instanceof Error ? err.message : String(err),
            rows: plan.plans.length,
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
