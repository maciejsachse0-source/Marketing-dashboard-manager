# NEXT-TASKS — przekazanie do kolejnego workera

Stan na 2026-09-02, po paczce F0-00 do F0-04.

## Następne issue

**F0-05** `perf` `tooling` ⚠ HARD — Harness, część druga: strony, dev, raport, baseline.
CZYTAJ: `plan/03-wydajnosc.md` sekcje 1.1, 1.3, 3 i 4, `src/proxy.ts`.

Pozostałe w fazie F0, w kolejności: **F0-05**, **F0-06**, **F0-07**.

## Co już stoi i działa

Wszystkie pięć issues z poprzedniej paczki odhaczone w `plan/08-BACKLOG.md`
z dowodami, commit per issue (`4b01a8a`, `6f61121`, `f75ebd1`, `81aa1d7`, `b4d06ee`).

Komendy, które są sprawne i kończą się kodem 0:
`npm run build`, `npm run dev`, `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run e2e`, `npm run pg:info`, `node scripts/perf/measure-db.mjs`,
`node scripts/perf/table-counts.mjs`, `npx tsx scripts/perf/seed-large.ts`.
`npm run perf` jeszcze NIE istnieje, powstaje w F0-05 razem z `measure-page.mjs`,
`measure-dev.mjs` i `report.mjs`.

## Stan środowiska

- **Baza to kontener Docker, nie hosting.** `mc-pg`, obraz `postgres:17`, port hosta
  **5433**, user `postgres`, hasło `mc`. Trzy bazy: `marketing` (robocza),
  `marketing_perf` (pomiarowa, ma zestaw L), `marketing_test` (testowa, pusta).
  **Przed pracą wstaw kontener:** `docker start mc-pg`. Powód wyboru i jego wpływ
  na wiarygodność liczb: `DECISIONS.md`, wpis F0-01.
- `.env.local` istnieje, jest poza gitem, niesie komplet zmiennych.
- Zestaw L jest zasiany w `marketing_perf`: 200 / 60 / 40 / 500 / 3000 / 5000 / 20 / 12000.
  `perf/fixtures-ids.json` ma `productionId: 1` i `campaignId: 1`, więc URL-e
  `/productions/1` i `/campaigns/1` dla F0-05 są gotowe.
- `perf/runs/` jest w `.gitignore`, `perf/fixtures-ids.json` jest w repo.
- ESLint stoi na **9.39.5**, nie na 10. Wersja 10 wysypuje `eslint-plugin-react`
  wbudowany w `eslint-config-next@16.2.4` (`contextOrFilename.getFilename is not
  a function`). Nie podnoś ESLinta bez sprawdzenia tego ponownie.
- `psql` nadal nie istnieje. Do bazy albo przez `postgres-js`, albo przez
  `docker exec mc-pg psql -U postgres -d <baza>`.

## Pułapki, na które już wdepnąłem

1. **Nie mierz na zimno.** Pierwszy przebieg `measure-db.mjs` po bezczynności był
   systematycznie wolniejszy od kolejnych (p50 1,86 wobec 1,48 ms), co wywalało
   kryterium powtarzalności na 33%. Rozwiązane rozgrzewką adaptacyjną wewnątrz
   skryptu. `measure-page.mjs` z F0-05 dostanie ten sam problem w większej skali,
   bo dochodzi kompilacja stron. Zaplanuj rozgrzewkę **per URL**, nie globalną.
2. **Playwright i server actions.** Kliknięcie „Zaloguj" i natychmiastowe
   `page.goto('/calendar')` przegrywa wyścig z przekierowaniem, a proxy odbija
   z powrotem na `/login`. Co gorsza `/calendar` odpowiada wtedy **200**, bo
   przeglądarka poszła za przekierowaniem, więc sam status niczego nie dowodzi.
   Sprawdzaj też `pathname`. To samo dotyczy `measure-page.mjs`: po `POST /login`
   trzeba zapamiętać ciasteczko i NIE iść za przekierowaniem.
3. **Nawiasy kwadratowe w `eslint.config.mjs`.** `src/app/campaigns/[id]/page.tsx`
   w polu `files` jest czytane jako klasa znaków globa i nie pasuje do niczego.
   Trzeba escapować: `src/app/campaigns/\\[id\\]/page.tsx`.
4. **Banner `dotenv` leci na stdout** i psuje parsowanie wyjścia `--json`.
   Wszystkie skrypty wołają `config({ quiet: true })`.
5. **`next build` używa Turbopacka**, mimo że `npm run dev` stoi na webpacku.
   Flaga `--webpack` jest w Next 16.2.4 nadal wspierana, więc F2-05 ma sens.

## Decyzje w toku, nic nie blokuje

- `DATABASE_URL` do prawdziwej bazy od usera nadal nie ma. Gdy się pojawi, baseline
  z F0-05 trzeba przemierzyć od nowa i zapisać z innym polem `mode`, bo liczby
  z lokalnego Dockera nie zawierają RTT do bazy zdalnej.
- Plik `.xlsx` z osobami (F4-06) nadal nie dostarczony, poza ścieżką krytyczną.
- `docs/ARCHITEKTURA.md` (F0-06) wymaga potwierdzenia hostingu przez usera,
  to jest bramka w DoD F0.

## Znaleziska dopisane do F7

**F7-01** do **F7-07**, wszystkie z ESLinta uruchomionego pierwszy raz w F0-02.
Ważne: F7-01 (11 x `set-state-in-effect`), F7-02 (6 x `purity`, w tym w gancie),
F7-06 (63 funkcje ponad progiem złożoności). Drobne: F7-03, F7-04, F7-05, F7-07.
Blokujących nie ma.
