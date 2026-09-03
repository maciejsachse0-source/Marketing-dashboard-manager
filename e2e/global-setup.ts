import { buildSessionToken, AUTH_COOKIE } from '../src/lib/auth-token';

/**
 * F7-18: `reuseExistingServer: true` po cichu bierze cokolwiek stoi na porcie 3000.
 * Gdy jest to `npm run perf:serve` (build produkcyjny na bazie `marketing_perf`),
 * testy padają z komunikatami sugerującymi regresję, a naprawdę mówią tylko tyle,
 * że baza nie ma danych. To sprawdzenie pyta serwer, na jakiej bazie stoi, i przerywa
 * przebieg, gdy odpowiedź nie zgadza się z bazą z `DATABASE_URL` runnera.
 *
 * Nazwę bierzemy z `/api/health`, endpoint jest za sesją, więc podpisujemy ciasteczko
 * tym samym sekretem co aplikacja zamiast logować się przez przeglądarkę — logowanie
 * kosztowałoby start chromium, a całe sprawdzenie ma się zmieścić w ułamku sekundy.
 */
async function globalSetup() {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const oczekiwana = process.env.E2E_EXPECTED_DB ?? new URL(process.env.DATABASE_URL!).pathname.slice(1);
  const email = process.env.AUTH_EMAIL;
  if (!email) throw new Error('AUTH_EMAIL musi być w .env.local');

  let odpowiedz: Response;
  try {
    odpowiedz = await fetch(`${base}/api/health`, {
      headers: { cookie: `${AUTH_COOKIE}=${buildSessionToken(email)}` },
      redirect: 'manual',
    });
  } catch {
    return; // Nikt nie słucha — playwright zaraz sam wystartuje `npm run dev`.
  }

  if (!odpowiedz.ok) {
    throw new Error(
      `Na ${base} stoi serwer, który nie odpowiada na /api/health (status ${odpowiedz.status}).\n` +
        'To najpewniej starszy build albo cudzy proces. Ubij go i puść `npm run dev` albo `npx next start`.'
    );
  }

  const { db } = (await odpowiedz.json()) as { db: string };
  if (db !== oczekiwana) {
    throw new Error(
      `Serwer na ${base} stoi na bazie "${db}", a testy zakładają "${oczekiwana}".\n` +
        'Najczęstsza przyczyna: na porcie trzyma `npm run perf:serve` (baza marketing_perf).\n' +
        'Ubij ten proces (`lsof -nP -iTCP:3000 -sTCP:LISTEN`) i puść `npm run dev`,\n' +
        'albo wskaż inną bazę przez E2E_EXPECTED_DB.'
    );
  }
}

export default globalSetup;
