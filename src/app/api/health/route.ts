import { getSessionEmail } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
// F7-41: trasa czyta ciało żądania i pisze do bazy, nie ma czego wyliczyć przy budowaniu.
export const dynamic = 'force-dynamic';

/**
 * Znacznik tożsamości serwera (F7-18). Odpowiada nazwą bazy, na której ten proces
 * naprawdę stoi, żeby `e2e/global-setup.ts` mógł odmówić przebiegu, gdy port 3000
 * trzyma cudzy serwer z cudzą bazą (`npm run perf:serve` na `marketing_perf`).
 *
 * Granica zaufania (Z13): brak wejścia, więc nie ma czego walidować. Odpowiedź jest
 * za `getSessionEmail`, bo sama nazwa bazy nie jest sekretem, ale nie ma powodu
 * rozdawać jej komukolwiek. Nazwa czytana z `DATABASE_URL`, bez zapytania do bazy —
 * to ma być tani znacznik, nie kolejny odczyt.
 *
 * F7-28: razem z bazą oddaje `dev` — czy to `next dev` (kod bez optymalizacji),
 * czy `next start`. Scenariusze wydajnościowe pomijają pomiar na serwerze
 * deweloperskim, bo mierzyłyby narzędzie, nie aplikację.
 */
export async function GET() {
  if (!(await getSessionEmail())) {
    return Response.json({ error: 'brak sesji' }, { status: 401 });
  }
  return Response.json({
    db: new URL(env.DATABASE_URL).pathname.slice(1),
    dev: process.env.NODE_ENV !== 'production',
  });
}
