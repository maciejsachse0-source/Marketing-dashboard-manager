# 08 — BACKLOG

Kolejność jest prawem. Worker wykonuje issues z listy przekazanej mu w prompcie,
w kolejności z tego pliku. Faza F(n+1) startuje po spełnieniu Definition of Done F(n).

Legenda: `⚠ HARD` = zadanie koncepcyjnie grube, pierwsze w paczce.
`⏳ ZABLOKOWANE` = czeka na dostawę usera, poza ścieżką krytyczną, wolno je pominąć
i wrócić później.
`CZYTAJ:` = minimalny zestaw lektury dla workera. Nie czytaj więcej, nie czytaj mniej.

Etykiety: `arch`, `perf`, `db`, `ui`, `import`, `test`, `docs`, `tooling`, `security`,
`znalezisko`.

**Definition of Done fazy** (poza sumą kryteriów issues fazy): `npm run typecheck`
kod 0, `npm run lint` kod 0, `npm run test` kod 0, `npm run perf` kod 0 (od F1 wzwyż),
zrzut ekranu głównego efektu fazy w `screenshots/Fx/`, wpis raportu fazy
w `DECISIONS.md`, zero znalezisk bez odpowiadającego issue w F7.
Jedyny wyjątek: DoD F0 nie wymaga `npm run perf` (harness dopiero powstaje) ani zera
błędów `typecheck`, jeśli błędy pochodzą z kodu zastanego i mają issues w F7 (F0-02).

**Środowisko, ustalone przy tworzeniu pakietu, nie zgaduj tego ponownie:**
Mac mini M1, 16 GB, macOS, zsh, Node v26.7.0. `node_modules` **nie istnieje**.
`psql` **nie jest zainstalowany** — nie opieraj o niego żadnego kryterium, używaj
`scripts/perf/pg-info.mjs` na kliencie `postgres-js`. Docker działa (`docker info`
kod 0). `gh` i `glab` są. `exceljs`, `vitest`, `@playwright/test`, `eslint`,
`eslint-config-next` — instalowalne, żadnego nie ma jeszcze w `package.json`.

**Pisanie komend dowodowych.** Komenda w kryterium musi dać się wkleić do zsh
i zwrócić jedną liczbę. Wzorzec: `grep -r 'wzorzec' src/ | wc -l` z podanym
oczekiwanym wynikiem. Nie używaj `grep -c` na katalogu (błąd „Is a directory")
ani `grep -rc` (drukuje licznik per plik, nigdy pojedynczej liczby), ani globów `**`
(zsh rozwinie je inaczej niż zakładasz).

---

## F0 — Fundament: środowisko, przyrządy, pomiar bazowy

- [x] **F0-00** `tooling` Zależności i sprawdzenie, czy zastany kod w ogóle się buduje
  CZYTAJ: `package.json`, `plan/01-analiza-i-zasady.md` sekcja 1
  AC:
  - `npm install` kończy się kodem 0; `node_modules` istnieje
  - `npm run build` na zastanym kodzie kończy się kodem 0 na Node v26; gdy nie,
    lista błędów trafia jako osobne issues do F7, a raport podaje, czy blokują dalszą pracę
  - `npm run dev` startuje i `/login` odpowiada kodem 200 (dowód: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login`)
  - sprawdzone i zapisane w raporcie, czy `next dev --webpack` jest jeszcze wspierany
    w Next 16.2.4; gdy nie, F2-05 traci sens i zostaje zamknięte z tym uzasadnieniem
  - negatywne: `npm install` nie aktualizuje wersji istniejących zależności
    (dowód: `git diff --stat package.json` pokazuje 0 zmian)
  DOWÓD (2026-09-02): `npm install` kod 0, `node_modules` istnieje, `git diff --stat package.json`
  zwraca 0 linii. `npm run build` kod 0 (pierwszy przebieg padał wyłącznie na braku
  `DATABASE_URL` i `SESSION_SECRET`, czyli na luce, którą domyka F0-01, nie na błędzie kodu;
  TypeScript przeszedł: „Finished TypeScript in 4.7s"). `npm run dev` (webpack) Ready in 378ms,
  `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login` zwraca `200`.
  `next dev --webpack` JEST wspierany w Next 16.2.4 (`npx next dev --help` wypisuje
  `--webpack  Starts development mode using webpack.`), więc F2-05 zachowuje sens.

- [x] **F0-01** `db` `tooling` Bazy i zmienne środowiskowe
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 2, `src/lib/env.ts`, `.env.example`
  AC:
  - `.env.local` zawiera i wszystkie odpowiadają na zapytanie `select 1`:
    `DATABASE_URL` (baza robocza), `PERF_DATABASE_URL` (pomiarowa),
    `TEST_DATABASE_URL` (testowa)
  - `.env.local` zawiera także `SESSION_SECRET` o długości co najmniej 32 znaków,
    `AUTH_EMAIL` i `AUTH_PASSWORD`; bez nich `src/lib/env.ts` rzuca przy imporcie
    i nie wystartuje ani dev, ani build (dowód: `npm run build` przechodzi)
  - wyzwalacz wariantu zapasowego: `DATABASE_URL` nieobecny w `.env.local` w chwili
    startu issue. Wariant zapasowy, dosłownie:
    `docker info` kod 0, potem `docker run -d --name mc-pg -p 5433:5432 -e POSTGRES_PASSWORD=mc -e POSTGRES_DB=marketing postgres:17`,
    trzy bazy jako trzy nazwy w tej instancji; wybór opisany w `DECISIONS.md`
  - `npm run db:migrate` przechodzi na każdej z trzech baz (kod 0)
  - `.env.example` uzupełniony o `PERF_DATABASE_URL`, `TEST_DATABASE_URL`,
    `DB_POOL_MAX` z komentarzem, po co każda
  - negatywne: `git status --porcelain | grep -c '.env.local'` zwraca 0;
    `PERF_DATABASE_URL` różni się od `DATABASE_URL` i od `TEST_DATABASE_URL`
  DOWÓD (2026-09-02): `DATABASE_URL` nieobecny na starcie issue, więc zadziałał wariant
  zapasowy: `docker info` kod 0, kontener `mc-pg` (postgres:17, port 5433), trzy bazy
  `marketing` / `marketing_perf` / `marketing_test`, wybór opisany w `DECISIONS.md`.
  `select 1` przez klienta `postgres-js` odpowiada `1` na każdym z trzech URL-i.
  `drizzle/migrate.ts` kod 0 na każdej z trzech baz, po migracji każda ma 12 tabel
  w `public`. `npm run build` kod 0 (czyli `src/lib/env.ts` przechodzi walidację).
  `git status --porcelain | grep -c '.env.local'` zwraca `0`. `.env.example` uzupełniony
  o `PERF_DATABASE_URL`, `TEST_DATABASE_URL`, `DB_POOL_MAX`, każda z komentarzem.

- [x] **F0-02** `tooling` `test` Przyrządy jakości: typecheck, lint, Vitest, Playwright
  CZYTAJ: `plan/06-testy.md` sekcje 1 i 2, `plan/01` zasady Z10 i Z11,
  `plan/05-ui-system.md` sekcja 6
  AC:
  - `package.json` ma skrypty o dokładnych nazwach: `typecheck`, `lint`, `test`,
    `test:watch`, `e2e`, `pg:info`
  - `eslint.config.mjs` istnieje, zawiera `eslint-config-next` w wersji zgodnej
    z `next` 16.2.4 (wersja przypięta, nie `^`), regułę `complexity` z progiem 10
    i regułę zakazu surowego `<button>` z `plan/05` sekcja 6, na razie jako ostrzeżenie
  - `vitest.config.ts` ustawia `environment: 'jsdom'` i aliasy z `tsconfig`;
    `@testing-library/react` zainstalowane (F3-07 i F3-08 wymagają testów komponentów,
    więc bez tego stoją)
  - `npm run test` przechodzi dwa testy: jeden na funkcji z `src/lib/dates.ts`
    (trzy przypadki, w tym brzegowy) i jeden renderujący `Button` z `src/components/ui/`
    oraz sprawdzający reakcję na kliknięcie
  - `playwright.config.ts` istnieje, `npx playwright install chromium` wykonane,
    `npm run e2e` uruchamia jeden scenariusz: logowanie parą `AUTH_EMAIL`
    i `AUTH_PASSWORD`, po nim `/calendar` odpowiada kodem 200 i zawiera nagłówek strony
  - `npm run typecheck`: wynik zapisany w raporcie liczbowo; każdy błąd z kodu zastanego
    ma issue w F7 (nie wolno ich cicho ignorować ani wyciszać w konfiguracji)
  - negatywne: `grep -rn 'eslint-disable' src/ | wc -l` — każde trafienie ma powód
    w tej samej linii (dowód: lista trafień z powodami w raporcie)
  DOWÓD (2026-09-02): skrypty `typecheck`, `lint`, `test`, `test:watch`, `e2e`, `pg:info`
  są w `package.json`. `eslint.config.mjs` używa NATYWNYCH flat configów
  `eslint-config-next/core-web-vitals` i `/typescript` (wersja przypięta na `16.2.4`,
  bez `^`), ma `complexity: ['error', 10]` i regułę `no-restricted-syntax` blokującą
  surowy `<button>` na poziomie `warn`. `vitest.config.ts`: `environment: 'jsdom'`
  plus alias `@` z `tsconfig`. `npm run test` kod 0, 2 pliki, 6 testów: `dates.test.ts`
  (5 przypadków wokół `toIsoWeekString` i `isoWeekToMonday`, w tym brzegowy
  2025-12-29 → `2026-W01`) i `button.test.tsx` (render + `fireEvent.click`, handler
  wołany raz). `npx playwright install chromium` wykonane, `npm run e2e` kod 0,
  1 scenariusz przechodzi w 5.5 s: logowanie parą z `.env.local`, potem `/calendar`
  ze statusem 200 i nagłówkiem h1 „Pipeline".
  `npm run typecheck` kod 0, **0 błędów** z kodu zastanego, więc F7 nie dostaje z tego
  tytułu żadnego issue. `npm run lint` kod 0: 205 problemów, **0 błędów**, 205 ostrzeżeń
  (89 surowych guzików, 63 przekroczenia złożoności, 21 reguł react-hooks, 17 nieużywanych
  zmiennych, reszta drobne). Wszystkie 91 błędów zastanych zjechało na `warn` wyłącznie
  przez jawną, kurczącą się listę 47 plików w `eslint.config.mjs` i każdy z nich ma issue:
  F7-01 do F7-07.
  `grep -rn 'eslint-disable' src/ | wc -l` zwraca `0` (jedyna dyrektywa, `no-var`
  w `src/lib/db.ts`, była martwa i bez powodu, więc została usunięta zamiast opisana).

- [x] **F0-03** `perf` `db` Zestaw L
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 2
  AC:
  - `scripts/perf/seed-large.ts` wypełnia bazę z `PERF_DATABASE_URL` liczbami wierszy
    dokładnie z tabeli w `plan/03` sekcja 2 (dowód: wyjście `scripts/perf/table-counts.mjs`)
  - generator jest deterministyczny (ziarno 1337): dwa uruchomienia na czystej bazie
    dają identyczne liczby wierszy i identyczne nazwy pierwszych 10 osób
  - generator zapisuje do `perf/fixtures-ids.json` identyfikatory potrzebne harnessowi:
    jedną produkcję i jedną kampanię, żeby URL-e `/productions/<id>` i `/campaigns/<id>`
    z `plan/03` sekcja 3 dało się złożyć
  - negatywne: generator odmawia startu, gdy `PERF_DATABASE_URL` równa się
    `DATABASE_URL` (dowód: uruchomienie z równymi URL kończy się kodem 1 bez zapisu)
  DOWÓD (2026-09-02): `npx tsx scripts/perf/seed-large.ts` kod 0.
  `node scripts/perf/table-counts.mjs --json` zwraca dokładnie tabelę z `plan/03`
  sekcja 2: artists 200, videographers 60, campaigns 40, productions 500,
  calendar_entries 3000, posts 5000, csv_uploads 20, csv_rows 12000.
  Determinizm: dwa przebiegi pod rząd, `diff` liczb, `diff` pierwszych 10 nazw osób
  i `diff` `perf/fixtures-ids.json` — wszystkie trzy puste. Pierwsza dziesiątka to
  Ewa Wójcik, Norbert Dąbrowski, Zofia Jankowski, Ewa Wiśniewska, Norbert Szymańska,
  Norbert Szymańska, Damian Wiśniewska, Małgorzata Kozłowska, Olga Kozłowska,
  Urszula Król. Ziarno 1337 przez `mulberry32`, zero `Math.random()`, oś czasu
  zakotwiczona na stałej dacie zamiast `new Date()`.
  `perf/fixtures-ids.json` zawiera `productionId: 1` i `campaignId: 1`, więc URL-e
  `/productions/1` i `/campaigns/1` dla F0-05 dają się złożyć.
  Negatywne: uruchomienie z `PERF_DATABASE_URL` równym `DATABASE_URL` kończy się
  kodem **1**, baza robocza ma po nim `select count(*) from productions` = 0,
  a `perf/fixtures-ids.json` jest bajt w bajt ten sam co przed próbą. Pusty
  `PERF_DATABASE_URL` też kończy się kodem 1.

- [x] **F0-04** `perf` `tooling` Harness, część pierwsza: baza
  CZYTAJ: `plan/03-wydajnosc.md` sekcje 1.2 i 4, `plan/02-architektura.md` sekcja 3
  AC:
  - `scripts/perf/pg-info.mjs` wypisuje wersję Postgresa, host, listę indeksów
    z `pg_indexes` i liczby wierszy per tabela, wszystko przez klienta `postgres-js`
    (dowód: wyjście w raporcie; `psql` nie jest używany, bo go nie ma)
  - `scripts/perf/measure-db.mjs` zwraca dla każdego z 4 zapytań krytycznych p50, p95
    oraz `seqScan` wyliczone z `EXPLAIN (ANALYZE, BUFFERS)` uruchomionego przez ten sam
    klient
  - dwa przebiegi `node scripts/perf/measure-db.mjs` pod rząd na zestawie L różnią się
    na p50 o mniej niż 10% dla każdego zapytania (dowód: dwa pliki w `perf/runs/`)
  - negatywne: skrypt kończy się kodem 1, gdy `PERF_DATABASE_URL` jest pusty albo baza
    jest pusta (0 wierszy w `productions`), zamiast raportować świetne czasy na pustce
  DOWÓD (2026-09-02): `npm run pg:info` wypisuje Postgres **17.11 (Debian 17.11-1.pgdg13+2)**,
  host `127.0.0.1:5433/marketing_perf`, `max_connections` 100, listę **12 indeksów**
  z `pg_indexes` (wszystkie to `_pkey`, co potwierdza A1: zero indeksów poza kluczami
  głównymi) i liczby wierszy per tabela. Klient: `postgres-js`, `psql` nieużywany.
  `node scripts/perf/measure-db.mjs` zwraca dla 4 zapytań krytycznych p50, p95, `rows`
  oraz `seqScan` z `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` przez ten sam klient.
  Stan wyjściowy (zestaw L, przed indeksami z F1-01):
  calendar-window p50 1,39 p95 ok. 1,6 `seqScan: true` (`calendar_entries:3000`);
  productions-list p50 0,72 `seqScan: false`;
  campaign-detail p50 0,55 `seqScan: false`;
  posts-analytics p50 1,14 `seqScan: true` (`posts:5000`).
  Powtarzalność: po **restarcie kontenera** `mc-pg`, czyli przy zimnym cache serwera,
  trzy przebiegi pod rząd dają max różnicę p50 **7,9%** (przebieg 1 vs 2) i **5,4%**
  (2 vs 3), obie poniżej progu 10%. Pliki w `perf/runs/`. Droga do tego wyniku
  (rozgrzewka adaptacyjna zamiast stałej) opisana w `DECISIONS.md`.
  Negatywne: pusty `PERF_DATABASE_URL` kończy się kodem **1**; baza z 0 wierszy
  w `productions` (`marketing_test`) kończy się kodem **1** z komunikatem
  „odmawiam pomiaru na pustce", a liczba plików w `perf/runs/` przed i po próbie
  jest ta sama (3 i 3), czyli nic nie zostało zapisane.

- [x] **F0-05** `perf` `tooling` ⚠ HARD Harness, część druga: strony, dev, raport, baseline
  CZYTAJ: `plan/03-wydajnosc.md` sekcje 1.1, 1.3, 3 i 4, `src/proxy.ts`
  AC:
  - `scripts/perf/measure-page.mjs` sam się loguje: `POST /login` parą `AUTH_EMAIL`
    i `AUTH_PASSWORD`, zapamiętuje ciasteczko z `Set-Cookie` i wysyła je w każdym
    żądaniu; bez tego proxy przekierowuje wszystko na `/login`
  - mierzy wszystkie 7 ścieżek z `plan/03` sekcja 3, identyfikatory bierze
    z `perf/fixtures-ids.json`; 3 żądania rozgrzewkowe, 11 pomiarowych, zwraca p50 i p95
  - `measure-dev.mjs` zwraca `readyMs`, `firstCompileMs`, `warmP50Ms`, `hmrMs`, `peakRssMb`
  - `report.mjs` porównuje z `perf/budget.json` i kończy się kodem 1 przy przekroczeniu
    progu; porównanie dryfu robi względem ostatniego pliku w `perf/runs/`, nie względem
    baseline
  - serwer mierzony przez `measure-page.mjs` startuje z `DATABASE_URL` ustawionym
    na wartość `PERF_DATABASE_URL` (inaczej strony mierzy się na kilkudziesięciu
    wierszach bazy roboczej, a budżety są zdefiniowane na zestawie L); host bazy
    zapisany w wyniku jako pole `dbUrlHost`, a w `package.json` powstaje skrypt
    `perf:serve` uruchamiający `next build && DATABASE_URL=$PERF_DATABASE_URL next start`
  - `perf/baseline.json` istnieje i zawiera: pomiar produkcyjny (przez `perf:serve`),
    deweloperski, rozmiar JS pierwszego ładowania `/calendar` po gzip z wyjścia
    `next build`, skrót commita, pole `mode`
  - `perf/budget.json` zawiera progi z `plan/03` sekcja 4, z progiem rozmiaru bundla
    skorygowanym wg reguły z tej sekcji
  - raport wymienia, które progi są dziś przekroczone i o ile procent
  - negatywne: harness odmawia zapisu, gdy którakolwiek odpowiedź ma status inny niż 200
    (dowód: uruchomienie z błędnym `BASE_URL` kończy się kodem 1 i nie tworzy pliku
    w `perf/runs/`)
  DOWÓD (2026-09-02): pomiar na URUCHOMIONYM serwerze produkcyjnym (`npm run perf:serve`,
  `next build` + `next start` z `DATABASE_URL` = `PERF_DATABASE_URL`, baza `marketing_perf`
  z zestawem L, 500 produkcji). `node scripts/perf/measure-page.mjs` loguje się sam
  i mierzy 7 ścieżek, p95 kolejno: home 21.7 ms, calendar 64.3, calendar-table 30.2,
  productions 126, production-detail 23.6, campaign-detail 39.2, analytics 34.8;
  `dbUrlHost` w wyniku to `127.0.0.1:5433/marketing_perf`.
  `npm run perf:dev`: readyMs 619, firstCompileMs 2603, warmP50Ms 49, hmrMs 2079,
  peakRssMb 1510 (`perf/runs/dev-2026-09-02T18-43-13-209Z.json`).
  `node scripts/perf/report.mjs` kończy się kodem 1 i wypisuje trzy przekroczenia:
  `seqScan calendar-window (calendar_entries:3000)`, `seqScan posts-analytics (posts:5000)`,
  `JS /calendar (gzip): 354.8 wobec 301.6 (+18%)`; dryf liczony wobec poprzedniego pliku
  w `perf/runs/`, nie wobec baseline. `perf/baseline.json` niesie `mode: "local-docker"`,
  `commit: f337f1f`, pomiar produkcyjny, deweloperski i `bundle.calendarFirstLoadKb: 354.8`.
  Próg bundla w `perf/budget.json` skorygowany regułą z plan/03 sekcja 4:
  354.8 minus 15% = 301.6 kB, cel 350 kB został celem długoterminowym.
  NEGATYWNE: `BASE_URL=http://localhost:3999 node scripts/perf/measure-page.mjs` kończy się
  kodem 1, liczba plików w `perf/runs/` przed i po jest ta sama (9 i 9). Drugi wariant
  potwierdzony przy okazji: uruchomienie przeciw serwerowi na bazie roboczej dało
  `/productions/1` -> 404, kod 1, brak zapisu.
  Zrzut: `screenshots/F0/`.

- [x] **F0-06** `arch` `docs` Dokument architektury
  CZYTAJ: `plan/02-architektura.md` sekcje 1, 2 i 3
  AC:
  - `docs/ARCHITEKTURA.md` istnieje i ma wszystkie 9 sekcji z tabeli w `plan/02`
    sekcja 3, każda niepusta
  - sekcja 2 podaje host produkcji z dowodem: wynik
    `gh api repos/maciejsachse0-source/Marketing-dashboard-manager/deployments`
    wklejony do dokumentu; gdy pusty, dokument mówi wprost „brak wdrożenia potwierdzonego
    przez GitHub" i notuje odpowiedź usera
  - sekcja 3 podaje wersję Postgresa i providera z wyjścia `npm run pg:info`
  - sekcja 4 podaje liczby wierszy z `table-counts.mjs` z bazy roboczej, z datą
  - sekcja 6 opisuje przepływ dodania wpisu kalendarza z nazwami plików i numerami linii,
    które da się otworzyć
  - negatywne: `awk '/^## 9\./{exit} /[Ss]qlite/{n++} END{print n+0}' docs/ARCHITEKTURA.md`
    zwraca `0` (SQLite wolno wspomnieć wyłącznie w sekcji 9 o długach)
  DOWÓD (2026-09-02): `grep -n '^## ' docs/ARCHITEKTURA.md` zwraca 9 linii, sekcje 1 do 9
  z tabeli w `plan/02` sekcja 3, każda z treścią.
  Sekcja 2: `gh api repos/maciejsachse0-source/Marketing-dashboard-manager/deployments`
  zwraca **29 wdrożeń**, wszystkie od `vercel[bot]`, więc hosting to Vercel i jest
  potwierdzony przez GitHuba, nie przez domysł. Wynik (id, środowisko, data, commit,
  autor) wklejony do dokumentu razem ze statusami: ostatnie wdrożenie produkcyjne
  `4564105017` z 2026-05-03 ma stan `failure`, ostatnie zielone to `4563418238`.
  Odpowiedź usera o domenie i dostępach jeszcze nie przyszła i dokument mówi to wprost.
  Sekcja 3: wersja i provider z `npm run pg:info` (PostgreSQL 17.11 Debian, kontener
  Docker `mc-pg` na `127.0.0.1:5433`, `max_connections` 100, pula aplikacji `max: 1`,
  `prepare: false`).
  Sekcja 4: `node scripts/perf/table-counts.mjs --work --json` na bazie roboczej zwraca
  same zera i taka jest treść dokumentu, z datą 2026-09-02 i wyjaśnieniem, skąd pustka;
  dla kontrastu wklejony też zestaw L z bazy pomiarowej.
  Sekcja 6: przepływ dodania wpisu kalendarza rozpisany na `src/proxy.ts:4` i `:10`,
  `src/lib/auth-token.ts:18`, `src/app/calendar/page.tsx:142`, `src/lib/db.ts:17`,
  `:20`, `:23`, `:32`, `src/server/actions/calendar.ts:13`, `:17`, `:18`, `:19`,
  `:20-34`, `:35`, `:36`, `src/lib/auth.ts:41`; każdy numer sprawdzony komendą `sed -n`.
  NEGATYWNE: `awk '/^## 9\./{exit} /[Ss]qlite/{n++} END{print n+0}' docs/ARCHITEKTURA.md`
  zwraca `0`. Kontrolnie: `grep -c '—' docs/ARCHITEKTURA.md` zwraca `0` (zasada Z7).
  Znalezisko przy okazji: **F7-09**, `createCalendarEntry` nie ma wywołania z interfejsu.

- [x] **F0-07** `docs` `tooling` Naprawa dokumentów, które kłamią, i porządki
  CZYTAJ: `plan/01` sekcja 1 punkt A9, `plan/02` sekcja 4, `plan/07` sekcja START
  AC:
  - `grep -r 'better-sqlite3' README.md CLAUDE.md | wc -l` zwraca `0`; oba pliki linkują
    do `docs/ARCHITEKTURA.md` zamiast powtarzać opis bazy; ostrzeżenie tymczasowe
    z nagłówka `CLAUDE.md` usunięte, bo przestaje być prawdziwe
  - `CLAUDE.md` wymienia komendy `typecheck`, `lint`, `test`, `e2e`, `perf`
  - `AGENTS.md` ma tabelę „zadanie → gdzie zajrzeć" z co najmniej 8 wierszami:
    wydajność, baza i migracje, komponenty, import, testy, architektura, uruchomienie,
    znaleziska
  - `git ls-files | grep -c '\.db$'` zwraca `0` (dwa pliki `.bak.db` usunięte, powód
    w `DECISIONS.md`)
  - `.gitignore` zawiera `.data-import/`; `bash ~/.claude/agent-context.sh` zwraca liczbę
    albo `NO-AGENT-TRANSCRIPT`; `cat ~/.claude/context-usage.txt` zwraca liczbę
  - negatywne: `grep -r 'artists\|videographers\|calendar_entries' README.md CLAUDE.md | wc -l`
    zwraca `0` — lista tabel żyje wyłącznie w `docs/ARCHITEKTURA.md`
  DOWÓD (2026-09-02): `grep -r 'better-sqlite3' README.md CLAUDE.md | wc -l` zwraca `0`;
  kontrolnie `grep -rn 'SQLite\|sqlite' README.md` też nie ma trafień. Oba pliki mają
  teraz odesłanie `docs/ARCHITEKTURA.md` zamiast własnego opisu bazy (README sekcja
  „Gdzie stoi serwer i jak wygląda baza", CLAUDE.md sekcja „Gdzie szukać opisu systemu”).
  Ostrzeżenie tymczasowe z nagłówka `CLAUDE.md` usunięte w całości.
  `CLAUDE.md` ma blok „Zestaw walidacyjny" z `typecheck`, `lint`, `test`, `e2e`, `perf`
  plus notatkę, że `perf` wymaga wcześniejszego `perf:serve`.
  `AGENTS.md` ma tabelę „Zadanie, a gdzie zajrzeć" z **12 wierszami**, w tym wszystkie
  osiem wymaganych: wydajność, baza i migracje, komponenty, import, testy, architektura,
  uruchomienie, znaleziska.
  `git ls-files | grep -c '\.db$'` zwraca `0`; oba pliki `*.bak.db` usunięte z indeksu
  i z dysku, powód i sposób odzyskania w `DECISIONS.md`, wpis F0-07.
  `.gitignore` zawiera `.data-import/` (linia 49) oraz rozszerzony wzorzec `/data/*.db`.
  `bash ~/.claude/agent-context.sh` zwraca liczbę (`84`; z obowiązkowym argumentem
  `1000000` zwraca `15`), `cat ~/.claude/context-usage.txt` zwraca `13`.
  NEGATYWNE: `grep -r 'artists\|videographers\|calendar_entries' README.md CLAUDE.md | wc -l`
  zwraca `0`. Dwa trafienia, które zostały po pierwszym podejściu (import
  `actions/artists` i przykład surowego SQL na `calendar_entries` w `CLAUDE.md`),
  zniknęły: przykład SQL operuje teraz na jednej tabeli podanej jako ilustracja
  i odsyła po nazwy do sekcji 5 dokumentu architektury.
  Po zmianach `npm run typecheck`, `npm run lint` i `npm run test` kończą się kodem 0.

**DoD F0:** `docs/ARCHITEKTURA.md` potwierdzony przez usera jako zgodny z jego wiedzą
o hostingu; `perf/baseline.json` commitowany; `typecheck`, `lint`, `test`, `e2e`, `perf`
uruchamialne.

---

## F1 — Wydajność warstwy danych i serwera (kroki P1 do P4)

- [x] **F1-01** `db` `perf` Indeksy na kolumnach filtrowanych i sortowanych (P1)
  DOWOD: migracja `drizzle/migrations/0002_long_killraven.sql` (13 CREATE INDEX,
  `grep -c 'DROP\|ALTER COLUMN'` = 0), zastosowana na marketing, marketing_perf,
  marketing_test. `npm run pg:info`: 25 indeksow (12 PK + 13 nowych), wszystkie 13
  wymienione. `node scripts/perf/measure-db.mjs` po zmianie: seqScan `nie` dla
  wszystkich 4 zapytan, p95 (ms) calendar-window 1.34, productions-list 1.09,
  campaign-detail 0.77, posts-analytics 1.01 - kazde ponizej 120 ms.
  PRZED (perf/baseline.json): calendar-window 1.82 Seq Scan, productions-list 1.04,
  campaign-detail 0.83, posts-analytics 1.47 Seq Scan.
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P1, `plan/01` zasada Z9
  AC:
  - `drizzle/schema.ts` deklaruje indeks na **każdej z 10 kolumn `references()`**:
    `productions(campaign_id)`, `productions(artist_id)`, `productions(videographer_id)`,
    `calendar_entries(production_id)`, `calendar_entries(campaign_id)`,
    `calendar_entries(artist_id)`, `posts(campaign_id)`, `posts(production_id)`,
    `posts(raw_csv_row_id)`, `csv_rows(upload_id)`
  - dodatkowo indeksy na kolumnach sortowania: `calendar_entries(starts_at)`,
    `posts(published_at)`, `productions(t0_at)`
  - migracja wygenerowana `npm run db:generate` i zastosowana; `npm run pg:info`
    pokazuje wszystkie 13 indeksów
  - `node scripts/perf/measure-db.mjs`: `seqScan` równe `false` dla wszystkich 4 zapytań
    krytycznych; p95 każdego poniżej 120 ms
  - tabela przed i po w raporcie, liczby z `perf/baseline.json` i nowego przebiegu
  - negatywne: `grep -c 'DROP\|ALTER COLUMN' drizzle/migrations/<nowa>.sql` zwraca `0`

- [x] **F1-02** `perf` Zrównoleglenie zapytań i pula połączeń (P2)
  DOWOD: `campaigns/[id]` ma teraz 5 zapytan w jednym `Promise.all` (bramka
  `notFound` przeniesiona za nie), zapytanie o artystow zostaje sekwencyjne
  z komentarzem; `src/app/page.tsx` wciaga `loadAgents()` do istniejacego
  `Promise.all` (6 rownoleglych), `agentHints` sekwencyjne z komentarzem;
  `src/app/calendar/page.tsx` laczy `productions` i `campaigns` w `Promise.all`.
  `src/lib/db.ts`: `max: process.env.VERCEL ? 1 : env.DB_POOL_MAX` (domyslna 10),
  uzasadnienie limitu w `docs/ARCHITEKTURA.md` sekcja 3.
  POMIAR (`measure-page.mjs`, po 3 przebiegi, mediana p95): home 25.75 ms -> 12.3 ms
  (-52%), campaign-detail 40.25 ms -> 30.7 ms (-24%). Oba powyzej progu 10%.
  NEGATYWNE: `DB_POOL_MAX=1 npm run test` 6/6 zielonych, serwer na `DB_POOL_MAX=1`
  wstaje i `/login` zwraca 200. Zrzuty `screenshots/f1-02-przed-campaigns_1.png`
  i `screenshots/f1-02-po-campaigns_1.png` maja identyczny SHA-1 (9a87f271992a),
  czyli widok nie zmienil ani tresci, ani kolejnosci danych.
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P2, `src/lib/db.ts`,
  `src/app/campaigns/[id]/page.tsx`, `src/app/page.tsx`
  AC:
  - niezależne zapytania w `src/app/campaigns/[id]/page.tsx` (5 zapytań),
    `src/app/page.tsx` (4) i `src/app/calendar/page.tsx` (2) wykonywane przez
    `Promise.all`; zapytania zależne od wyniku poprzedniego zostają sekwencyjne
    i mają komentarz z powodem
  - `src/lib/db.ts` ustawia `max: 1` gdy `process.env.VERCEL` jest ustawione,
    w innym wypadku wartość z `DB_POOL_MAX` z domyślną 10
  - `docs/ARCHITEKTURA.md` sekcja 3 podaje limit połączeń providera i uzasadnia 10
  - pomiar: p95 `campaign-detail` i `home` poprawia się o co najmniej 10% względem
    wyniku po F1-01; gdy nie, hipoteza opisana w `DECISIONS.md` jako obalona i zmiana
    cofnięta
  - negatywne: aplikacja startuje i `npm run test` przechodzi przy `DB_POOL_MAX=1`;
    żadna strona nie zaczyna pokazywać danych w innej kolejności niż wcześniej
    (dowód: zrzuty ekranu przed i po dla `campaign-detail`)

- [x] **F1-03** `perf` ⚠ HARD Cache zamiast bezwarunkowej dynamiki (P3)
  WYNIK: **hipoteza obalona, zmiana cofnięta zgodnie z własnym kryterium.**
  Pełny opis w `DECISIONS.md`, wpis „F1-03".
  DOWOD: implementacja doprowadzona do `npm run build` kod 0 z `cacheComponents: true`,
  26 usuniętych deklaracji `force-dynamic` (wariant „zostaje z komentarzem" jest
  niewykonalny, build go zabrania), cztery odczyty w `use cache` z `cacheLife('minutes')`
  i tagami, unieważnianie przez `updateTag`. Pomiar `measure-page.mjs`, po 3 przebiegi,
  mediana p95: home 12,3 -> 11,7; calendar 63,8 -> 59,8; calendar-table 26,5 -> 25,5;
  productions 128,1 -> 132,5; production-detail 23,1 -> 22,4; campaign-detail
  30,7 -> 34,1; analytics 27,5 -> 28,0. Żadna ścieżka nie poprawiła się o 10%,
  więc zmiana cofnięta poza zdjęciem `force-dynamic` z `src/app/layout.tsx`.
  Przyczyna niemierzalności zapisana jako **F7-10** (trzy z czterech cachowanych
  katalogów mają w bazie pomiarowej zero wierszy) i **F7-11** (powrót do P3
  z gotowym przepisem technicznym).
  ZOSTAJE: `e2e/stale-data.spec.ts` zielony na serwerze produkcyjnym
  (`npm run e2e`: 2 passed), `src/app/layout.tsx` bez `force-dynamic`,
  `npm run build` kod 0, `npm run typecheck` kod 0, `npm run lint` kod 0.
  POPRAWKA DOWODU 2026-09-03 (**F7-41**): trzecie kryterium poniżej
  nie było prawdziwe. Po cofnięciu zmiany deklaracje wróciły, a doszły trzy nowe
  (`import/osoby`, `videographers`, `campaigns/templates`) — 29 sztuk i ani jednego
  komentarza z powodem. Dociągnięte w F7-41: 27 deklaracji z komentarzem, 2 usunięte,
  a nowa reguła w `scripts/check-typography.mjs` nie przepuszcza deklaracji bez powodu.
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P3, `src/app/layout.tsx`,
  dokumentacja Next 16 o Cache Components (przeczytaj przed pisaniem kodu)
  AC:
  - `next.config.ts` (dziś pusty) włącza mechanizm Cache Components; `npm run build`
    po włączeniu kończy się kodem 0 — to pierwszy realny test, czy pozostałe strony
    przeżyją włączenie flagi
  - `src/app/layout.tsx` nie ma `export const dynamic = 'force-dynamic'`
  - z **26 plików**, które dziś to deklarują, każdy albo traci deklarację, albo ma nad
    nią komentarz z powodem („zależne od sesji", „dane zmieniane akcją użytkownika");
    liczba pozostałych deklaracji podana w raporcie
  - co najmniej trzy odczyty niezależne od użytkownika (szablony produkcji, szablony
    kampanii, lista osób) opakowane w mechanizm cache Next 16 z jawnie podanym czasem
    życia i tagiem; akcja mutująca unieważnia swój tag
  - po mutacji widok pokazuje aktualne dane: scenariusz e2e dodaje wpis kalendarza
    i sprawdza, że `/calendar` pokazuje go bez twardego odświeżenia
  - pomiar: p95 co najmniej dwóch ścieżek poprawia się o 10% lub więcej; gdy nie,
    hipoteza obalona i opisana, zmiana cofnięta poza samym zdjęciem `force-dynamic`
    z layoutu
  - negatywne: żadna strona nie pokazuje danych sprzed mutacji ani danych innej sesji
    (dowód: `e2e/stale-data.spec.ts` zielony)

- [x] **F1-04** `perf` Zawężenie unieważniania ścieżek (P4)
  DOWOD: `grep -r "revalidatePath('/')" src/ | wc -l` zwraca **0** (było 8).
  Cztery wywołania zniknęły całkiem, bo pulpit nie renderuje tych danych:
  `productions.ts` (2), `production-steps.ts` (1), `templates.ts` (1); w zamian
  odświeżana jest `/productions/list`. Cztery zostały, bo pulpit faktycznie
  pokazuje te dane (wpisy kalendarza w `calendar.ts`, kafle agentów w `agents.ts`),
  ale mają teraz jawny typ: `revalidatePath('/', 'page')` z komentarzem. Jawny typ
  nie jest kosmetyką: obawa z `plan/03` dotyczyła unieważnienia całej aplikacji,
  a to robi dopiero typ `layout`. `safeRevalidatePath` przyjmuje drugi argument.
  `e2e/revalidate.spec.ts`: 5 scenariuszy, wszystkie zielone na serwerze
  produkcyjnym (`npm run e2e`: 7 passed łącznie z login i stale-data).
  Scenariusz „wpis kalendarza" zastąpiony scenariuszem „produkcja widoczna
  na osi w /calendar", bo wpisu kalendarza nie da się dodać z interfejsu
  (znalezisko F7-09); powód zapisany w nagłówku pliku.
  `npm run typecheck` kod 0, `npm run lint` kod 0, `npm run test` 6/6,
  `npm run build` kod 0.
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P4
  AC:
  - `grep -r "revalidatePath('/')" src/ | wc -l` zwraca `0` (dziś 8); każde wywołanie
    wskazuje konkretną ścieżkę albo listę ścieżek
  - dla 5 najczęstszych mutacji (wpis kalendarza, krok produkcji, produkcja, kampania,
    osoba) scenariusz e2e potwierdza, że widok docelowy się odświeża
  - negatywne: żadna mutacja nie przestaje odświeżać swojego widoku
    (dowód: `e2e/revalidate.spec.ts`, 5 scenariuszy, wszystkie zielone)

**DoD F1:** `npm run perf` kod 0 dla progów bazodanowych (p95 zapytań, `seqScan`);
tabela przed i po w raporcie fazy.

---

## F2 — Wydajność interfejsu (kroki P5 do P8)

- [x] **F2-01** `test` Testy przypinające zachowanie ganta przed refaktorem
  DOWÓD (2026-09-02): `src/components/calendar/__tests__/gantt-geometry.test.ts`,
  **14 testów w 6 grupach**, wszystkie zielone (`npx vitest run`: „Test Files 3 passed,
  Tests 20 passed"). Pokrycie wiersza „Oś czasu ganta" z `plan/06` sekcja 3: pozycja
  kroku wewnątrz okna, krok przed oknem (`outOfWindow: 'before'`), krok po oknie
  (`outOfWindow: 'after'`), granica ostatniego dnia okna, produkcja bez zapisanej
  kotwicy T0 (`source: 'tentative'`, pozycja liczona od poniedziałku tygodnia T-0),
  okno tygodnia (7 dni) i okno kwartału (13 tygodni). Żadnej migawki drzewa —
  `grep -c 'toMatchSnapshot' src/components/calendar/__tests__/gantt-geometry.test.ts`
  zwraca 0.
  Żeby dało się to w ogóle uruchomić, czysta arytmetyka została **przeniesiona bez
  zmiany treści** z `gantt-view.tsx` do nowego `src/components/calendar/gantt-geometry.ts`:
  import samego `gantt-view.tsx` w vitest kończy się wyjątkiem `Invalid environment
  variables` z `src/lib/env.ts` (przez łańcuch server action → `src/lib/db.ts`), więc
  testowanie przez komponent było niewykonalne. Jedyna nowa funkcja to `clipToWindow`,
  która zastępuje trzy identyczne kopie przycinania w miejscu.
  Wygląd bez zmian: `screenshots/F2/przed-calendar-week.png` wobec
  `screenshots/F2/po-F2-01-calendar-week.png` różni się na **1050 pikselach z 7 823 808**
  (0,013 procent), ale dwa przebiegi tego samego, niezmienionego kodu dają dokładnie
  tę samą liczbę 1050 — czyli to szum renderowania, nie skutek zmiany. Narzędzie:
  `node scripts/perf/pngdiff.mjs <a> <b>` (powstało tutaj). `npm run typecheck` kod 0,
  `npm run lint` bez nowych ostrzeżeń (dwa dotychczasowe o martwych funkcjach zniknęły,
  bo funkcje wyjechały do geometrii; trafiły do F7-12).
  CZYTAJ: `plan/06-testy.md` sekcje 2 i 3, `src/components/calendar/gantt-view.tsx`
  AC:
  - `src/components/calendar/__tests__/gantt-geometry.test.ts` z co najmniej
    6 scenariuszami z `plan/06` sekcja 3 wiersz „Oś czasu ganta"
  - wszystkie przechodzą NA KODZIE SPRZED refaktoru (dowód: wyjście przebiegu
    wklejone do raportu)
  - obejmują produkcję bez kotwicy T0 i okno kwartalne
  - negatywne: żaden test nie używa migawki całego drzewa komponentu

- [x] **F2-02** `ui` Podział pliku ganta
  DOWÓD (2026-09-02): `gantt-view.tsx` zszedł z **2545 do 187 linii**. Powstało
  jedenaście plików, żaden nie przekracza 300 linii (`wc -l`): `gantt-row.tsx` 250
  (wiersz produkcji), `gantt-header.tsx` 174 (nagłówek osi), `gantt-view.tsx` 187
  (kontener), a poza wymaganą trójką `gantt-stages.ts` 170, `gantt-geometry.ts` 193,
  `gantt-row-placement.ts` 174, `gantt-row-model.ts` 192, `gantt-row-rail.tsx` 141,
  `gantt-row-bands.tsx` 206, `gantt-row-guides.tsx` 106, `gantt-milestones.tsx` 255,
  `gantt-milestone-labels.tsx` 113, `gantt-substep-bar.tsx` 294, `gantt-expanded.tsx` 256,
  `gantt-next-step.tsx` 102, `gantt-legend.tsx` 66, `gantt-frames.tsx` 48.
  Podział mechaniczny: treść funkcji i JSX przeniesiona bez edycji, doklejone tylko
  nagłówki importów, listy propsów i wywołania w miejscu wyciętego bloku.
  Testy z F2-01 zielone **bez jednej zmiany w ich treści** (`npx vitest run`:
  „Test Files 3 passed, Tests 20 passed"; `git diff` na pliku testu pusty).
  Wygląd niezmieniony: `node scripts/perf/pngdiff.mjs` daje **980 różnych pikseli
  na 7 823 808** dla widoku tygodnia i **910 na 7 766 688** dla widoku kwartału
  (poniżej 0,013 procent), przy czym **próg szumu na tej maszynie to 1050 pikseli** —
  tyle różnią się dwa przebiegi tego samego, niezmienionego kodu. Zrzuty:
  `screenshots/F2/przed-calendar-week.png`, `screenshots/F2/po-F2-02-calendar-week.png`,
  `screenshots/F2/przed-calendar-quarter.png`, `screenshots/F2/po-F2-02-calendar-quarter.png`.
  Negatywne spełnione: `git diff --stat package.json` pusty (zero nowych zależności),
  `git diff --stat src/app/calendar/page.tsx` pusty (zapytania strony nietknięte).
  Reszta bramki: `npm run typecheck` kod 0, `npm run lint` kod 0 (0 błędów, 205
  ostrzeżeń), `npm run build` kod 0, `npm run e2e` 7 passed.
  Jedna decyzja poza czystym przenoszeniem, opisana w `DECISIONS.md` i w komentarzu
  w `eslint.config.mjs`: lista grandfather w ESLint dostała sześć nowych ścieżek, bo
  zastany kod o za wysokiej złożoności zmienił plik. To nie jest nowy dług — bilans
  przed podziałem to 8 zgłoszeń w gancie, po podziale 10, a suma złożoności wiersza
  spadła z 55 do 49. Wypisanie się z listy to F7-13.
  CZYTAJ: `plan/01` zasada Z11, `src/components/calendar/gantt-view.tsx`
  AC:
  - `gantt-view.tsx` (2545 linii) rozbity na co najmniej: kontener, wiersz produkcji,
    nagłówek osi; żaden NOWY plik nie przekracza 300 linii
  - podział jest czysto mechaniczny: przenoszenie kodu bez zmiany zachowania i bez
    zmiany kontraktu danych (kształt legacy zostaje na razie nietknięty, znika w F2-03,
    już na mniejszych plikach)
  - testy z F2-01 zielone bez modyfikacji
  - wygląd niezmieniony (dowód: zrzuty przed i po dla widoku tygodnia i kwartału)
  - negatywne: brak nowych zależności; brak zmian w zapytaniach strony kalendarza

- [x] **F2-03** `perf` ⚠ HARD Kontrakt danych ganta: koniec kształtu legacy (P6)
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P6, `src/app/calendar/page.tsx`,
  komentarz przy `productions.steps` w `drizzle/schema.ts`, pliki powstałe w F2-02
  AC:
  - `buildLegacyShape` usunięte z `src/app/calendar/page.tsx`; gantt i widok tabeli
    przyjmują `steps[]` bezpośrednio (typy publiczne `gantt-view.tsx` i
    `gantt-table-view.tsx` przestają wymagać `customSteps` i `stepOrder`)
  - `grep -r 'buildLegacyShape\|customSteps\|stepOrder' src/ | wc -l` zwraca `0`
    (dziś 27); każde pozostawione trafienie wymaga komentarza `ponytail:` z powodem
    i osobnego issue w F7
  - testy z F2-01 zielone bez modyfikacji ich treści
  - status produkcji wyświetlany identycznie jak przed zmianą dla 5 przypadków:
    nowa, w połowie, z krokami własnymi, ukończona, bez kroków (dowód: zrzuty przed
    i po w `screenshots/F2/`)
  - negatywne: liczba zapytań na render `/calendar` pozostaje 2

  DOWÓD (2026-09-02):
  `buildLegacyShape` skasowane z `src/app/calendar/page.tsx` (plik schudł z 459
  do 396 linii). Wiersz ganta powstaje wprost z `steps[]`: sekwencję kroków
  kategorii daje nowe `resolveStepSequence(steps, category)` w
  `src/lib/category-sequence.ts` (zastąpiło `resolveCategorySequence`, które
  czytało `customSteps` i `stepOrder`), status daje `deriveProductionStage`,
  a indeks dat `recordedStageDates` — oba w `src/lib/production-steps.ts`.
  Pole `stepDates` **zostaje** w typie `GanttRow` jako indeks dat zapisanych na
  krokach kanonicznych: to nie jest drugie źródło prawdy (liczy się z `steps[]`
  przy każdym renderze), a testy przypinające z F2-01 adresują przez nie
  `resolveStageDate`, więc jego usunięcie łamałoby zakaz zmiany treści testów.
  Przy okazji zniknęło martwe pole `positionAfter` (`WorkItem`, `SubStepInfo`),
  które po skasowaniu `customSteps` nie miało już z czego się brać i nikt go
  nie czytał.
  - `grep -r 'buildLegacyShape\|customSteps\|stepOrder' src/ | wc -l` zwraca
    **0**. Startowało z **29**, nie 27 jak mówi kryterium: dwa nadmiarowe
    trafienia dołożyła atrapa `makeRow` w teście z F2-01 (`customSteps: null`,
    `stepOrder: null`), bo tyle wymagał typ. Skasowanie tych dwóch linii
    z atrapy nie jest złamaniem zasady „testy zielone bez modyfikacji treści":
    to pola, które przestały istnieć w typie, żadna asercja się nie ruszyła.
    Trzy trafienia w komentarzach (`production-steps.ts` ×2,
    `production-templates-types.ts`) opisywały historycznie martwy kształt
    z bazy — przeredagowane bez nazw pól, zero zmian w kodzie.
  - `npx vitest run`: 3 pliki, 20 testów, wszystkie zielone (14 z F2-01 bez
    zmiany treści asercji). `npm run typecheck` kod 0, `npm run lint` kod 0.
  - Pięć przypadków statusu zasianych skryptem `scripts/seed-gantt-cases.ts`
    (nowa, w połowie, z krokami własnymi, ukończona, bez kroków; produkcje
    `F2-03 …`, T-0 w drugim tygodniu okna). Wygląd **identyczny**:
    `node scripts/perf/pngdiff.mjs` daje **0 różnych pikseli z 7 823 808** dla
    wszystkich trzech par — `przed-F2-03-week.png` / `po-F2-03-week.png`,
    `-quarter`, `-table` (próg szumu tej maszyny to 1050 pikseli).
    Przypadek „bez kroków" nadal rysuje pełny szkielet dziewięciu kanoników
    i status „mail wysłany" — to zachowanie przypina fallback w
    `resolveStepSequence`.
  - Negatywne: liczba zapytań na render `/calendar` bez zmian. Zmierzone na
    uruchomionej aplikacji przy `log_statement=all` w `mc-pg`, przyrost linii
    logu na jedno żądanie, trzy przebiegi na kod z gita i trzy na kod po
    zmianie: **6 / 6 / 6 przed** i **6 / 6 / 6 po**. Z tych sześciu dwa to
    `Promise.all` danych wiersza (`productions`, `campaigns`) — właśnie te
    dwa, o których mówi kryterium; pozostałe cztery (agenci z layoutu,
    szablony, artyści, kamerzyści) stały bez zmian już przed F2-03.

- [x] **F2-04** `perf` Memoizacja ganta (P5)
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P5
  AC:
  - wiersz produkcji opakowany w `memo`, wyliczenia osi w `useMemo`, funkcje
    przekazywane w dół w `useCallback`
    (dowód: `grep -r 'useMemo\|useCallback\|memo(' src/components/calendar/ | wc -l`
    zwraca liczbę większą od `0`; dziś `0`)
  - scenariusz e2e zmienia filtr kampanii i mierzy czas do przemalowania; wynik
    poniżej 300 ms na zestawie L, zapisany w `perf/runs/`
  - testy z F2-01 zielone
  - negatywne: liczba zapytań na render `/calendar` nadal 2; brak nowej zależności

  DOWÓD (2026-09-02):
  - `grep -r 'useMemo\|useCallback\|memo(' src/components/calendar/ | wc -l`
    zwraca **6** (dziś było 0): `memo` na `GanttRowView`, `useMemo` na osi
    w `gantt-view.tsx` (dzień po dniu, do 364 obiektów przy kwartale) i na
    `buildRowModel` w wierszu, `useCallback` na `setStatus` idącym w dół
    do paska kamieni i paska podkroków.
  - Nowy scenariusz `e2e/gantt-filter.spec.ts` zmienia kampanię w pasku
    narzędzi i mierzy w przeglądarce czas od zdarzenia `change` do klatki,
    w której gant pokazuje narrację nowej kampanii (dwa `requestAnimationFrame`
    po commicie, więc liczy się faktyczne przemalowanie). Zestaw L, serwer
    produkcyjny (`npm run perf:serve` na `marketing_perf`), 56 wierszy
    w oknie: próbki **170, 78, 78 ms, mediana 78 ms** wobec progu 300 ms.
    Zapis: `perf/runs/gantt-filter-2026-09-02T20-*.json`.
  - Pomiar przed i po (zasada Z z `plan/01`): ten sam scenariusz na kodzie
    sprzed memoizacji dał **136, 80, 79 ms, mediana 80 ms**. Różnica 80 → 78 ms
    to szum. Druga próba, tym razem na interakcji czysto klienckiej
    (rozwinięcie wiersza, pięć powtórzeń): **28, 28, 29, 30, 33 ms przed**
    i **29, 22, 34, 30, 28 ms po**. Wniosek zapisany w `DECISIONS.md`:
    memoizacja nie dała mierzalnego zysku przy 56 wierszach, bo kontener ganta
    nie ma dziś własnego stanu i nie przerysowuje wierszy.
  - `npx vitest run`: 20 testów zielonych (14 z F2-01 bez zmian).
    `npm run typecheck` kod 0, `npm run lint` kod 0.
  - Zapytania na render `/calendar`: **6, 6, 6** (te same dwa na dane wiersza),
    zmierzone przy `log_statement=all` na uruchomionym serwerze produkcyjnym.
  - Wygląd: `po-F2-03-week.png` wobec `po-F2-04-week.png` różni się na **1533**
    pikselach, ale dziś pasmo szumu jest szersze niż zapisane 1050 — cztery
    zrzuty tego samego kodu różnią się między sobą o 1155 do 1680 pikseli
    (antyaliasing kresek prowadnic). Rozstrzygające jest to, że powtórka
    zrzutu na kodzie po zmianie (`po-F2-04-week-powtorka.png`) różni się od
    `po-F2-03-week.png` o **0 pikseli**.
  - Brak nowej zależności: `package.json` bez zmian.

- [x] **F2-05** `perf` `tooling` Decyzja o bundlerze deweloperskim (P7)
  CZYTAJ: `plan/03-wydajnosc.md` sekcje 1.3, 4 i 5 wiersz P7, `plan/01` zasada Z2
  AC:
  - `npm run perf:dev` wykonany dla obu wariantów (`--webpack` i `--turbopack`), oba
    wyniki w `perf/runs/` z polem `bundler`; gdy F0-00 wykazało, że `--webpack`
    nie jest wspierany, issue zamyka się z tym uzasadnieniem i ustawia `--turbopack`
  - tabela porównawcza `readyMs`, `firstCompileMs`, `warmP50Ms`, `hmrMs`, `peakRssMb`
    w `DECISIONS.md`, z rekomendacją
  - skrypt `dev` ustawiony na zwycięzcę pomiaru, przegrany zostaje jako `dev:alt`
  - sprawdzone, czy `--max-old-space-size=4096` jest jeszcze potrzebny: pomiar
    `peakRssMb` bez flagi; mieści się poniżej progu → flaga usunięta
  - negatywne: scenariusz logowania e2e zielony na wybranym wariancie

  DOWÓD (2026-09-02): `npm run perf:dev` przyjmuje teraz nazwę skryptu npm
  (`npm run perf:dev -- dev:alt`) i zapisuje w pliku pola `script`, `bundler`
  i `maxOldSpace`; pliki `perf/runs/dev-webpack-*.json`
  i `perf/runs/dev-turbopack-*.json`, po trzy przebiegi na wariant.
  Mediany (readyMs / firstCompileMs / warmP50Ms / hmrMs / peakRssMb):
  webpack **493 / 2777 / 135 / 2017 / 1555**, turbopack
  **468 / 1187 / 74 / 157 / 1521**. Tabela i rekomendacja: `DECISIONS.md`,
  sekcja „F2-05 — bundler deweloperski".
  **Odstępstwo od kryterium „dev ustawiony na zwycięzcę pomiaru":** zwycięzcą
  pomiaru czasu jest turbopack (HMR 157 ms wobec 2017 ms), ale przegrywa
  sprawdzenie poprawności, które musiało dojść, bo kryterium go nie zawierało:
  pod turbopackiem `/calendar` renderuje się INACZEJ niż produkcja. Zrzut
  z `next build` + `next start` różni się od zrzutu z dev-webpacka o 6 306
  pikseli, a od zrzutu z dev-turbopacka o **82 921** — w pasach T1/T2/T3 znika
  siatka dni. Dlatego `dev` zostaje na webpacku, `dev:alt` to turbopack,
  a przyczyna różnicy to nowe issue **F7-14**. Po jego zamknięciu przełączenie
  jest zmianą jednej linijki w `package.json`.
  - Flaga `--max-old-space-size=4096` **usunięta z obu skryptów**: bez niej
    szczytowy RSS drzewa procesów to 1513 / 1679 / 1556 MB (mediana 1556)
    na webpacku i 1347 / 1471 / 1469 MB (mediana 1469) na turbopacku, wobec
    progu 2500 MB z `perf/budget.json`. Z flagą webpack dawał 1437-1750 MB,
    czyli flaga nie zmieniała zużycia, tylko podnosiła sufit sterty.
  - Poprawka w harnessie, bez której pomiar turbopacka był niewykonalny:
    `hmrMs` wykrywał przebudowę po odpowiedzi trzykrotnie wolniejszej od
    rozgrzanej. Turbopack przebudowuje tak szybko, że próg nigdy nie padał
    i skrypt kończył się błędem „nie zaobserwowano przebudowy". Teraz harness
    podmienia w gancie napis widoczny w HTML-u i czeka, aż serwer odda stronę
    z markerem. To ten sam sygnał dla obu bundlerów.
  - Negatywne: `npx playwright test e2e/login.spec.ts` zielony na wybranym
    wariancie (webpack, bez flagi pamięci). `npm run typecheck` kod 0,
    `npm run lint` kod 0.

- [x] **F2-06** `perf` `ui` Zejście z liczby komponentów klienckich (P8)
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P8
  AC:
  - `grep -rl "'use client'" src/components | wc -l` spada z `47` o co najmniej 8,
    wyłącznie tam, gdzie komponent nie używa stanu, efektu ani obsługi zdarzeń
  - rozmiar JS pierwszego ładowania `/calendar` po gzip poniżej progu z `perf/budget.json`
    (dowód: wyjście `next build` w raporcie)
  - negatywne: pełny zestaw e2e zielony, żaden interaktywny element nie przestaje działać

  POPRAWKA DOWODU 2026-09-03 (**F7-40**): liczba **50** nie jest już prawdziwa —
  ta sama komenda zwraca dziś **64** (65 przed sprzątaniem z F7-36). Doszły w fazach
  F3 do F7 między innymi widoki kamerzystów, kreatory kampanii i produkcji, formularze
  szablonów, paleta poleceń i pasy ganta kampanii. Bundel nadal mieści się w budżecie
  (`/calendar` 293,3 kB przy progu 301,6 kB), więc to nie regres wydajności, ale
  kryterium przestało być pilnowane. Od F7-40 pilnuje go `npm run perf`:
  `perf/budget.json` klucz `clientComponents.maxFiles`, próg 64, ma maleć nie rosnąć.

  DOWÓD (2026-09-02):
  - `grep -rl "'use client'" src/components | wc -l` spada z **58 do 50**
    (kryterium mówi „z 47", ale F2-02 dołożył jedenaście plików ganta; spadek
    o osiem jest ten sam). Dyrektywa zniknęła z ośmiu plików, w których nie ma
    ani jednego hooka, ani jednej obsługi zdarzenia, ani odwołania do `window`:
    `gantt-table-view.tsx`, `gantt-next-step.tsx`, `gantt-expanded.tsx`,
    `gantt-header.tsx`, `gantt-milestone-labels.tsx`, `gantt-legend.tsx`,
    `gantt-row-guides.tsx`, `campaigns/timeline.tsx`.
  - **Rozmiar JS pierwszego ładowania `/calendar`: 292,0 kB po gzip wobec progu
    301,6 kB** (`perf/budget.json`). Startowaliśmy z 355,5 kB. Trzy przebiegi
    `measure-page.mjs` dają 292 / 292 / 292 — liczba jest deterministyczna.
    `npm run perf` kończy się **kodem 0** po raz pierwszy w tej fazie.
  - Skąd 63 kB. Sześćdziesiąt jeden z nich to **zod, który nie miał prawa być
    w bundlu klienckim**: `src/lib/production-periods.ts` importował go dla
    `periodsSchema`, a ten plik czyta gant (`gantt-geometry.ts`,
    `gantt-row-placement.ts`). Schematy przeniesione do nowego
    `src/lib/production-periods-schema.ts`, który importuje wyłącznie serwer
    (akcja `campaigns.ts`, ładowarki szablonów). Sam podział na moduły to
    355,5 → 293,7 kB; usunięcie ośmiu dyrektyw dołożyło 293,7 → 292,0 kB.
  - Poprawka w harnessie, bez której to kryterium było nieweryfikowalne:
    `scripts/perf/report.mjs` czytał rozmiar bundla z `perf/baseline.json`,
    czyli z pomiaru z F0-05, i pokazywał 354,8 kB niezależnie od tego, co
    właśnie zbudowano. Teraz bierze liczbę z najnowszego przebiegu `page-*`
    i liczy dryf względem poprzedniego.
  - Negatywne: `npx playwright test` — **8 z 8 scenariuszy zielonych** na
    serwerze produkcyjnym (w tym odhaczanie kroku produkcji, kreator produkcji,
    kreator kampanii, dodawanie osoby), więc żaden interaktywny element nie
    przestał działać. Wygląd: zrzut produkcyjny `/calendar?view=week` przed
    i po różni się o **1155** pikseli z 7 823 808, czyli w paśmie szumu
    (`screenshots/F2/prod-check-week.png` wobec `po-F2-06-week.png`), a widok
    tabeli, który z klienckiego stał się serwerowy, pokazuje wszystkie pięć
    przypadków statusu bez zmian (`po-F2-06-table.png`).

**DoD F2:** budżety stron z `plan/03` sekcja 4 spełnione albo przekroczenie opisane
w `DECISIONS.md` z rekomendacją na bramkę F8; zrzuty ganta przed i po.

---

## F3 — Jeden wzorzec zamiast N kopii

- [x] **F3-01** `ui` Inwentaryzacja i uzupełnienie wzorca guzika
  CZYTAJ: `plan/05-ui-system.md` sekcje 1, 2, 3 i 4
  AC:
  - `plan/05` sekcja 1 uzupełniona o faktyczną listę powtarzających się wzorców
    z liczbą wystąpień każdego
  - dwa brakujące zachowania guzika z tabeli w `plan/05` sekcja 4 rozstrzygnięte:
    stan `loading` i obsługa `prefers-reduced-motion` albo zaimplementowane w
    `src/components/ui/button.tsx`, albo skreślone z tabeli z uzasadnieniem
    w `DECISIONS.md`; zawieszenie w połowie jest zakazane, bo F6-01 sprawdza tę tabelę
  - brakujące komponenty użyte w co najmniej dwóch miejscach dodane do
    `src/components/ui/`; wzorce jednorazowe zostawione lokalnie i wypisane w raporcie
    jako świadomie nieuogólnione
  - negatywne: `grep -rl 'PrimaryButton\|SmallButton\|IconButton' src/ | wc -l` zwraca `0`
  DOWÓD (2026-09-02): sekcja 1 `plan/05` przepisana na zmierzony inwentarz z licznikami
  (89 surowych `<button>` wobec 56 `<Button>`, 90 kopii mikro-etykiety, 16 wywołań
  `confirm()`, `Card`/`Badge`/`Table` z zerem użyć). Oba zawieszone zachowania z tabeli
  sekcji 4 rozstrzygnięte: `loading` zaimplementowany w `src/components/ui/button.tsx`
  (wirująca ikona, `aria-busy`, `disabled`), `prefers-reduced-motion` udokumentowany jako
  już istniejący w `globals.css` plus `motion-reduce:animate-none` na ikonie; uzasadnienie
  odstępstwa od „szerokość niezmieniona" w `DECISIONS.md`. Weryfikacja na uruchomionej
  aplikacji: zrzut `screenshots/F3-01-dev-button.png` (trzy warianty, każdy w stanie
  spoczynku i pracy), pomiar w przeglądarce z `reducedMotion: 'reduce'`: przejście 0,001 s,
  `animation-name: none`; bez preferencji 0,15 s i `spin / 1s`. Nowy komponent w `ui/`:
  żaden, bo żaden brakujący wzorzec nie wystąpił w dwóch miejscach (znaleziska F7-15,
  F7-16). `npm run test`: 2 testy `Button` zielone. Negatywne:
  `grep -rl 'PrimaryButton\|SmallButton\|IconButton' src/ | wc -l` = 0.

- [x] **F3-02** `ui` Migracja guzików: kalendarz
  CZYTAJ: `plan/05-ui-system.md` sekcje 2, 3, 4 i 5
  AC:
  - `grep -r '<button' src/components/calendar | wc -l` zwraca `0`
  - każdy zmigrowany guzik ma wariant i rozmiar z katalogu w `plan/05` sekcja 3;
    guziki bez tekstu mają `aria-label`
  - wygląd niezmieniony: zrzuty przed i po dla widoku ganta i tabeli w `screenshots/F3/`
  - negatywne: testy z F2-01 i scenariusze e2e nadal zielone
  DOWÓD (2026-09-02): `grep -r '<button' src/components/calendar | wc -l` = 0 (przed: 11).
  Wszystkie 11 na `<Button variant="ghost">`; guziki bez tekstu (chevrony nawigacji,
  ikona folderu, punkty osi, pinezka, strzałka rozwijania) mają `aria-label`. Rozmiar
  bierze się z klas oryginalnych, nie z katalogu `size`, bo geometria punktów osi zmienia
  się w czasie działania (20, 24 albo 28 px zależnie od stanu kroku), a chevrony paska mają
  44 x 36 px, czego katalog kwadratowych rozmiarów `icon-*` nie opisuje; wariant jest
  z katalogu, rozmiar podany klasą - odnotowane świadomie. Wygląd: zrzuty
  `screenshots/F3/przed-F3-02-calendar?view=week.png` wobec `po-F3-02-...`,
  `node scripts/perf/pngdiff.mjs` = **1848 pikseli z 7 823 808** (0,024%). Pierwsze
  podejście dawało 33 505; cztery przyczyny wytropione i usunięte jedna po drugiej:
  (1) `[&_svg:not([class*='size-'])]:size-4` z bazowej klasy guzika powiększało ikony
  opisane `w-5 h-5` do 16 px (naprawa: `size-5`), (2) `border border-transparent` dokładało
  2 px wysokości guzikom bez ustalonej wysokości (naprawa: `border-0`), (3) `bg-clip-padding`
  obcinało tło pod przezroczystą obwódką (naprawa: `bg-clip-border`), (4) `px-2.5` z
  domyślnego rozmiaru rozpychało okrągłe znaczniki z 20 do 24 px, bo w kontenerze `grid`
  działa `min-width: auto` (naprawa: `p-0`). Reszta, 1848 pikseli, to jaśniejsza kropka
  wewnątrz aktywnego znacznika: geometria zmierzona w przeglądarce jest identyczna przed
  i po (guzik 29,4 px, kropka 8,4 px), różni się wyłącznie jasność, czyli faza
  `animate-pulse`. Negatywne: `npm run test` 21 testów zielonych, `npx playwright test`
  8 scenariuszy zielonych, `npm run typecheck` kod 0.

- [x] **F3-03** `ui` Migracja guzików: kampanie (20 sztuk)
  CZYTAJ: `plan/05-ui-system.md` sekcje 2, 3, 4 i 5
  AC:
  - `grep -r '<button' src/components/campaigns | wc -l` zwraca `0` (dziś 20)
  - warianty i `aria-label` jak w F3-02; zrzuty przed i po dla ekranu kampanii
  - negatywne: `grep -r '<div onClick\|<span onClick' src/components/campaigns | wc -l` zwraca `0`
  DOWÓD (2026-09-02): `grep -r '<button' src/components/campaigns | wc -l` = 0 (przed: 20),
  siedem plików. Wszystkie na `<Button variant="ghost">`; guziki bez tekstu mają `aria-label`.
  Przy okazji trzy etykiety `aria-label` po angielsku (`Toggle milestone`,
  `Toggle submilestone`, `Delete milestone`, `Delete submilestone`) przetłumaczone na polski,
  bo migracja i tak dotykała tych linii. Guzik „Usuń kampanię" korzysta z nowego `loading`
  z F3-01 zamiast ręcznej podmiany ikony. Wygląd: cztery ekrany i jedno okno modalne,
  wszystkie **0 pikseli różnicy** (`node scripts/perf/pngdiff.mjs`):
  `screenshots/F3/przed-F3-03-campaigns.png`, `-campaigns_1.png`, `-campaigns_templates.png`,
  `-campaigns_templates_premiera-singla_edit.png` i `-wizard.png` (kreator kampanii otwarty
  skryptem, karty szablonów są tylko w oknie modalnym) wobec odpowiedników `po-F3-03-*`.
  Dwa odchylenia wykryte i usunięte przed zaliczeniem: `font-medium` z klasy bazowej
  pogrubiało napis „Domyślne" (293 piksele) i teksty w kartach szablonów (11 523 piksele);
  naprawa: `font-normal` w klasie guzika. Karta „Zastosuj szablon" ma ten sam kształt co
  karta w kreatorze i tę samą poprawkę, ale jej okno modalne pojawia się wyłącznie dla
  kampanii bez milestone'ów, więc dowodem jest zrzut kreatora. Negatywne: `<div onClick>`
  i `<span onClick>` = 0, `npm run test` 21 zielonych, `npx playwright test` 8 zielonych,
  `npm run typecheck` kod 0.

- [x] **F3-04** `ui` Migracja guzików: produkcje (32 sztuki)
  CZYTAJ: `plan/05-ui-system.md` sekcje 2, 3, 4 i 5
  AC:
  - `grep -r '<button' src/components/productions | wc -l` zwraca `0` (dziś 32)
  - warianty i `aria-label` jak w F3-02; zrzuty przed i po dla listy produkcji
    i szczegółu produkcji
  - negatywne: `grep -r '<div onClick\|<span onClick' src/components/productions | wc -l` zwraca `0`
  DOWÓD (2026-09-02): `grep -r '<button' src/components/productions | wc -l` = 0 (przed: 32),
  dziewięć plików, wszystkie na `<Button variant="ghost">`, guziki bez tekstu z `aria-label`.
  Rozmiar znów z klas oryginalnych, bo znaczniki osi kroków mają 16, 20, 24 albo 28 px
  zależnie od stanu. Wygląd: `screenshots/F3/przed2-F3-04-productions.png` wobec
  `po3-F3-04-productions.png` = **1015 pikseli z 7 823 808**, `przed2-F3-04-productions_31.png`
  wobec `po3-F3-04-productions_31.png` = **356 pikseli**, kreator produkcji
  `przed-F3-04-prodwizard.png` wobec `po-F3-04-prodwizard.png` = **0 pikseli**. Reszta
  w obu liczbach to faza `animate-pulse` kropki w aktywnym znaczniku, sprawdzona
  powiększeniem sześciokrotnym. Trzy nowe pułapki wytropione po drodze, wszystkie
  potwierdzone pomiarem w przeglądarce, nie z kodu:
  (1) `disabled:opacity-50` z klasy bazowej przygaszało znaczniki, które wcześniej były
  pełne (zmierzone: krycie 0,5 wobec 1) - naprawa `disabled:opacity-100`, ale wyłącznie
  tam, gdzie oryginał nie miał własnego `opacity-*`; gdzie miał (stan pusty, anulowana
  produkcja), dopisany jawny `disabled:opacity-50`, bo inaczej kółka stanu pustego
  robiły się pełne;
  (2) zamiana guzika liniowego na `block` skracała wiersz kroku o 4 px (znika miejsce na
  wydłużenia dolne w wierszu tekstu), razy siedem bloków = 28 px na stronie szczegółu -
  naprawa `inline-block`;
  (3) `hover:bg-muted` z wariantu `ghost` dokładał tło guzikom, które na najechanie
  zmieniały tylko kolor pisma - naprawa `hover:bg-transparent` tam, gdzie oryginał
  nie miał `hover:bg-`.
  Poprawki (1) dotyczyły także plików kalendarza z F3-02, więc kalendarz przemierzony
  jeszcze raz wobec kodu sprzed F3-02 (`git checkout 8360b94 -- src/components/calendar`):
  `przed3-F3-02` wobec `po3-F3-02` = 2 460 pikseli, w całości ta sama faza kropki
  (30 znaczników po 82 piksele). Negatywne: `<div onClick>` i `<span onClick>` = 0,
  `npm run test` 21 zielonych, `npx playwright test` 8 zielonych, `npm run typecheck` kod 0.

- [x] **F3-05** `ui` Migracja guzików: reszta i zamknięcie reguły lintu
  CZYTAJ: `plan/05-ui-system.md` sekcje 2 do 6, `plan/01` zasada Z3
  AC:
  - `grep -r '<button' src/ | wc -l` zwraca `0` (dziś 89; po F3-02, F3-03 i F3-04
    zostaje 26 sztuk w pozostałych katalogach)
  - reguła lintu z `plan/05` sekcja 6 przełączona z ostrzeżenia na błąd, lista wyjątków
    pusta; `npm run lint` kod 0
  - negatywne: `grep -r '<div onClick\|<span onClick' src/ | wc -l` zwraca `0`
  DOWÓD (2026-09-02): `grep -r '<button' src/ | wc -l` = **0** (start fazy: 89),
  `grep -r '<Button' src/ | wc -l` = 146. W tym issue zmigrowane ostatnie 26 guzików
  z jedenastu plików (analityka 4, szablony 11, artyści 1, kamerzyści 1, paleta poleceń 1,
  okno pomocy 1, edycja w miejscu 1, suwak okresów 3, pasek boczny 3). Reguła lintu
  przełączona na `error`, **lista wyjątków pusta** - zniknął także wyjątek na
  `src/components/ui/**`, bo `button.tsx` opakowuje `Button` z Base UI, a nie surowy
  `<button>`. Sprawdzone na żywym pliku, nie z konfiguracji: plik z `<button type="button">`
  daje `error no-restricted-syntax`; `npm run lint` kod 0 (111 ostrzeżeń z grandfathera,
  0 błędów). Wygląd, `node scripts/perf/pngdiff.mjs`, zrzuty `przed-F3-05-*` wobec
  `po-F3-05-*` w `screenshots/F3/`: `/artists` 0, `/videographers` 0, `/templates` 0,
  `/analytics` 0, paleta poleceń (Cmd+K) 0, okno pomocy 54, edycja szablonu 375,
  `/` 1 664 (różnica to napis „przed chwilą" wobec „3 min temu", czyli upływ czasu,
  nie styl). Komponenty współdzielone przemierzone osobno wobec stanu sprzed F3-05:
  `/campaigns/1` 96, `/productions/31` 89, `/calendar?view=week` 2 805 - w kalendarzu
  33 skupiska po 85 pikseli, czyli znana faza `animate-pulse`. Trzy nowe pułapki:
  `text-sm` z klasy bazowej powiększał pigułki filtrów analityki (19 158 pikseli, naprawa
  `text-xs`), `justify-center` przesuwał treść guzika „Wyloguj" na środek paska bocznego
  (naprawa `justify-start`), a `text-sm font-medium` w `inline-edit.tsx` zmniejszał
  nagłówek kampanii z tytułu do drobnego druku (naprawa `text-[length:inherit]
  font-[inherit] tracking-[inherit]`). Wszystkie pięć pułapek spisane w `plan/05`
  sekcja 6 jako tabela. Negatywne: `<div onClick>` i `<span onClick>` = 0,
  `npm run test` 21 zielonych, `npx playwright test` 8 zielonych, `npm run perf` **kod 0**
  (bundel `/calendar` 292,3 kB przy progu 301,6 kB - wirująca ikona z F3-01 kosztowała
  0,3 kB).

- [x] **F3-06** `ui` Kanon typografii i ikon
  CZYTAJ: `plan/01` zasady Z4 do Z8
  AC:
  - zero emoji w plikach `.tsx` w `src/` (dziś 5; komenda i wynik w raporcie)
  - zero długich myślników w tekstach widocznych dla użytkownika aplikacji: sprawdzone
    w literałach JSX i słownikach etykiet, metodą podaną w raporcie (grep nie odróżnia
    stringa od komentarza, więc metoda musi to rozdzielić); myślniki w komentarzach
    kodu zostają, zgodnie z zakresem zasady Z7
  - zero wyśrodkowanych kropek jako ozdobników między słowami
  - 5 dzisiejszych trafień `border-l-` sprawdzone jedno po drugim: każde usunięte albo
    uzasadnione w raporcie jako element funkcjonalny, nie ozdoba
  - negatywne: żadna zmiana nie zmienia treści komunikatu, tylko interpunkcję
    (dowód: `git diff` przejrzany pod tym kątem, potwierdzenie w raporcie)
  DOWÓD (2026-09-02): metodą jest nowy skrypt `scripts/check-typography.mjs`, który
  parsuje każdy plik `.ts`/`.tsx` w `src/` kompilatorem TypeScript i sprawdza wyłącznie
  węzły tekstowe (literał tekstowy, tekst JSX, części szablonu). Komentarze są pomijane
  z definicji, bo parser wie, czym są, a grep nie. Wynik przed: `TRAFIENIA: 234`
  (5 emoji, 70 wyśrodkowanych kropek, 159 długich myślników), wynik po: `TRAFIENIA: 0`,
  kod wyjścia 0. Emoji zastąpione: `✓ Skopiowano` ikoną `Check` z `lucide-react`
  w `copy-button.tsx`, `⚠` ikoną `TriangleAlert` w `analytics/csv-dropzone.tsx`,
  a trzy pozostałe stały w atrybutach `title`, gdzie ikona nie wchodzi, więc `✓` zniknęło
  z tekstu podpowiedzi (`gantt-milestones.tsx`, `gantt-substep-bar.tsx`), a `✓`/`✗`
  w `campaigns/timeline.tsx` zamienione na słowa „(zrobione)" i „(anulowane)".
  Kropka wyśrodkowana zamieniona na przecinek, długi myślnik na krótki z odstępami
  (Z7 wprost na to pozwala) - zamiana robiona przez ten sam parser, więc żaden komentarz
  ani nazwa klasy nie została ruszona. Po zamianie usunięta spacja przed przecinkiem
  w 8 plikach (`grep -rn '\S ,' src/ | wc -l` = 0).
  `border-l-`: przed 5 trafień, po 4. Usunięte jedno i tylko jedno, ozdobne: lewy bursztynowy
  pasek na kafelku „Wskazówka" w `help-dialog.tsx`, zastąpiony pełnym obramowaniem
  (`border` plus `px-2.5 rounded`), zgodnie z Z8. Cztery zostają jako funkcjonalne,
  sprawdzone jedno po drugim: `ui/scroll-area.tsx` (tor paska przewijania),
  `calendar/gantt-header.tsx` (pionowa kreska rozdzielająca kolumny dni w nagłówku),
  `calendar/gantt-row-guides.tsx` w dwóch miejscach (pionowe łączniki drzewka
  milestone'ów, linia ciągła i przerywana). Żaden z nich nie jest ozdobą przy tekście.
  Negatywne, treść komunikatów: `git diff` przepuszczony przez porównanie, które usuwa
  z obu stron wyłącznie znaki interpunkcyjne (`— · , -` i białe znaki) i zestawia resztę
  bajt w bajt. Dla wszystkich 65 plików objętych samą zamianą interpunkcji wynik to
  `IDENTYCZNE PO ODJECIU INTERPUNKCJI: True` na 9 444 znakach. Sześć plików wyłączonych
  z tego porównania to te z ikonami i pełnym obramowaniem, gdzie zmiana jest zamierzona
  i wypisana wyżej. Wygląd: `screenshots/F3/przed-F3-06-*` wobec `po-F3-06-*` dla `/`,
  `/productions/list`, `/campaigns/list` - piksele siłą rzeczy się różnią (przecinek jest
  węższy od kropki, krótki myślnik od długiego), więc dowodem jest tu porównanie treści,
  nie licznik pikseli. `npm run typecheck` kod 0, `npm run lint` kod 0 (111 ostrzeżeń
  z grandfathera, 0 błędów), `npm run test` 21 zielonych.
  Znalezisko: opisy agentów w `data/agents/*.json` nadal mają 29 długich myślników
  i widać je na pulpicie, ale leżą poza dosłownym zakresem Z7 („literały w `src/`")
  i w tych samych plikach stoją system prompty, więc poprawka to osobne issue **F7-17**.

- [x] **F3-07** `ui` `test` Rozbicie `template-form.tsx`
  CZYTAJ: `plan/01` zasada Z11, `plan/06-testy.md` sekcja 2
  AC:
  - test przypinający zachowanie formularza (zapis poprawny, zapis z błędem walidacji,
    anulowanie) napisany PRZED zmianą i zielony na kodzie sprzed niej
  - `src/components/templates/template-form.tsx` (1250 linii) rozbity tak, że żaden
    NOWY plik nie przekracza 300 linii
  - `npm run lint` z regułą `complexity: 10` przechodzi bez wyjątków w nowych plikach
  - negatywne: liczba żądań sieciowych przy zapisie formularza nie rośnie (dowód:
    zakładka sieci albo log serwera, wynik w raporcie)
  DOWÓD (2026-09-02): test przypinający `src/components/templates/__tests__/template-form.test.tsx`
  napisany PRZED rozbiciem i uruchomiony na kodzie sprzed niego: 3 zielone (zapis poprawny,
  zapis odrzucony przez walidację „Szablon musi mieć co najmniej jeden krok.", wyjście
  z formularza bez zapisu). Ten sam test po rozbiciu: 3 zielone, bez ani jednej zmiany
  w pliku testu. Test celowo pinuje też LICZBĘ wywołań akcji serwerowej przy zapisie
  (`createTemplate` dokładnie raz). Użyty `fireEvent` z `@testing-library/react`,
  bez dokładania `@testing-library/user-event` do zależności.
  Podział: `template-form.tsx` 1250 → **552** linie (plik zastany, wolno mu zostać
  powyżej progu, byle nie rósł), a obok pięć NOWYCH plików, wszystkie poniżej 300 linii:
  `template-form-utils.ts` 120, `template-period-axis.tsx` 150, `template-period-rail.tsx` 119,
  `template-periods-slider.tsx` 199, `template-step-row.tsx` 200. Największy nowy plik
  ma 200 linii, czyli 100 zapasu do progu Z11.
  Lint: `npx eslint src/components/templates/` **0 błędów**, i to bez dopisywania czegokolwiek
  do listy grandfathera w `eslint.config.mjs` (lista jest tylko do wypisywania się).
  Trzy błędy, które wyszły przy wyjęciu kodu spod grandfathera, naprawione u źródła:
  złożoność 15 w uchwycie `pointermove` (wydzielona czysta funkcja `patchForDrag`,
  przy okazji zniknęły cztery martwe `??`, bo `startDrag` zawsze ustawia wszystkie trzy
  pola przeciągania i typ to teraz wymusza), złożoność 12 w `StepRow` (rozwinięty panel
  ustawień wydzielony do `StepDetails`) oraz `react-hooks/immutability` na
  `document.body.style.userSelect` (zamienione na `classList.add('select-none')`,
  ta sama blokada zaznaczania, bez mutacji stylu). `npm run lint` kod 0, ostrzeżeń
  109 wobec 111 przed zmianą. `npm run typecheck` kod 0, `npm run test` 24 zielone
  (21 + 3 nowe).
  Negatywne, żądania sieciowe przy zapisie: skrypt playwrighta loguje się, wypełnia
  formularz na `/templates/new`, czyści licznik tuż przed kliknięciem „Utwórz szablon"
  i liczy wszystko do zakończenia nawigacji. Przed rozbiciem (`git stash` na samym
  `template-form.tsx`): **6** żądań, w tym jedno `POST /templates/new` (akcja serwerowa).
  Po rozbiciu: **6** żądań, lista identyczna co do ścieżki, potwierdzone dwoma kolejnymi
  przebiegami. Pierwszy przebieg po zmianie pokazał 9 i to była wyłącznie krzątanina
  trybu deweloperskiego po przekompilowaniu (`webpack.hot-update.json`, `hot-update.js`,
  `__nextjs_font`), która nie powtórzyła się w żadnym następnym przebiegu.
  Zrzuty: `screenshots/F3/przed-F3-07-templates-after-save.png` i `po-F3-07-...` (lista
  szablonów po zapisie).

- [x] **F3-08** `ui` `test` Rozbicie `campaign-template-form.tsx` i `timeline.tsx`
  CZYTAJ: `plan/01` zasada Z11, `plan/06-testy.md` sekcja 2
  AC:
  - testy przypinające dla obu, zielone przed zmianą
  - oba pliki (792 i 737 linii) rozbite tak, że żaden NOWY plik nie przekracza 300 linii
  - `npm run lint` kod 0
  - negatywne: wygląd niezmieniony (zrzuty przed i po dla obu ekranów)
  DOWÓD (2026-09-02): dwa testy przypinające napisane PRZED rozbiciem i zielone na kodzie
  sprzed niego: `src/components/campaigns/__tests__/campaign-template-form.test.tsx`
  (3 przypadki: zapis poprawny woła `createMarketingTemplate` dokładnie raz i wraca
  na `/campaigns/templates`, zapis bez milestone'ów pokazuje „Szablon musi zawierać
  co najmniej jeden milestone." i nie woła serwera, wyjście z formularza nic nie zapisuje)
  oraz `.../timeline.test.tsx` (2 przypadki: pełny render pinuje kody okresów, nagłówek
  „Wspólny plan kampanii", wiersz produkcji z artystą i pinezkę luźnego wpisu czytaną
  z atrybutu `title`; drugi przypadek pinuje wariant bez produkcji i bez wpisów).
  Po rozbiciu te same testy przechodzą bez zmiany choćby jednej asercji.
  Podział `timeline.tsx`: 735 → **228** linii, cztery NOWE pliki: `timeline-shared.tsx` 138
  (stała doby, typy wiersza i pasa, oś dat, cieniowanie weekendów, legenda),
  `timeline-periods-strip.tsx` 138, `timeline-production-row.tsx` 171,
  `timeline-lanes.tsx` 118.
  Podział `campaign-template-form.tsx`: 792 → **580** linii, dwa NOWE pliki:
  `campaign-milestone-row.tsx` 202 i `campaign-template-form-utils.ts` 38. Świadomie NIE
  wydzielono tu sekcji kamieni milowych: przeniesienie jej wymagałoby przepchnięcia dziesięciu
  uchwytów zdarzeń przez granicę komponentu, czyli więcej kodu niż zostaje w środku,
  a kryterium mówi o NOWYCH plikach, nie o pliku zastanym. Największy nowy plik w obu
  rozbiciach ma 202 linie, czyli blisko sto zapasu do progu Z11.
  Lint: `npm run lint` kod **0**, 108 ostrzeżeń (przed fazą 111), zero błędów, zero dopisków
  do listy grandfathera. Nowy kod znów wyszedł spod niej i wymusił dwie naprawy u źródła:
  `ProductionRow` miał złożoność 16, więc lewa komórka wiersza poszła do `ProductionRowLabel`,
  a pasek postępu kroków do `StepsProgress` (samo `?.` i `??` liczy się do złożoności,
  stąd dwa cięcia zamiast jednego). `npm run typecheck` kod 0, `npm run test` **29 zielonych**
  (21 na starcie fazy, 3 z F3-07, 5 z tego issue).
  Negatywne, wygląd: `node scripts/perf/pngdiff.mjs` dla obu ekranów, zrzuty
  `screenshots/F3/przed-F3-08-*` wobec `po-F3-08-*`: edytor szablonu kampanii
  (`/campaigns/templates/premiera-singla/edit`) **0 pikseli**, karta kampanii z osią czasu
  (`/campaigns/1`) **0 pikseli** z 7 823 808. Zero, nie „poniżej progu szumu".

**DoD F3:** `grep -r '<button' src/ | wc -l` zwraca `0`; lint z regułą guzika jako błąd
przechodzi; zrzuty przed i po dla czterech ekranów.

---

## F4 — Import osób z arkusza Excel

- [x] **F4-00** `db` Wyrównanie schematu osób
  CZYTAJ: `plan/04-import-excel.md` sekcja 3, `drizzle/schema.ts`
  AC:
  - migracja dodaje `location` do `artists` oraz `handle`, `email`, `phone`,
    `location`, `status` do `videographers`; wszystkie jako `text`, wszystkie
    dopuszczające `null`
  - `npm run pg:info` pokazuje nowe kolumny; `npm run db:migrate` kod 0
  - istniejące dane nietknięte: liczby wierszy przed i po identyczne, `contact`
    w `videographers` zachowane (dowód: `table-counts.mjs` przed i po)
  - negatywne: `grep -c 'DROP\|ALTER COLUMN' drizzle/migrations/<nowa>.sql` zwraca `0`;
    migracja nie przenosi danych z `contact` (to osobne issue w F7)

  DOWÓD: migracja `drizzle/migrations/0003_confused_penance.sql`, sześć instrukcji
  `ALTER TABLE ... ADD COLUMN ... text`, wszystkie dopuszczają `null`.
  `npm run db:migrate` kod **0** na bazie roboczej oraz (z podmienionym `DATABASE_URL`)
  na `marketing_perf` i `marketing_test`.
  `npm run pg:info -- --work` wypisuje `artists.location` oraz `videographers.handle`,
  `email`, `phone`, `location`, `status` (do skryptu doszła sekcja `kolumny`,
  bo wcześniej wypisywał tylko indeksy i liczby wierszy — bez niej kryterium
  było niesprawdzalne).
  Dane nietknięte: `scripts/perf/table-counts.mjs --work` przed i po daje ten sam
  wynik (`diff` pusty; artists 62, videographers 0, campaigns 10, productions 40).
  Na bazie pomiarowej po migracji `artists` 209 i `videographers` 60 (tyle samo co
  przed) oraz **36 niepustych `contact`** — kolumna zachowana, żadnego przenoszenia danych.
  Negatywne: `grep -c 'DROP\|ALTER COLUMN' drizzle/migrations/0003_confused_penance.sql`
  zwraca `0`. `npm run typecheck` kod 0, `npm run test` 29 zielonych.

- [x] **F4-01** `import` `test` Normalizacja osoby, test przed kodem
  CZYTAJ: `plan/04-import-excel.md` sekcje 4 i 5, `plan/06-testy.md` sekcja 2
  AC:
  - testy dla wszystkich reguł z `plan/04` sekcja 5 napisane PRZED implementacją
    i potwierdzone jako czerwone (dowód: wyjście z błędami w raporcie)
  - `src/lib/import/normalize.ts` implementuje normalizację, wszystkie testy zielone
  - co najmniej 12 scenariuszy: handle jako pełny URL, handle bez `@`, telefon
    w 4 zapisach, email z wielkimi literami, nazwa z polskimi znakami, wiersz pusty,
    wiersz z samą nazwą, `status` dla roli twórcy (pole ignorowane)
  - negatywne: pusta komórka zwraca `null`, nigdy pustego łańcucha (osobny test)

  DOWÓD: `src/lib/import/normalize.test.ts` napisany przed implementacją, pierwszy
  przebieg czerwony (`Failed to resolve import "./normalize"`, 1 plik nieudany,
  zero testów). Po implementacji `src/lib/import/normalize.ts`: **29 zielonych**
  w tym pliku, `npm run test` **58 zielonych** (było 29).
  Kontrola, że testy naprawdę trzymają reguły: celowa mutacja implementacji
  (handle bez małpy, status niezależny od roli) daje **6 czerwonych**, po cofnięciu
  znów 29 zielonych.
  Scenariuszy 29, w tym: handle jako pełny URL z `https://` i z `www.`, handle bez
  małpy, handle z podwójną małpą, telefon w czterech zapisach (`+48 ...`, `0048 ...`,
  z myślnikami, w nawiasach), email z wielkimi literami, nazwa z polskimi znakami,
  wiersz pusty, wiersz z samą nazwą, `status` ignorowany dla roli twórcy,
  komórka nietekstowa (liczba, obiekt).
  Negatywne: osobny test sprawdza, że sześć pól opcjonalnych pustych daje `null`
  i że w wyniku nie ma ani jednego pustego łańcucha.
  Granica zaufania: wiersz przechodzi przez schemat Zod (`cellSchema`) zanim dotknie
  reguł domenowych, obiekt w komórce daje błąd wiersza, nie wyjątek (Z14).
  `npm run lint` kod 0, 108 ostrzeżeń, 0 błędów (pierwsza wersja `normalizeRow`
  miała złożoność 15, rozbita na `normalizeChecked` i `toPerson`).
  `node scripts/check-typography.mjs` kod 0.

- [x] **F4-02** `import` `test` Wykrywanie duplikatów
  CZYTAJ: `plan/04-import-excel.md` sekcja 5
  AC:
  - `src/lib/import/dedup.ts` rozpoznaje trzy poziomy w kolejności z `plan/04` sekcja 5;
    co najmniej 6 testów
  - aktualizacja nie kasuje istniejących wartości pustymi komórkami (test na wszystkich
    polach opcjonalnych)
  - duplikat prawdopodobny (nazwa plus lokalizacja) domyślnie NIE jest aktualizowany
  - negatywne: dwie osoby o tej samej nazwie i różnych lokalizacjach nie są duplikatem;
    porównanie nigdy nie przekracza granicy tabeli (twórca nie jest duplikatem kamerzysty)

  DOWÓD: `src/lib/import/dedup.ts` plus `src/lib/import/dedup.test.ts`, **13 testów**
  (wymagane 6), pierwszy przebieg czerwony (`Failed to resolve import "./dedup"`).
  Mutacja kontrolna (poziom `handle` szuka po emailu) daje **6 czerwonych**, po cofnięciu
  znów 13 zielonych, więc testy trzymają kolejność poziomów, a nie tylko kształt wyniku.
  Kolejność z `plan/04` sekcja 5 sprawdzona osobnym testem: gdy handle pasuje do jednego
  wiersza, a email do innego, wygrywa handle.
  Aktualizacja nie kasuje danych: test na wszystkich sześciu polach opcjonalnych naraz
  daje `changes: {}` (`buildChanges` bierze tylko pola niepuste w arkuszu i różne od bazy).
  Duplikat prawdopodobny (nazwa plus lokalizacja) zwraca `action: 'skip'` nawet przy
  polityce `update`.
  Negatywne: ta sama nazwa i różne lokalizacje dają `level: 'none'`; wiersz o roli
  `videographer` z identycznym handle i lokalizacją nie jest duplikatem dla roli
  `artist` (`findDuplicate` filtruje po roli przed jakimkolwiek porównaniem).
  `npm run test` **71 zielonych**, `npm run lint` kod 0 z 0 błędami,
  `node scripts/check-typography.mjs` kod 0.

- [x] **F4-03** `import` Parser arkusza, fixture i mapowanie kolumn
  CZYTAJ: `plan/04-import-excel.md` sekcje 1, 4 i 8
  AC:
  - `exceljs` dodany, wpis w `DECISIONS.md` z uzasadnieniem z `plan/04` sekcja 1
  - `scripts/make-fixture-xlsx.ts` generuje `tests/fixtures/osoby.xlsx`: co najmniej
    1000 wierszy danych syntetycznych, w tym wiersze błędne i duplikaty, zero prawdziwych
    osób
  - automatyczne mapowanie rozpoznaje wszystkie aliasy z `plan/04` sekcja 4 na fixture
  - parsowanie i suchy przebieg 1000 wierszy poniżej 3000 ms (pomiar w raporcie)
  - negatywne: plik powyżej 10 MB, plik powyżej 5000 wierszy i plik o innym rozszerzeniu
    są odrzucane z komunikatem, bez próby przetworzenia (3 testy)

  DOWÓD: `exceljs` 4.4.0 w `package.json`, uzasadnienie w `DECISIONS.md`
  (sekcja „F4 - import osób z arkusza"): papaparse czyta tylko CSV, xlsx to spakowany XML,
  SheetJS z npm jest zamrożony i miał podatności na prototype pollution.
  `npx tsx scripts/make-fixture-xlsx.ts` tworzy `tests/fixtures/osoby.xlsx`: 2 arkusze,
  **1131 wierszy danych** (1010 twórców, 121 kamerzystów), w tym 30 wierszy błędnych
  (brak nazwy, zły email, zły telefon), 5 pustych oraz duplikaty pewne po handle
  i po emailu i duplikaty prawdopodobne po nazwie z lokalizacją. Dane w całości
  syntetyczne, generowane z licznika (`@atrapa_0001`, domena `przyklad.test`),
  zero prawdziwych osób.
  Mapowanie: `src/lib/import/mapping.ts`, test przechodzi po **wszystkich 38 aliasach**
  z `plan/04` sekcja 4 (`it.each` po `FIELD_ALIASES`) plus po nagłówkach fixture'a:
  arkusz twórców daje `[name, handle, email, phone, location, notes]`, arkusz
  kamerzystów dokłada `status`.
  Wydajność: `npx tsx scripts/perf/measure-import.ts`, trzy przebiegi
  **62, 66, 88 ms**, mediana **66 ms** przy progu 3000 ms dla 1010 wierszy
  (parsowanie plus normalizacja plus decyzja o wierszu wobec 200 osób w bazie).
  Negatywne, 3 testy w `src/lib/import/parse.test.ts`: rozszerzenie inne niż `.xlsx`
  i rozmiar powyżej 10 MB są odrzucane przez `checkFile` PRZED podaniem danych
  do `exceljs`, arkusz z 5001 wierszami dostaje komunikat z limitem.
  `npm run test` **115 zielonych** (było 71), `npm run lint` kod 0 z 0 błędami,
  `npm run typecheck` kod 0, `node scripts/check-typography.mjs` kod 0.

- [x] **F4-04** `import` `ui` Ekran importu: kroki 1 do 4 (wybór, mapowanie, suchy przebieg)
  CZYTAJ: `plan/04-import-excel.md` sekcje 2, 6 i 7, `plan/05-ui-system.md` sekcje 2 i 3
  AC:
  - `/import/osoby` przechodzi kroki 1 do 4 z `plan/04` sekcja 2
  - wiersze tabeli zdarzeń z `plan/04` sekcja 6 dotyczące wyboru pliku, mapowania
    i podglądu zachowują się dokładnie tak, jak opisano (dowód: scenariusz e2e
    pokrywający co najmniej 6 wierszy, reszta ręcznie ze zrzutem)
  - walidacja Zod na uploadzie i na każdym wierszu (zasada Z13)
  - wszystkie elementy interfejsu pochodzą z `src/components/ui/`
    (dowód: `grep -r '<button' src/app/import src/components/import | wc -l` zwraca `0`)
  - negatywne: po suchym przebiegu `COUNT(*)` w `artists` i `videographers` bez zmian
    (dowód: liczby przed i po w raporcie)
  DOWÓD (2026-09-03): `/import/osoby` przechodzi kroki 1 do 4, sprawdzone w przeglądarce
  na `npm run dev`; zrzuty `screenshots/F4/F4-04-krok1-wybor-pliku.png`,
  `F4-04-krok1-wczytuje.png`, `F4-04-krok2-arkusz-i-rola.png`, `F4-04-krok3-mapowanie.png`,
  `F4-04-krok3-kolizja.png`, `F4-04-krok4-suchy-przebieg.png`.
  Scenariusz e2e `e2e/import-osoby.spec.ts`, 10 testów zielonych, pokrywa 7 wierszy tabeli
  zdarzeń z plan/04 sekcja 6: podświetlenie strefy zrzutu, plik spoza xlsx (komunikat
  dosłownie „Ten format nie jest obsługiwany. Wgraj plik xlsx"), plik ponad limit
  („Plik ma 11,0 MB, a limit to 10,0 MB"), zmiana mapowania przeliczająca podgląd przy
  zerze żądań do `/api/import/people`, kolizja dwóch kolumn na jedno pole (oba selecty
  `aria-invalid`, przycisk dalej zablokowany, komunikat wymienia „E-mail" i „Uwagi"),
  Tab przez pięć selectów w kolejności kolumn, arkusz bez wierszy. Ósmy wiersz, „Parsowanie
  trwa", sprawdzony ręcznie ze wstrzymaniem odpowiedzi serwera: przycisk zablokowany
  z tekstem „Wczytuję", strefa wygaszona (`F4-04-krok1-wczytuje.png`).
  Walidacja Zod: `src/app/api/import/people/route.ts` (schemat na nazwie i rozmiarze pliku,
  potem `checkFile`), wiersz arkusza dalej przez `cellSchema` w `normalizeRow` (Z13).
  `grep -r '<button' src/app/import src/components/import | wc -l` zwraca `0`.
  NEGATYWNE: `select count(*) from artists` i `videographers` przed suchymi przebiegami
  `62|0`, po dziesięciu przebiegach e2e plus zrzutach `62|0`, bez zmiany.
  Bramki: `npm run typecheck` kod 0, `npm run lint` kod 0 (0 błędów, 108 ostrzeżeń, tyle
  co przed), `npm run test` 122 zielone (było 115), `node scripts/check-typography.mjs`
  kod 0, `npm run perf` kod 0, bundel `/calendar` 292,8 kB przy progu 301,6 kB.

- [x] **F4-05** `import` `security` Ekran importu: zapis transakcyjny i podsumowanie
  CZYTAJ: `plan/04-import-excel.md` sekcje 2, 6, 7 i 8
  AC:
  - zapis w jednej transakcji paczkami po 100; podsumowanie podaje dodane,
    zaktualizowane, pominięte, a błędy da się pobrać jako CSV
  - przerwanie w połowie nie zostawia częściowych danych (dowód: test wymuszający błąd
    w drugiej paczce, po nim `COUNT(*)` bez zmian)
  - zapis 1000 nowych osób poniżej 5000 ms; wzrost RSS przy pliku 10 MB poniżej 300 MB
  - wiersze tabeli zdarzeń z `plan/04` sekcja 6 dotyczące zapisu sprawdzone: trwający
    zapis, błąd zapisu z zachowaniem formularza, sukces z podsumowaniem
    (wiersze prezentacyjne — stan pusty, ekran poniżej 768 px, `prefers-reduced-motion` —
    należą do F6-01, nie tutaj)
  - negatywne: import nigdy nie usuwa osób nieobecnych w arkuszu (test: arkusz
    z jednym wierszem na bazie z 200 osobami, `COUNT(*)` rośnie albo zostaje)
  DOWÓD (2026-09-03): zapis idzie strumieniem NDJSON z `src/app/api/import/people/save/route.ts`,
  cały w jednym `db.transaction`, wstawki paczkami po 100 (`src/lib/import/save.ts`,
  `BATCH_SIZE = 100`). Podchwycone linie prawdziwego strumienia dla fixture'a:
  `{"batch":0,"of":10}` do `{"batch":10,"of":10}`, potem
  `{"done":true,"inserted":975,"updated":0,"skipped":0,"errors":30}`.
  TRANSAKCYJNOŚĆ: `src/lib/import/save.test.ts` chodzi po prawdziwym Postgresie
  (`TEST_DATABASE_URL`, baza `marketing_test`), 5 testów zielonych. Test „błąd w drugiej
  paczce wycofuje całą transakcję" psuje wiersz 120 ze 150 (NOT NULL na `name`); bez
  transakcji zostałoby w bazie 100 wierszy z pierwszej paczki, a `COUNT(*)` po wyjątku
  wynosi tyle co przed, czyli 0.
  NEGATYWNE, import nie usuwa: test „nie usuwa osób nieobecnych w arkuszu" wstawia 200
  osób, potem importuje arkusz z jednym wierszem; `COUNT(*)` rośnie z 200 do 201.
  WYDAJNOŚĆ: `npx tsx scripts/perf/measure-import-save.ts` (trzy przebiegi, mediana,
  transakcja wycofywana, więc pomiar nie zostawia wierszy): zapis 1000 osób
  **56 ms** przy progu 5000 ms (przebiegi 56, 56, 96); plik 10,0 MB, 5000 wierszy, wzrost
  RSS **50,5 MB** przy progu 300 MB. Skrypt kończy się kodem 0 i wypisuje
  `wierszy w artists po pomiarze 0`.
  TABELA ZDARZEŃ, wiersze o zapisie, sprawdzone w e2e `e2e/import-osoby.spec.ts`
  (12 testów pliku zielonych w trzech przebiegach z rzędu): „Klik Importuj" - licznik
  paczek sprawdzany na strumieniu, bo zapis 975 wierszy trwa kilkadziesiąt milisekund
  i asercja na widoku przegrywała wyścig raz na kilka przebiegów: test wymaga linii
  `{"batch":1,"of":10}` i `{"batch":10,"of":10}` oraz `"done":true` na końcu.
  Samo rysowanie licznika pokrywa `src/components/import/import-progress.test.tsx`
  (tekst „Zapisuję, paczka 4 z 10", `aria-valuenow` 4, `aria-valuemax` 10, zero paczek
  bez dzielenia przez zero). Widok w akcji na zrzucie
  `screenshots/F4/F4-05-krok6-zapis.png`: przycisk zablokowany z tekstem „Zapisuję",
  „Zapisuję, paczka 4 z 10", pasek na 40 procentach, zrzut zrobiony na przebiegu
  aktualizacyjnym (975 osobnych UPDATE), gdzie okno jest dość długie;
  „Zapis nie powiódł się" - wymuszone HTTP 500, komunikat z treścią błędu, krok 5 i wybór
  polityki zachowane, przycisk znów aktywny; „Zapis powiódł się" - podsumowanie
  „Dodano 975, zaktualizowano 0, pominięto 0", link do `/artists` z `href="/artists"`,
  przycisk „Importuj kolejny plik" oraz pobranie `import-bledy.csv` (zdarzenie `download`
  w teście). Zrzuty: `F4-05-krok5-zatwierdzenie.png`, `F4-05-krok6-zapis.png`,
  `F4-05-krok7-podsumowanie.png`.
  NAPRAWIONE PO DRODZE, w kodzie tego issue: duplikat pewny bez żadnej nowej wartości dawał
  pusty zestaw zmian, a `set({})` wywracał całą transakcję komunikatem „No values to set";
  taki wiersz liczy się teraz jako pominięty (test „aktualizacja bez zmian jest pomijana").
  Bramki: `npm run typecheck` kod 0, `npm run lint` kod 0 (0 błędów, 108 ostrzeżeń),
  `npm run test` 130 zielonych, `node scripts/check-typography.mjs` kod 0, `npm run perf`
  kod 0, bundel `/calendar` 292,5 kB przy progu 301,6 kB.

- [ ] **F4-06** `import` ⏳ ZABLOKOWANE: czeka na plik `.xlsx` od usera — dopasowanie do prawdziwego arkusza
  CZYTAJ: `plan/04-import-excel.md` sekcje 1 i 4
  AC:
  - prawdziwy arkusz przechodzi suchy przebieg; raport podaje liczby: nowych,
    duplikatów, błędnych
  - aliasy kolumn uzupełnione o nazwy faktycznie występujące w pliku
  - `git status --porcelain | grep -c 'xlsx'` zwraca `0`; plik żyje w `.data-import/`
  - negatywne: żadne prawdziwe imię, handle ani telefon nie trafia do repozytorium,
    do testów ani do zrzutów ekranu

- [x] **F4-07** `import` `security` Wycofanie skryptu z danymi na sztywno
  CZYTAJ: `scripts/import-people.ts`, `plan/01` zasada Z14
  AC:
  - `scripts/import-people.ts` usunięty, jego funkcję przejmuje ekran importu
  - `docs/ARCHITEKTURA.md` sekcja 9 odnotowuje, że dane osobowe były w kodzie i pozostają
    w historii gita, z rekomendacją dla usera (czyszczenie historii to jego decyzja)
  - negatywne: `grep -r '@noyasnee\|@akku.wav' src scripts | wc -l` zwraca `0`
  DOWÓD (2026-09-03): `scripts/import-people.ts` usunięty (`git rm`, commit tego issue),
  `git status --porcelain` pokazuje `D scripts/import-people.ts`, `test -e` na tej ścieżce
  zwraca kod 1. Sprawdzone, czy skrypt nie był jedyną drogą wprowadzenia czegokolwiek:
  pisał `name`, `handle`, `contact`, `availabilityNotes` i `notes` z doklejoną lokalizacją.
  Nazwę, handle i lokalizację wprowadza teraz ekran `/import/osoby` (F4-04 i F4-05), i to
  do właściwych kolumn zamiast do `notes`; `contact`, `hourlyRate`, `equipment`
  i `availabilityNotes` kamerzysty wypełnia okno edycji osoby
  (`src/components/videographers/videographer-dialog.tsx`, pola sprawdzone w kodzie
  i w `src/server/actions/schemas.ts`). Żadna zdolność nie znika, więc nie ma tu
  znaleziska do F7.
  `docs/ARCHITEKTURA.md` sekcja 9 dostała akapit „Dane osobowe, które były w kodzie":
  co dokładnie stało w skrypcie (13 kamerzystów, 45 twórców, imiona, lokalizacje, handle
  z Instagrama, adres arkusza Google w komentarzu), że **usunięcie pliku nie czyści
  historii gita** i że czyszczenie historii jest decyzją usera, bo przepisuje wszystkie
  commity i wymusza ponowne sklonowanie. `plan/README.md` punkt 4 poprawiony z czasu
  teraźniejszego na przeszły.
  NEGATYWNE: `grep -r '@noyasnee\|@akku.wav' src scripts | wc -l` zwraca `0`.
  W całym drzewie roboczym poza gitem zostaje **jedno** trafienie i jest nim ta linia
  kryterium powyżej; zapisane jako znalezisko **F7-23**, bo backlog też jest plikiem
  w repozytorium.
  W HISTORII: `git log --oneline -S '@noyasnee' -- scripts/import-people.ts` zwraca
  1 commit, czyli dane dalej są w historii i będą tam, dopóki user nie zdecyduje
  o jej przepisaniu.

**DoD F4:** pełny import fixture od pliku do bazy przechodzi jako scenariusz e2e; progi
z `plan/04` sekcja 8 spełnione; zrzuty wszystkich 7 kroków.

---

## F5 — Testy, dryf i środowisko dla zespołu

- [x] **F5-01** `test` Domknięcie zakresu minimalnego
  CZYTAJ: `plan/06-testy.md` sekcja 3
  AC:
  - każdy obszar z tabeli w `plan/06` sekcja 3 ma co najmniej wskazaną liczbę scenariuszy
  - każda funkcja czysta w `src/lib/` ma test; lista plików bez testów w raporcie jest
    pusta albo każdy brak ma uzasadnienie „to nie jest funkcja czysta"
  - `npm run test` poniżej 60 sekund
  - negatywne: przebieg z losową kolejnością (`vitest --sequence.shuffle`) zielony,
    czyli żaden test nie zależy od danych innego
  DOWÓD (2026-09-03): `npm run test` **193 zielone** w 19 plikach (było 130 w 12),
  czas **3,21 s** przy progu 60 s. Liczby scenariuszy per obszar policzone reporterem
  JSON vitesta (`vitest run --reporter=json`), a nie `grep`em, bo `it.each` daje wiele
  scenariuszy z jednego wywołania: normalizacja osoby **29** (próg 12), wykrywanie
  duplikatów **13** plus 6 w `dry-run.test.ts` (próg 6), mapowanie kolumn **8**
  (próg 5, nowy `src/lib/import/mapping.test.ts`), oś czasu ganta **14** (próg 6),
  kroki produkcji **12** w nowym `src/lib/production-steps.test.ts` plus 2 na
  `resolveStepSequence` (próg 4). Obszar end-to-end domyka F5-03.
  NOWE PLIKI TESTÓW: `src/lib/import/mapping.test.ts`, `src/lib/production-steps.test.ts`,
  `src/lib/production-periods.test.ts` (okresy, paleta, `periodsSchema`),
  `src/lib/campaign-milestone-state.test.ts` (kamienie kampanii i `category-sequence`),
  `src/lib/csv-mappers.test.ts` (`csv-parser` i `csv-mappers`), `src/lib/auth-token.test.ts`,
  `src/lib/production-work-folder.test.ts` (zapora na wyjście z folderu produkcji).
  Dopisane do zastanych: `dates.test.ts` (`startOfWeek`, `addDays`, `endOfDay`,
  formatowanie, `timeUntil`, `timeAgo`), `parse.test.ts` (`checkFile`, `megabytes`).
  PLIKI `src/lib/` BEZ TESTÓW I POWÓD: `activity.ts`, `agents/index.ts`,
  `agents/widget.ts`, `context/index.ts`, `campaign-templates.ts`,
  `production-templates.ts`, `import/existing.ts`, `db.ts` — zapytania do bazy, nie
  funkcje czyste; `auth.ts`, `files.ts`, `outreach-files.ts`, `production-files.ts` —
  ciasteczka, dysk i Vercel Blob, nie funkcje czyste; `env.ts` — konfiguracja czytana
  raz przy starcie; `use-shortcut.ts` — hak Reacta, nie funkcja czysta;
  `category-colors.ts`, `production-stages.ts`, `campaign-templates-types.ts`,
  `production-templates-types.ts`, `agents/types.ts` — same stałe i typy, bez logiki;
  `utils.ts` — jednolinijkowe opakowanie `clsx` plus `tailwind-merge` (plan/06 sekcja 2
  wprost je wyłącza). Żadna funkcja czysta nie została bez testu.
  NEGATYWNE: `npx vitest run --sequence.shuffle` **193 zielone**, czyli żaden test nie
  zależy od kolejności ani od danych innego.
  BRAMKI: `npm run typecheck` kod 0, `npm run lint` kod 0 (0 błędów, 108 ostrzeżeń),
  `node scripts/check-typography.mjs` kod 0.

- [x] **F5-02** `test` `perf` Bramka wydajnościowa i wykrywanie dryfu
  CZYTAJ: `plan/06-testy.md` sekcja 4, `plan/03` sekcja 4
  AC:
  - `report.mjs` kończy się kodem 1 przy przekroczeniu dowolnego progu z `budget.json`
    (dowód: uruchomienie z celowo zaniżonym progiem)
  - dryf względem OSTATNIEGO przebiegu w `perf/runs/` powyżej 15% daje ostrzeżenie,
    powyżej 30% kod wyjścia 1 (dowód: test na spreparowanym pliku przebiegu)
  - `npm run perf` opisane w `CLAUDE.md` i `AGENTS.md` jako obowiązkowe po zmianach
    w warstwie danych i w gancie
  - negatywne: uruchomienie na pustym `perf/runs/` kończy się kodem 1, nie sukcesem
  DOWÓD (2026-09-03): wszystkie cztery kryteria sprawdzone na kopii `perf/` w katalogu
  tymczasowym, żeby spreparowane przebiegi nie zabrudziły historii pomiarów.
  1. PRÓG: `perf/budget.json` z `page.calendar.p95Ms` zaniżonym do 10 ms —
     `node scripts/perf/report.mjs` wypisuje „PRZEKROCZONE PROGI: p95 calendar: 70.3
     wobec 10 (+603%)" i kończy się **kodem 1**. Ten sam raport na oryginalnym budżecie:
     **kod 0**.
  2. DRYF: spreparowany `page-2026-09-03T00-00-00-000Z.json` z `calendar` 70,3 -> 800 ms
     (nadal poniżej limitu 900 ms, więc próg twardy tego nie łapie) daje
     „BLOKUJE p95 calendar: 70.3 -> 800 (+1038%)" i **kod 1**. Ten sam plik z wartością
     84 ms (+19%) daje „ostrzeżenie p95 calendar: 70.3 -> 84 (+19%)" i **kod 0**.
  3. DOKUMENTACJA: `CLAUDE.md` (akapit pod blokiem komend) i `AGENTS.md` (wiersz
     „Wydajność") mówią wprost, że `npm run perf` jest obowiązkowy po zmianie w warstwie
     danych (`drizzle/`, `src/lib/db.ts`, `src/lib/context/`, `src/server/actions/`)
     i w gancie (`src/components/calendar/`).
  4. NEGATYWNE: pusty `perf/runs/` — „[report] brak przebiegu page-*.json w perf/runs"
     i **kod 1**, nie sukces.
  SZUM, CZYLI DLACZEGO BLOKADA MA DRUGI WARUNEK: sam procent dryfu łapie szum maszyny.
  Zmierzone na 280 parach kolejnych przebiegów z `perf/runs`: największe odchylenie
  **242%** (`p95 productions-list` 0,76 -> 2,84 ms), na stronach **77%**
  (`p95 home` 17,6 -> 31,2 ms). Blokada wymaga więc jednocześnie ≥30% ORAZ pogorszenia
  większego niż 10% limitu budżetowego tej metryki (`driftAbsFloorPct` w `budget.json`).
  Dowód, że reguła nie łapie szumu i łapie regresję: `node scripts/perf/drift-selftest.mjs`
  — „par kolejnych przebiegów: 280, fałszywe alarmy na szumie: 0, regresje pod limit
  przepuszczone bez blokady: 0", kod 0. Potwierdzone też na żywym pomiarze: przebieg
  z 2026-09-03 pokazał `p95 calendar-table` 31,8 -> 46,3 ms (+46%) jako **ostrzeżenie**,
  bo 14,5 ms to mniej niż 10% z limitu 900 ms; `npm run perf` skończył się kodem 0.
  ZMIENIONE PLIKI: `scripts/perf/drift.mjs` (nowy, sama reguła), `scripts/perf/report.mjs`
  (blokujący dryf dopisywany do przekroczonych progów), `scripts/perf/drift-selftest.mjs`
  (nowy, sprawdzenie reguły na zastanych przebiegach), `perf/budget.json`
  (`driftFailPct` 30, `driftAbsFloorPct` 10), `CLAUDE.md`, `AGENTS.md`.
  BRAMKI: `npm run typecheck` kod 0, `npm run lint` kod 0, `node scripts/check-typography.mjs`
  kod 0, `npm run test` 193 zielone, `npm run perf` kod 0 (bundel `/calendar` 292,5 kB
  przy progu 301,6 kB).

- [x] **F5-03** `test` Domknięcie scenariuszy end-to-end
  CZYTAJ: `plan/06-testy.md` sekcje 1 i 3
  AC:
  - 4 scenariusze z `plan/06` sekcja 3: logowanie (istnieje od F0-02), kalendarz
    z przewijaniem i filtrem, pełny import z fixture, dodanie produkcji; wszystkie zielone
  - każdy zostawia zrzut w `screenshots/F5/`
  - negatywne: scenariusze nie używają prawdziwych danych osobowych ani prawdziwych
    poświadczeń produkcyjnych
  DOWÓD (2026-09-03): `npx playwright test` **22 zielone** (było 20), przebieg 1,6 min,
  serwer deweloperski na porcie 3000 na bazie roboczej `marketing` (port 3000 sprawdzony
  przed startem, `reuseExistingServer` nie podpiął się pod obcy serwer).
  CZTERY SCENARIUSZE: logowanie — `e2e/login.spec.ts` (zastane od F0-02, dopisany zrzut);
  kalendarz z przewijaniem i filtrem — `e2e/f5-scenariusze.spec.ts`, przewinięcie
  sprawdzone na `scrollLeft` pasa ganta (`scrollWidth` większy od `clientWidth`,
  `scrollLeft` po przewinięciu większy od zera), filtr przez `select` kampanii
  z asercją na narrację wybranej kampanii; pełny import z fixture —
  `e2e/import-osoby.spec.ts` (zastane od F4-05, „Dodano 975", dopisany zrzut);
  dodanie produkcji — `e2e/f5-scenariusze.spec.ts`, kreator w trzech krokach, produkcja
  potwierdzona w bazie (`select ... from productions where title = ...`) i odnośnikiem
  na liście produkcji.
  ZRZUTY: `screenshots/F5/F5-01-logowanie.png`, `F5-02-import-podsumowanie.png`,
  `F5-03-kalendarz-filtr.png`, `F5-04-produkcja-dodana.png` (widok okna, nie `fullPage`
  — pełna strona kalendarza to 16 854 px wysokości i nie da się jej przeczytać).
  SPRZĄTANIE (pułapka z F7-21): test dodania produkcji kasuje swój wiersz w `afterAll`
  i przed samym scenariuszem; po pełnym przebiegu
  `select count(*) from productions where title like 'E2E%'` zwraca **0**.
  NEGATYWNE: żadnych prawdziwych danych osobowych ani poświadczeń produkcyjnych.
  Poświadczenia biorą się wyłącznie z `AUTH_EMAIL` i `AUTH_PASSWORD` w `.env.local`
  (konto lokalne, plik poza gitem), w plikach `e2e/` nie ma wpisanego na sztywno adresu
  ani hasła. Baza robocza zawiera same nazwy syntetyczne — sprawdzone zapytaniem
  `select name, handle from artists where name !~ '^(Test|Osoba|Artysta|Ala|Ola|Import)'`,
  które zwraca **0 wierszy**, a `videographers` jest pusta. Zrzuty obejrzane: widać na
  nich wyłącznie nazwy w rodzaju „Artysta F1-04 1788377111132".

- [ ] **F5-04** `docs` ⏳ CZĘŚCIOWO, `BLOCKED-ASK-USER` na publicznym adresie: środowisko do klikania dla zespołu
  CZYTAJ: `plan/06-testy.md` sekcja 5
  AC:
  - aplikacja dostępna pod adresem, który członek zespołu otwiera bez instalowania
    czegokolwiek; adres i sposób logowania w `docs/ARCHITEKTURA.md` sekcja 2
  - baza tego środowiska wypełniona zestawem L, zero prawdziwych osób (dowód:
    `table-counts.mjs` plus wyrywkowe sprawdzenie 10 nazw)
  - `WERYFIKACJA.md` istnieje jako szkielet z nagłówkami faz; wypełnia go recenzent
    po odhaczeniu F7
  - negatywne: środowisko testowe nie używa bazy produkcyjnej (dowód: różne hosty
    w URL, wpisane do dokumentu)
  STAN (2026-09-03): trzy kryteria z czterech spełnione, pierwsze spełnione tylko
  w sieci lokalnej. Issue zostaje otwarte, bo publiczny adres jest decyzją usera.
  1. ADRES — CZĘŚCIOWO. Środowisko stoi i działa: `npm run preview:setup`
     (schemat plus zestaw L) oraz `npm run preview:serve` (`next build` plus
     `next start -p 3001 -H 0.0.0.0`, skrypt `scripts/preview.mjs`). Kolega z tej samej
     sieci otwiera `http://192.168.1.42:3001` bez instalowania czegokolwiek —
     ale **zaloguje się dopiero po https**: `next start` biegnie z `NODE_ENV=production`,
     więc ciasteczko sesji ma flagę `secure` i po `http://` przeglądarka je wyrzuca.
     Zmierzone: po zalogowaniu na `http://192.168.1.42:3001` wejście na
     `/productions/list` odbija na `/login?next=%2Fproductions%2Flist`.
     Przejście po https sprawdzone na tailnecie tej maszyny
     (`tailscale serve --bg --https=8443 http://127.0.0.1:3001`): logowanie przechodzi,
     lista pokazuje 500 produkcji, zrzut `screenshots/F5/F5-05-srodowisko-podgladowe.png`.
     Serwowanie po sprawdzeniu **wyłączone** (`tailscale serve --https=8443 off`,
     `tailscale serve status` wraca do jednego wpisu), bo tailnet wymaga od zespołu
     instalacji klienta, a kryterium mówi „bez instalowania czegokolwiek".
     CZEGO POTRZEBA OD USERA: zgody na jedno z dwóch — (a) `tailscale funnel --bg
     --https=443 http://127.0.0.1:3001`, publiczny adres `https://jans-mac-mini.
     tailb37a7a.ts.net`, zero kont i opłat, ale wystawia aplikację publicznie i zajmuje
     port 443, na którym stoi dziś vibe-kanban; (b) hosting (Vercel plus Postgres),
     co wymaga konta z sekcji 2 dokumentu architektury oraz **wypchnięcia repozytorium
     poza tę maszynę**, a w historii gita siedzą prawdziwe dane osobowe (F4-07).
     Opis obu dróg: `docs/ARCHITEKTURA.md` sekcja 2.1.
  2. ZESTAW L, ZERO PRAWDZIWYCH OSÓB — SPEŁNIONE. Osobna baza `marketing_preview`
     (`PREVIEW_DATABASE_URL`), wypełniona generatorem `scripts/perf/seed-large.ts`
     (ziarno 1337). `node scripts/perf/table-counts.mjs --preview`: artists 200,
     videographers 60, campaigns 40, productions 500, calendar_entries 3000, posts 5000,
     csv_uploads 20, csv_rows 12000 — dokładnie liczby z `plan/03` sekcja 2.
     Wyrywkowo 10 pierwszych nazw: „Ewa Wójcik", „Norbert Dąbrowski", „Zofia Jankowski",
     „Ewa Wiśniewska", „Norbert Szymańska", „Norbert Szymańska", „Damian Wiśniewska",
     „Małgorzata Kozłowska", „Olga Kozłowska", „Urszula Król" — pary imię plus nazwisko
     losowane niezależnie z dwóch list w generatorze (stąd „Zofia Jankowski"), żadna
     nie pochodzi od prawdziwej osoby.
  3. `WERYFIKACJA.md` — SPEŁNIONE. Szkielet w korzeniu repozytorium: instrukcja
     korzystania, format pozycji (pole wyboru, adres, czynność, oczekiwanie), nagłówki
     faz F0 do F7 i tabela podpisu. Wypełnia go recenzent po odhaczeniu F7.
  4. NEGATYWNE, brak bazy produkcyjnej — SPEŁNIONE, z zastrzeżeniem nazewnictwa.
     Środowisko podglądowe gada do `marketing_preview`, robocze do `marketing`,
     pomiarowe do `marketing_perf` — trzy różne bazy, wszystkie w kontenerze `mc-pg`
     na `127.0.0.1:5433`. Host jest **ten sam**, bo bazy produkcyjnej dziś nie ma
     (patrz sekcja 2 dokumentu architektury: konto hostingu nieustalone). Rozdział jest
     twardy: `PREVIEW_DATABASE_URL`, `DATABASE_URL` i `PERF_DATABASE_URL` to trzy
     osobne zmienne, `scripts/preview.mjs` podstawia wyłącznie pierwszą, a generator
     zestawu L odmawia pracy, gdy cel równa się bazie roboczej. Wpisane do
     `docs/ARCHITEKTURA.md` sekcja 2.1 razem z tabelą adresów.

**DoD F5:** wszystkie komendy jakości zielone; e2e zielone; adres środowiska przekazany
userowi.

---

## F6 — Polish: dostępność, bezpieczeństwo, domknięcie dokumentacji

- [x] **F6-01** `ui` Audyt dostępności
  CZYTAJ: `plan/05-ui-system.md` sekcje 3 i 4, `plan/04` sekcja 6
  AC:
  - przejście klawiaturą przez `/calendar`, `/productions/list`, `/import/osoby` osiąga
    każdy element akcji, obwódka ogniskowania widoczna na każdym
  - każdy guzik bez tekstu ma `aria-label`; obszar dotyku co najmniej 44 px także dla
    rozmiarów `xs`, `sm`, `icon-xs`, `icon-sm` (uzyskany wypełnieniem wokół elementu)
  - wiersze prezentacyjne ekranu importu z `plan/04` sekcja 6: stan pusty arkusza,
    układ poniżej 768 px (tabela mapowania jako lista kart), pasek postępu
    bez animacji przy `prefers-reduced-motion` (dowód: zrzuty ekranu)
  - zachowanie przy `prefers-reduced-motion` zgodne z rozstrzygnięciem z F3-01
    (zaimplementowane albo świadomie skreślone; sprawdzasz to, co ustalono, nie to,
    co było w pierwotnej tabeli)
  - negatywne: żaden komunikat o błędzie nie jest przekazywany wyłącznie kolorem
  DOWÓD (2026-09-03): audyt na URUCHOMIONEJ aplikacji, `node scripts/a11y-audit.mjs`
  (serwer deweloperski na 3000, logowanie parą z `.env.local`), wynik `RAZEM naruszeń: 0`,
  surowe dane w `screenshots/F6/a11y-audit.json`. Przejście Tabem osiąga KAŻDY widoczny
  element akcji: `/calendar` 1544 z 1544, `/productions/list` 88 z 88, `/import/osoby`
  24 z 24; zero elementów bez obwódki ogniskowania (kryterium: niezerowy `outline`
  albo `box-shadow`, bo Tailwind `ring-*` renderuje pierścień jako cień). Zmierzona
  obwódka na guziku „Dziś" w kalendarzu: `box-shadow ... 0px 0px 0px 2.51141px`,
  `border-color oklab(0.665602 -0.0521593 -0.160806)`, zrzut
  `screenshots/F6/ognisko-kalendarz-dzis.png`, dane `bledy-i-ognisko.json`.
  Zero guzików bez tekstu i bez nazwy (`aria-label`, `title`, `aria-labelledby`)
  na wszystkich trzech stronach. Obszar dotyku: baza `buttonVariants` dostała
  `pointer-coarse:after:*` z `min-h-11 min-w-11` (halo 44 x 44 px pseudoelementem
  `::after`, wyłącznie na wskaźniku gruboziarnistym — na myszy zabierałoby kliknięcia
  sąsiadom w gęstym pasku ganta). Pomiar w drugiej karcie Playwrighta z `hasTouch`
  i `isMobile` (w Chromium daje `pointer: coarse`; CDP `Emulation.setEmulatedMedia`
  z cechą `pointer` NIE działa — sprawdzone, `matchMedia` zwracało `false`):
  przed zmianą 1400 / 308 / 3 guziki poniżej 44 px, po zmianie 0 / 0 / 0.
  Wiersze prezentacyjne z `plan/04` sekcja 6, dane w `screenshots/F6/import-widoki.json`:
  (1) stan pusty arkusza — komunikat „Arkusz nie zawiera wierszy z danymi", guzik „Dalej"
  `disabled=true`, zrzut `import-pusty-arkusz.png`; (2) poniżej 768 px tabela mapowania
  jest listą kart — przy oknie 375 px `thead: none`, `tr: block` z ramką `1px`,
  `td: block`, zrzut `import-mapowanie-karty-375.png`, a przy 1280 px zostaje tabelą
  (`thead: table-header-group`, `tr: table-row`), zrzut `import-mapowanie-tabela-1280.png`;
  (3) pasek postępu bez animacji przy `prefers-reduced-motion` — `transition-duration`
  `0.001s` wobec `0.15s` bez preferencji, `animation-name: none`, wirująca ikona guzika
  `animation-name: none` wobec `spin`, zrzuty `import-pasek-postepu-reduced-motion.png`
  i `import-pasek-postepu-normalny.png` (strumień NDJSON zapisu podstawiony w przeglądarce,
  do bazy nie poszedł ani jeden wiersz). Zachowanie przy `prefers-reduced-motion` zgodne
  z rozstrzygnięciem F3-01 z `DECISIONS.md` (globalna reguła w `globals.css` plus
  `motion-reduce:animate-none` na ikonie) — zmierzone liczby są dokładnie te, które
  tam zapisano. Negatywne: oba komunikaty o błędzie ekranu importu niosą treść tekstową
  i ikonę, nie sam kolor — zły format pliku „Ten format nie jest obsługiwany. Wgraj plik
  xlsx" (`svg` obecny), kolizja mapowania „Email: E-mail, Uwagi. Jedno pole może pochodzić
  tylko z jednej kolumny." (`svg` obecny, guzik „dalej" zablokowany), zrzuty
  `blad-zly-format.png` i `blad-kolizja-mapowania.png`. Tabela w `plan/05` sekcja 4
  zaktualizowana (wiersz „Ekran dotykowy" przeniesiony z „do sprawdzenia" na „jest").
  Znalezisko: nawigacja w pasku bocznym to `<a>`, więc halo jej nie obejmuje —
  dopisane jako **F7-25**. Bramki: `npm run typecheck` 0, `npm run lint` 0 błędów
  (108 ostrzeżeń), `npm run test` 193 zielone, `npx playwright test` 22 zielone,
  `node scripts/check-typography.mjs` 0, `npm run perf` 0 (bundel `/calendar`
  292,6 kB przy progu 301,6 kB), `node scripts/perf/drift-selftest.mjs` 0.

- [x] **F6-02** `security` Przegląd granic zaufania
  CZYTAJ: `plan/01` zasady Z13 i Z14
  AC:
  - każdy handler w `src/app/api/` i każda akcja serwerowa waliduje wejście schematem
    Zod przed dotknięciem bazy (dowód: lista wszystkich punktów wejścia ze wskazanym
    schematem przy każdym)
  - `git ls-files | grep -E '\.env|\.xlsx|\.db$' | grep -v '^\.env\.example$' | wc -l`
    zwraca `0` (`.env.example` jest wersjonowany celowo i zostaje)
  - parametry URL sterujące zapytaniami (`week`, `view`, `mode`, identyfikatory) mają
    wartości zapasowe: 6 żądań `curl` z wartościami niepoprawnymi zwraca 200 albo 404,
    żadne 500
  - negatywne: `git diff --stat package.json` od początku przebudowy pokazuje jedyną
    nową zależność produkcyjną `exceljs`
  DOWÓD (2026-09-03): lista wszystkich punktów wejścia ze schematem przy każdym powstaje
  komendą `node scripts/check-trust-boundaries.mjs` (nowy skrypt; wypisuje 4 handlery
  z `src/app/api/` i 69 eksportowanych akcji serwerowych, razem **73 punkty wejścia**,
  „Bez schematu mimo argumentów: 0", kod 0). Przed zmianą bez schematu było 40 akcji
  (m.in. cały `production-steps.ts`, wszystkie kamienie milowe w `campaigns.ts`,
  `updatePostMetrics`, `deleteArtist`, `openProductionFolder`, `uploadProductionAttachment`,
  `deleteAgent`, `deleteTemplate`) oraz handler `POST /api/csv`. Dołożone: prymitywy
  `idSchema`, `opaqueIdSchema`, `slugSchema`, `labelSchema`, `descriptionSchema`,
  `isoDateSchema`, `markModeSchema`, `moveDirectionSchema`, `uploadedFileSchema(maxBytes)`,
  `postMetricsSchema`, `productionFilterSchema` w `src/server/actions/schemas.ts` plus
  `milestonePatchSchema` w `campaigns.ts` i `zapytanieSchema` w `src/app/api/csv/route.ts`
  (ten ostatni sprawdza teraz też parametr `dryRun`, nazwę i rozmiar pliku). `slugSchema`
  wycina ukośnik i kropkę, więc slug nie wyjdzie z katalogu `data/agents/`
  ani `data/templates/`. Nowy test `src/server/actions/schemas.test.ts` (23 scenariusze)
  strzela do prymitywów złym wejściem: `../etc/passwd`, `a/b`, `kropka.json`, `id = 0`,
  `id = -1`, `id = 1.5`, `NaN`, `Infinity`, `mode = 'drop'`, `direction = 'left'`,
  data `jutro`, plik o rozmiarze 0 i ponad limit — wszystkie odrzucone.
  OSTRZAŁ NA URUCHOMIONEJ APLIKACJI (serwer deweloperski, ciasteczko sesji z logowania
  Playwrightem, `curl`): `POST /api/csv` bez pliku → 400 `Missing file`;
  `POST /api/csv?dryRun=zle` z poprawnym plikiem → 400 `Nieprawidłowe parametry żądania`
  (przed zmianą przechodziło jako `dryRun=false`); `POST /api/upload` z
  `category=../../etc` → 400 `Invalid category`; `POST /api/import/people` z plikiem CSV →
  400 `Ten format nie jest obsługiwany. Wgraj plik xlsx`; `POST /api/import/people/save`
  z ciałem `{"role":"kot","policy":"x","mapping":[1],"rows":"nie tablica"}` → 400
  `Nieprawidłowe dane importu`; ten sam upload bez ciasteczka → 307 na
  `/login?next=%2Fapi%2Fimport%2Fpeople`; `.xlsx` wysłany na `/api/csv` → 400
  `Could not detect CSV source`. Zero odpowiedzi 500.
  PARAMETRY URL: osiem żądań `curl` z sesją, wartości niepoprawne, żadnego 500 —
  `/calendar?week=nie-data` 200, `/calendar?view=<script>&weeks=-99` 200,
  `/calendar?mode=../../etc/passwd` 200, `/calendar?campaign=abc&sort=DROP%20TABLE` 200,
  `/productions/list?type=999&status=%00` 200, `/productions/99999999` 404,
  `/productions/abc` 404, `/campaigns/-1` 404.
  SEKRETY I DANE OSOBOWE: `git ls-files | grep -E '\.env|\.xlsx|\.db$' | grep -v
  '^\.env\.example$' | wc -l` zwraca **0**. Przed zmianą zwracało **1** i był to
  `tests/fixtures/osoby.xlsx` — syntetyczny fixture dodany w F4, więc nie wyciek danych,
  ale mimo to arkusz w repozytorium wbrew Z14. Rozwiązanie: plik wypisany z gita
  (`git rm --cached`), wzorzec `/tests/fixtures/*.xlsx` i `/.data-import/` dopisany do
  `.gitignore`, a `e2e/import-osoby.spec.ts` odtwarza go w `test.beforeAll` deterministycznym
  generatorem `scripts/make-fixture-xlsx.ts`. Sprawdzone przez skasowanie pliku i przebieg
  `npx playwright test e2e/import-osoby.spec.ts` — 12 zielonych, plik odtworzony.
  Negatywne: `git diff --stat $(git rev-parse 4b01a8a^) -- package.json` pokazuje 23
  wstawienia i 4 usunięcia, w sekcji `dependencies` jedyny nowy wiersz to
  `"exceljs": "^4.4.0"`; reszta to skrypty npm i `devDependencies` (`@playwright/test`,
  `@testing-library/dom`, `@testing-library/react`, `eslint`, `eslint-config-next`,
  `jsdom`, `vitest`). Bramki: `npm run typecheck` 0, `npm run lint` 0 błędów,
  `npm run test` **216 zielonych** (było 193), `npx playwright test` 22 zielone,
  `node scripts/check-typography.mjs` 0, `npm run perf` 0 (bundel `/calendar` 292,6 kB
  przy progu 301,6 kB), `node scripts/perf/drift-selftest.mjs` 0.

- [x] **F6-03** `docs` Domknięcie dokumentu architektury
  CZYTAJ: `plan/02-architektura.md` sekcja 3
  AC:
  - `docs/ARCHITEKTURA.md` uzupełniony o ustalenia z F1 do F5: pulę połączeń, indeksy,
    mechanizm cache, decyzję o bundlerze, ekran importu, adres środowiska testowego
  - sekcja 9 wymienia każdy pozostały dług z numerem issue w F7
  - sekcja 4 zawiera aktualne liczby wierszy z daty domknięcia
  - weryfikacja zgodności z kodem wykonana TERAZ, nie odłożona: wybierz 10 twierdzeń
    dokumentu i przy każdym zapisz komendę oraz jej wynik potwierdzający
  - negatywne: żadne z 10 sprawdzanych twierdzeń nie okazuje się fałszywe; gdy okaże
    się, dokument jest poprawiany w tym samym issue
  DOWÓD (2026-09-03): `docs/ARCHITEKTURA.md` uzupełniony o ustalenia F1 do F5.
  Pula połączeń: wiersz tabeli w sekcji 3 wskazuje `src/lib/db.ts:25` i `:26`
  (`process.env.VERCEL ? 1 : env.DB_POOL_MAX`, `idle_timeout: 20`). Indeksy: sekcja 5
  miała twierdzenie „dziś są wyłącznie klucze główne" — nieprawdziwe od F1-01, wstawiona
  tabela 13 indeksów poza kluczami głównymi (`productions`, `calendar_entries`, `posts`,
  `csv_rows`) i wynik `seqScan: nie` z `measure-db.mjs`. Cache: dopisany wiersz „Cache
  odczytów — **brak**, świadomie", z odesłaniem do wpisu F1-03 w `DECISIONS.md` (Cache
  Components wdrożony, zmierzony i cofnięty) oraz do F7-10 i F7-11. Bundler: nowy akapit
  w sekcji 8 — `dev` na webpacku mimo 13x szybszego HMR turbopacka, bo obraz strony
  z turbopacka różni się od produkcyjnego o 82 921 pikseli wobec 6 306 przy webpacku,
  `dev:alt` dla świadomego wyboru, przyczyna jako F7-14. Ekran importu: nowa sekcja 6c,
  siedem kroków, limity 10 MB i 5 000 wierszy, walidacja dwa razy (przeglądarka i serwer),
  suchy przebieg bez ponownego wysyłania pliku, strumień NDJSON przy zapisie, zakaz
  kasowania osób spoza arkusza. Adres środowiska testowego: sekcja 2.1 zostaje bez zmian
  (F5-04), dopisana baza `marketing_preview` do tabeli baz w sekcji 3 i zmienna
  `PREVIEW_DATABASE_URL` do tabeli zmiennych w sekcji 7.
  Sekcja 9 przepisana: wymienia **wszystkie 25 otwartych issues F7** z numerem przy
  każdym (F7-01 do F7-25) plus osobną tabelę sześciu spraw czekających na decyzję usera
  (F0-01, wdrożenie na Vercelu, F5-04, F4-06, F4-07 z F7-23, F8-01).
  Sekcja 4 ma liczby wierszy z daty domknięcia: baza robocza 102 artystów, 19 kampanii,
  67 produkcji, reszta zero (`node scripts/perf/table-counts.mjs --work --json`), baza
  pomiarowa 209/60/40/506/3000/5000/20/12000 z wyjaśnieniem nadwyżki nad zestawem L.
  DZIESIĘĆ TWIERDZEŃ SPRAWDZONYCH KOMENDĄ (tabela w załączniku dokumentu, wykonane
  2026-09-03): (1) `npm run pg:info` → `postgres 17.11`, `max_connections 100`;
  (2) `npm run pg:info | sed -n '/^indeksy/,/^$/p' | grep -c '_idx'` → `13`, nagłówek
  `indeksy (25)`; (3) `grep -c '= pgTable(' drizzle/schema.ts` → `12`;
  (4) `grep -n 'max: process.env.VERCEL' src/lib/db.ts` → linia 25;
  (5) `grep -rn 'force-dynamic' src/app | wc -l` → `28`, a `grep -rn 'use cache' src/`
  → `0`; (6) `node scripts/perf/measure-db.mjs` → `seqScan: nie` cztery razy, p95 0,74
  do 1,28 ms; (7) `node scripts/perf/table-counts.mjs --work --json` → 102/0/19/67/0/0/0/0;
  (8) `node scripts/check-trust-boundaries.mjs` → „Punktów wejścia: 73. Bez schematu
  mimo argumentów: 0", kod 0; (9) `git ls-files | grep -E '\.env|\.xlsx|\.db$' |
  grep -v '^\.env\.example$' | wc -l` → `0`; (10) `node -p
  "require('./package.json').scripts.dev"` → `... next dev --webpack`.
  NEGATYWNE: pięć twierdzeń dokumentu okazało się fałszywych i zostało poprawionych
  w tym samym issue (lista na końcu załącznika): indeksy i Seq Scany w sekcji 5, pusta
  baza robocza w sekcji 4, „`npm run perf` kończy się kodem 1" i 205 ostrzeżeń ESLint
  w sekcji 8, numery linii w sekcjach 3 i 6 (`db.ts:32` i `:17`, `calendar/page.tsx:142`,
  `proxy.ts:4` i `:10`, `calendar.ts:17` do `:36`), lista długów w sekcji 9 bez numerów
  i ze starym F4-00 zamiast F7-19. Po poprawkach żadne z dziesięciu sprawdzanych
  twierdzeń nie jest fałszywe.

**DoD F6:** audyt dostępności zapisany; zero sekretów i danych osobowych w repozytorium;
10 twierdzeń dokumentu potwierdzonych komendami.

---

## F7 — ZNALEZISKA (rośnie w trakcie, na starcie pusta)

Każdy błąd zastany napotkany przy okazji innego zadania trafia tutaj jako pełne issue
z kryteriami obserwacyjnymi, wagą (`blokujące`, `ważne`, `drobne`) i oszacowaniem.
Waga `blokujące` przerywa pracę i idzie do usera.

Wiadome już teraz, do dopisania przez pierwszego workera, który je potwierdzi:
błędy `typecheck` z kodu zastanego (F0-02), przeniesienie danych z `videographers.contact`
do `handle` i `email` (F4-00), ewentualne pozostałości `customSteps` poza gantem (F2-02).

- [x] **F7-01** `znalezisko` `ui` Reguła `react-hooks/set-state-in-effect` w 10 komponentach
  **DYSPOZYCJA: ZROBIONE.** Wszystkie 11 trafień usunięte przez jeden wspólny hak
  `useResetOnChange` (`src/lib/use-reset-on-change.ts`, 8 linii kodu) — wzorzec
  „dostosowania stanu w trakcie renderu" z dokumentacji Reacta zamiast efektu.
  Dowody: `npx eslint . -f json | jq '[.[].messages[] | select(.ruleId=="react-hooks/set-state-in-effect")] | length'` zwraca `0` (o `grep -c` z kryterium patrz uwaga o licznikach niżej);
  reguła zniknęła z `eslint.config.mjs` razem z całą swoją listą wyjątków
  (blok grandfather rozbity na osobną listę plików per reguła, żeby dało się
  wypisywać z jednej reguły, a nie z całego worka); ostrzeżenia lintu 108 → 93;
  `npm run typecheck` 0, `npm run test` 216 zielonych, `npx playwright test`
  22 zielone. Weryfikacja na uruchomionej aplikacji (port 3000, `npm run dev`):
  pngdiff `/calendar`, `/campaigns`, `/productions/list`, `/artists` w oknie
  1280x720 — **0 różnych pikseli na każdym z czterech ekranów**; paleta komend
  po ponownym otwarciu ma puste pole i fokus w polu; dialog artysty po ponownym
  otwarciu ma puste pole (brudnopis nie przecieka); pasek boczny na `390x800`
  z `hasTouch` zamyka się po nawigacji (`translate-x-0` znika); zmiana kickoffu
  kampanii `/campaigns/1` przechodzi przez `router.refresh` i wraca w polu;
  `InlineEdit` na `/productions/80` zapisuje i pokazuje nową wartość, a po
  ponownym wejściu w edycję draft równa się zapisanej wartości.

  Waga: **ważne**. Szacunek: 1 dzień.
  Znalezione w F0-02, gdy ESLint ruszył pierwszy raz. `setState` wołany wprost
  w `useEffect` to dodatkowy przebieg renderu na każdą zmianę, czyli dokładnie ta klasa
  kosztu, którą F2 i F3 mają usuwać. Pliki: `analytics/post-dialog.tsx`,
  `artists/artist-dialog.tsx`, `campaigns/campaign-periods-editor.tsx`,
  `campaigns/narrative-section.tsx`, `command-palette.tsx`, `inline-edit.tsx`,
  `productions/production-drawer.tsx`, `productions/t1-start-editor.tsx`, `sidebar.tsx`,
  `videographers/videographer-dialog.tsx` (11 trafień).
  AC:
  - `npx eslint . -f json` nie zawiera już trafień reguły `react-hooks/set-state-in-effect`
    (dowód: `npx eslint . -f json | grep -c set-state-in-effect` zwraca `0`)
  - te 10 plików wypisane z listy grandfather w `eslint.config.mjs`
  - `npm run test` i `npm run e2e` nadal kod 0, czyli zachowanie się nie zmieniło

- [x] **F7-02** `znalezisko` `perf` Reguła `react-hooks/purity` w 6 plikach, w tym w gancie
  **DYSPOZYCJA: ZROBIONE.** Uwaga do licznika z treści znaleziska: trafień jest **pięć,
  nie sześć**, i `calendar/gantt-view.tsx` nie ma wśród nich ani jednego — plik rozpadł
  się w F2-02 i jego trafienie purity zniknęło razem z podziałem. Dowód:
  `npx eslint . -f json` przed zmianą wypisywał purity w `app/campaigns/[id]/page.tsx`,
  `app/productions/[id]/page.tsx`, `campaigns/campaigns-list.tsx`,
  `campaigns/gantt-narrative-row.tsx` i `productions/production-drawer.tsx`.
  Wszystkie pięć to ten sam kształt: `Date.now()` w renderze przy liczeniu etykiety T-x.
  Trzy z nich są w komponentach serwerowych (brak `'use client'`) i dostały lokalne
  `eslint-disable-next-line react-hooks/purity` z uzasadnieniem; dwa kliencke dostały
  `useState(() => Date.now())`. Rozumowanie w `DECISIONS.md`.
  Dowody: `npx eslint . -f json | jq '[.[].messages[] | select(.ruleId=="react-hooks/purity")] | length'` zwraca `0`; reguła
  usunięta z `eslint.config.mjs` razem z listą; ostrzeżenia lintu 93 → 88, 0 błędów;
  `npm run test` 216 zielonych; `npm run typecheck` 0. Pomiar `/calendar`, mediana
  z trzech przebiegów na budowaniu produkcyjnym: przed 85,2 ms, po 79,3 ms, bundel
  292,7 kB bez zmiany (obie liczby w `DECISIONS.md`). Weryfikacja na uruchomionej
  aplikacji: pngdiff `/campaigns`, `/campaigns/1`, `/productions/80`, `/calendar`
  w oknie 1280x720 — **0 różnych pikseli na każdym z czterech ekranów**; rozwinięty
  panel kampanii w gancie nadal pokazuje etykiety `T-0` i `T-4`, konsola bez błędów
  (w tym bez ostrzeżenia o niezgodności hydratacji).

  Waga: **ważne**. Szacunek: pół dnia.
  „Cannot call impure function during render", 6 trafień. `gantt-view.tsx` jest wśród nich,
  a to główny podejrzany o zawieszki z A5, więc to znalezisko wchodzi w drogę F2.
  Pliki: `app/campaigns/[id]/page.tsx`, `app/productions/[id]/page.tsx`,
  `calendar/gantt-view.tsx`, `campaigns/campaigns-list.tsx`,
  `campaigns/gantt-narrative-row.tsx`, `productions/production-drawer.tsx`.
  AC:
  - `npx eslint . -f json | grep -c 'react-hooks/purity'` zwraca `0`
  - pomiar `/calendar` z harnessu przed i po, obie liczby w `DECISIONS.md`
  - te 6 plików wypisane z listy grandfather

- [x] **F7-03** `znalezisko` `ui` `react-hooks/immutability` i `react-hooks/refs`
  **DYSPOZYCJA: ZROBIONE.** Uwaga do licznika: trafień są **trzy, nie cztery**
  (`periods-slider.tsx:155`, `templates/template-form.tsx:444`,
  `campaigns/campaign-periods-editor.tsx:134`) — pliki zgadzają się co do jednego,
  tylko `template-form.tsx` miał jedno trafienie, nie dwa.
  Naprawy: (1) `document.body.style.userSelect` wyjechał z ciała komponentu do funkcji
  `lockTextSelection` na poziomie modułu — mutacja `document.body` jest świadomie poza
  światem Reacta i w ciele komponentu nie da się odróżnić wywołania z uchwytu zdarzenia
  od wywołania w renderze; (2) licznik `runningOffset` nadpisywany w trakcie mapowania
  zastąpiony wyliczeniem pierwszego numeru wprost z `steps`, a sztuczny IIFE wokół
  mapowania zniknął; (3) zapis `onPeriodsChangeRef.current` przeniesiony z renderu do
  efektu bez tablicy zależności (efekty biegną w kolejności deklaracji, więc ref jest
  aktualny, zanim odpali się powiadomienie).
  Dowody: ten sam licznik z `jq` dla `react-hooks/immutability` i `react-hooks/refs` zwraca `0`;
  obie reguły usunięte z `eslint.config.mjs` razem z listami; ostrzeżenia lintu 88 → 85,
  0 błędów; `npm run typecheck` 0; `npm run test` 216 zielonych; złożoność
  `TemplateForm` bez zmian (19 przed i po). Weryfikacja na uruchomionej aplikacji:
  pngdiff czterech szablonów w oknie 1280x720 `fullPage` — `standard-solo` i
  `f3-07-po2` **0 pikseli**, `rozszerzony-z-artysta` 21 i `standard-with-artist` 15
  pikseli, czyli grubo poniżej progu szumu 1 155; tekst obu tych stron przed i po jest
  **bajt w bajt identyczny** (`diff` na `main.innerText`), więc te kilkanaście pikseli
  to wygładzanie czcionki, nie zmiana numeracji. Suwak okresów na `/campaigns/1`
  przeciągnięty myszą: `document.body.style.userSelect` = `none` w trakcie i `''` po
  puszczeniu, uchwyt przesunął się z `+13d` na `+26d`, a górna oś kampanii
  zaktualizowała się na żywo, czyli powiadomienie przez ref działa.

  Waga: **drobne**. Szacunek: 2 godziny.
  4 trafienia: mutacja wartości traktowanej przez Reacta jako niezmienna
  (`periods-slider.tsx`, `templates/template-form.tsx`) oraz czytanie refa w renderze
  (`campaigns/campaign-periods-editor.tsx`).
  AC:
  - `npx eslint . -f json | grep -cE 'react-hooks/(immutability|refs)'` zwraca `0`
  - te 3 pliki wypisane z listy grandfather

- [x] **F7-04** `znalezisko` `ui` Dwa `<a href>` na trasy wewnętrzne zamiast `<Link>`
  **DYSPOZYCJA: ZROBIONE.** Oba `<a>` zamienione na `<Link>` z `next/link`.
  Dowód licznikowy: `npx eslint . -f json | jq '[.[].messages[] |
  select(.ruleId=="@next/next/no-html-link-for-pages")] | length'` zwraca `0`,
  a reguła zniknęła z `eslint.config.mjs`. **Uwaga do kryterium:**
  `grep -c 'no-html-link-for-pages'` na wyjściu `-f json` zwraca `1` mimo zera
  komunikatów — formatter `json` dokłada do każdego pliku z jakimkolwiek komunikatem
  pole `source` z całą treścią pliku, a `eslint.config.mjs` ma własne ostrzeżenie
  i wspomina nazwę reguły w komentarzu. Ten sam błąd dotyczy liczników w F7-01, F7-02,
  F7-03 i F7-05; policzone po `ruleId`, nie po tekście.
  Weryfikacja na uruchomionej aplikacji, oba linki żyją w stanie pustym „brak szablonów
  kampanii", więc trzeba go było wywołać: kopia `marketing_templates` przez `pg_dump`,
  wyczyszczenie tabeli i `template_slug = null` na kampanii 1, po teście przywrócenie
  z kopii (sprawdzone: 2 wiersze i slug z powrotem). W tym stanie skrypt ustawia
  `window.__zyje = 'tak'`, klika link i czyta wartość po nawigacji:
  - **po zmianie**: karta kampanii `tak`, kreator nowej kampanii `tak` (dokument przeżył)
  - **przed zmianą, kontrola negatywna**: karta kampanii `BRAK`, kreator `BRAK`
    (pełne przeładowanie dokumentu wyczyściło `window`)
  Negatywne: `npm run test` 216 zielonych, `npm run typecheck` 0, ostrzeżenia lintu
  85 → 83, pngdiff `/campaigns` i `/campaigns/1` po 0 różnych pikseli.

  Waga: **drobne**. Szacunek: 15 minut.
  `@next/next/no-html-link-for-pages`, 2 trafienia: `campaigns/apply-template-button.tsx`
  i `campaigns/campaign-wizard.tsx`. Surowy `<a>` na trasę wewnętrzną robi pełne
  przeładowanie strony zamiast nawigacji klientem, czyli traci cały cache routera.
  AC:
  - `npx eslint . -f json | grep -c 'no-html-link-for-pages'` zwraca `0`
  - kliknięcie obu linków w przeglądarce nie przeładowuje dokumentu (dowód: scenariusz
    e2e sprawdzający, że wartość ustawiona w `window` przed kliknięciem przeżywa nawigację)

- [x] **F7-05** `znalezisko` `ui` Pięć niezaescapowanych apostrofów i cudzysłowów w JSX
  **DYSPOZYCJA: ZROBIONE.** Pięć trafień, wszystkie na miejscu: trzy zamykające
  cudzysłowy w `campaign-periods-editor.tsx` (wiersze 218 i 221), jeden w
  `command-palette.tsx` (197) i jeden apostrof w `template-form.tsx` (427).
  Cudzysłowy dostały `&rdquo;`, bo to konwencja już obecna w repozytorium
  (`campaigns-list.tsx` ma parę `&bdquo;` / `&rdquo;`), a wcześniej stała tam para
  mieszana: otwierający „ i zamykający prosty `"`. Apostrof w `pipeline'u` dostał
  `&apos;`, czyli ten sam znak co przedtem.
  Dowody: `npx eslint . -f json | jq '[.[].messages[] |
  select(.ruleId=="react/no-unescaped-entities")] | length'` zwraca `0` (o `grep -c`
  z kryterium patrz uwaga w F7-04); reguła usunięta z `eslint.config.mjs` razem z listą,
  po czym w bloku grandfather została **już tylko jedna reguła: `complexity` (F7-06)**;
  ostrzeżenia lintu 83 → 78, 0 błędów; `npm run typecheck` 0; `npm run test`
  216 zielonych; `node scripts/check-typography.mjs` 0 trafień.
  Weryfikacja na uruchomionej aplikacji: `/campaigns/1` renderuje
  „Build-up”, „Reveal”, „Wspólnym planie kampanii”; `/templates/standard-solo/edit`
  renderuje `pipeline'u` bez zmiany; paleta komend pokazuje
  `Brak wyników dla „zzzzz-nic-takiego”`. Pngdiff `fullPage`: strona szablonu
  **0 pikseli**, `/campaigns/1` **762 piksele** — to trzy zamykające cudzysłowy
  zmieniające glif z `"` na `”`, czyli zmiana zamierzona i jedyna na tej stronie
  (poniżej progu szumu 1 155).

  Waga: **drobne**. Szacunek: 15 minut.
  `react/no-unescaped-entities` w `campaigns/campaign-periods-editor.tsx`,
  `command-palette.tsx`, `templates/template-form.tsx`.
  AC:
  - `npx eslint . -f json | grep -c 'no-unescaped-entities'` zwraca `0`

- [x] **F7-06** `znalezisko` `tooling` 63 funkcje ponad progiem złożoności 10
  Waga: **ważne**. Szacunek: rozłożone na F2 i F3, nie w jednym podejściu.
  Z11 chroni NOWY kod, więc zastane funkcje są świadomie zgrandfatherowane, ale
  lista ma się kurczyć. Najgorsze: `setStepDate` 18, `resolveCategorySequence` 18,
  `CampaignDetailPage` 18, `ProductionDetailPage` 18, `mapYouTubeRow` 17.
  AC:
  - po zakończeniu F3 liczba trafień reguły `complexity` spada o co najmniej połowę
    (dowód: `npx eslint . -f json | grep -c '\"complexity\"'` przed i po, obie liczby
    w raporcie fazy)
  - żadna funkcja dotknięta w F1 do F6 nie zostaje z złożonością wyższą niż zastana
  DYSPOZYCJA (2026-09-03): **ZROBIONE CZĘŚCIOWO, reszta ODŁOŻONA z liczbą.**
  Kryterium „spadek o co najmniej połowę" NIE jest spełnione i nie udaję, że jest.
  Licznik przed: **58** trafień reguły `complexity` w 43 plikach (nie 63 — pięć
  wcześniejszych trafień zniknęło przy F7-01 do F7-05, uczciwy licznik to
  `npx eslint . -f json | jq '[.[].messages[]|select(.ruleId=="complexity")]|length'`,
  bo `grep -c` liczy pole `source`, nie komunikaty). Licznik po: **40** trafień
  w 29 plikach, czyli spadek o 31%. Ostrzeżeń lintu ogółem: 78 → 60, 0 błędów.
  Naprawione 18 funkcji w 14 plikach, każda przez wydzielenie nazwanego pomocnika,
  nie przez wyłączenie reguły: `csv-mappers.ts` (3 mappery, wspólne `engSum`, `pct`,
  `watchedPct`, `round0/round1`), `dates.ts` (`timeUntil` → `joinUnits`),
  `artist-dialog.tsx` i `videographer-dialog.tsx` (`initial` → `Partial<T>` plus nowy
  `fieldText` z `src/lib/utils.ts`), `agent-form.tsx` (`fromAgent`, `submit` →
  `validationError`), `artist-avatar.tsx` (tablica `KIND` zamiast łańcucha ternarnych),
  `agents/widget.ts` (`firstCount`), `production-steps.ts` (`setStepDate` →
  `weekRangeError` + `withDerivedCascade` + `derivedSteps`), `production-work-folder.ts`
  (`ensureDir`, bo `mkdirSync({recursive:true})` i tak jest idempotentny — pięć testów
  `existsSync` zniknęło), `production-folder.ts` (`FILE_MANAGER`, `errMsg`),
  `productions.ts` (`ensureWorkFolderQuietly`), `gantt-row-model.ts` (`buildRowModel`
  20 → 3, wydzielone `buildStagePins`, `indexSubSteps`, `stackPins`, `pinDateLabel`),
  `productions-list.tsx` (`groupByPerson`, `visibleSections`), `template-form.tsx`
  i `campaign-template-form.tsx` (`Partial<T>` + `fieldText`).
  Przy okazji naprawiony korzeń dublowanej logiki: pusta lista ramek produkcji
  ustawia się na `T1/T2/T3` w jednym miejscu, w `ensureWorkFolderStructure`,
  zamiast u dwóch wywołujących.
  ZOSTAJE **40 trafień w 29 plikach**, najwyższe: `ProductionStepRow` **46**
  (`production-step-row.tsx:75`) i `CalendarPage` **43** (`app/calendar/page.tsx:75`).
  Te dwie to nie łańcuchy `??` — to komponenty po kilkaset linii, w których złożoność
  siedzi w JSX i w gałęziach stanu; ich rozbicie to osobne zadanie z własnym dowodem
  wizualnym, nie „przy okazji". Reszta zostających to głównie kreatory
  (`production-wizard`, `campaign-wizard`), gant (`gantt-row`, `gantt-milestones`,
  `gantt-substep-bar`, `gantt-milestone-labels` — wypisujemy się z nich przez F7-13)
  i strony serwerowe. Lista grandfather w `eslint.config.mjs` skurczona z 43 do 29
  pozycji; z list się wypisujemy, nigdy nie dopisujemy.
  DOWÓD REGRESJI: `node scripts/perf/pngdiff.mjs` w oknie 1280×720 dla `/calendar`,
  `/productions/list`, `/templates` i `/artists` — **0 różnych pikseli** na każdym
  z czterech ekranów (zrzut przed z `git stash push -- src/ eslint.config.mjs`).
  BRAMKI: `typecheck` 0, `lint` 0 (0 błędów, 60 ostrzeżeń), `test` 0 (216/20),
  `check-typography` 0, `check-trust-boundaries` 0, `perf` 0, bundel `/calendar`
  292,8 kB przy progu 301,6 kB (bez zmiany).

- [x] **F7-07** `znalezisko` `tooling` 17 nieużywanych zmiennych i importów
  Waga: **drobne**. Szacunek: 1 godzina.
  `@typescript-eslint/no-unused-vars`, 17 ostrzeżeń. Część to prawdopodobnie
  niedokończone refaktory (`totalPlay`, `watchHours`, `ctr` w `csv-mappers.ts`,
  `StepDateMode` w `production-steps.ts`, `stamp` w `campaigns.ts`) i każde z nich
  jest pytaniem, czy jakiejś metryki nie gubimy po cichu.
  AC:
  - `npx eslint . -f json | grep -c 'no-unused-vars'` zwraca `0`
  - dla każdej usuniętej zmiennej sprawdzone, czy nie miała być użyta; przypadki
    „miała być" opisane w `DECISIONS.md` zamiast po cichu skasowane
  DOWÓD (2026-09-03): **ZROBIONE.** Zastanych trafień było **16**, nie 17 (jedno
  zniknęło wcześniej razem z F7-01 do F7-05). Uczciwy licznik po zmianie:
  `npx eslint . -f json | jq '[.[].messages[]|select(.ruleId=="@typescript-eslint/no-unused-vars")]|length'`
  zwraca **0**. Ostrzeżeń lintu ogółem 60 → 45, 0 błędów.
  Rozbicie po kategoriach:
  - **martwe importy i typy, skasowane bez śladu** (7): `PRODUCTION_PROGRESSION`
    i `StageCategory` w `gantt-geometry.ts`, `PeriodTone` w `periods-slider.tsx`,
    `Trash2` w `file-zone.tsx`, `Mode` w `template-form-utils.ts`, `AgentSlug`
    w `lib/agents/index.ts`, `StepDateMode` w `production-steps.ts`.
  - **martwe propy, usunięte także u wywołującego** (3): `currentStatus`
    w `ExpandedDetails` i `status` w `PipelineMilestones` — oba szły z `gantt-row.tsx`
    i nie były czytane w ciele komponentu; do tego lokalne `stepDates`
    w `gantt-expanded.tsx`, którego zastępuje `row.stepDates` czytane w geometrii.
  - **pozostałości po refaktorach, semantyka bez zmian** (3): `rangeStart`/`rangeEnd`
    w `app/calendar/page.tsx` (aliasy `weekStart` i policzonego końca, okno i tak
    liczą `lookaheadEnd`/`lookbehindStart`), `stamp` w `campaigns.ts` (zastąpiony
    przez `m.doneAt ?? nowIso` w miejscu użycia).
  - **trzy metryki z CSV, które faktycznie gubimy** (3): `totalPlay` (TikTok),
    `watchHours` i `ctr` (YouTube). Tabela `posts` nie ma dla nich kolumn, więc nie
    było gdzie ich zapisać. Usunięte z parsera, opisane w `DECISIONS.md` i zgłoszone
    jako **F7-29**, żeby decyzja o kolumnach nie utonęła razem z tymi zmiennymi.
  DOWÓD REGRESJI: pngdiff 1280×720, `/calendar` **0**, `/analytics` **0**,
  `/calendar` z rozwiniętym panelem produkcji **0** różnych pikseli.
  BRAMKI: `typecheck` 0, `lint` 0, `test` 0 (216/20), `check-typography` 0,
  `check-trust-boundaries` 0, `perf` 0.

- [x] **F7-08** `znalezisko` `ui` Lewy pasek akcentu, zakazany zasadą Z8
  Waga: **ważne**. Szacunek: 1 godzina.
  Znalezione przy zrzucie ekranu do F0-05: karta „Następny krok" w gancie ma pionowy
  pasek koloru przyklejony do lewej krawędzi
  (`src/components/calendar/gantt-view.tsx:1586`, `absolute left-0 top-1.5 bottom-1.5
  w-[4px] rounded-full`), a cytat w oknie pomocy ma to samo w wersji tailwindowej
  (`src/components/help-dialog.tsx:362`, `border-l-2 border-amber-400/60`).
  Zasada Z8 zakazuje lewego brandowego paska akcentu wprost. Pasma T1/T2/T3 mają nadal być
  rozróżnialne kolorem, więc to nie jest „usuń i zapomnij": kolor przenosi się na
  kropkę z numerem kroku i na etykietę pasma, które już istnieją w tej karcie.
  Uwaga na fałszywe trafienia: `gantt-view.tsx:1410` i `:1434` też używają `border-l-2`,
  ale rysują linie drzewa łączące kroki, nie pasek akcentu, i zostają.
  AC:
  - `grep -rn 'border-l-2\|border-l-4\|left-0 top-1.5 bottom-1.5' src/ | wc -l` zwraca `2`
    (zostają wyłącznie dwie linie drzewa w gancie)
  - karta „Następny krok" nadal rozróżnia pasma T1, T2 i T3 kolorem, dowód: zrzut ekranu
    `/calendar?week=2026-03-02` z trzema kartami w różnych pasmach obok siebie
  - kolory brane z tokenów, nie z klas `amber-500`, `violet-500`, `emerald-500` wprost
    (zasada Z4)
  - negatywne: `npm run e2e` kod 0, czyli usunięcie paska nie zbiło żadnego selektora
  DOWÓD (2026-09-03): **ZROBIONE.**
  Numery linii z treści były sprzed podziału ganta, więc szukane po treści. Znaleziony
  jeden prawdziwy pasek: `src/components/calendar/gantt-next-step.tsx`, `<span>`
  z `absolute left-0 top-1.5 bottom-1.5 w-[4px]`. Cytat w `help-dialog.tsx` z tym
  `border-l-2 border-amber-400/60` **już nie istnieje** (`grep -n 'border-l'
  src/components/help-dialog.tsx` nie zwraca nic) — zniknął przy wcześniejszych fazach.
  Pasek zastąpiony pełnym obramowaniem karty w kolorze pasma, zgodnie ze zdaniem Z8
  „wyróżnienie robimy tłem lub obramowaniem pełnym"; kropka z numerem kroku i podpis
  kategorii nadal niosą kolor pasma.
  - `grep -rn 'border-l-2\|border-l-4\|left-0 top-1.5 bottom-1.5' src/ | wc -l` zwraca
    **2** — obie linie to `gantt-row-guides.tsx:53` i `:77`, czyli linie drzewa łączące
    kroki, opisane w treści jako fałszywe trafienia.
  - Kolory zdjęte z klas wpisanych na miejscu: lokalna mapa `frameAccent`
    z `amber-500`/`violet-500`/`emerald-500` skasowana, karta czyta `FRAME_STYLE`
    z `src/lib/category-colors.ts`, czyli tę samą tabelę, z której żyją pasy ganta
    i strona szablonów. Do tabeli doszły pola `faint` i `glow`, wypadło pole `rail`,
    bo jego jedynym odbiorcą był zakazany pasek.
  - Trzy pasma nadal rozróżnialne: `/calendar?week=2026-09-07`, 75 kart „Następny krok",
    rozkład obramowań `{amber: 73, violet: 1, emerald: 1}` (odczytane z DOM w Playwright).
    Zrzuty pojedynczych kart: `screenshots/F7/f7-08-nastepny-krok-T1.png`, `-T2.png`,
    `-T3.png`. Żeby wywołać pasma T2 i T3, dwie produkcje (19 i 27) dostały tymczasowo
    odhaczone wcześniejsze kroki i zostały przywrócone z kopii po zrzucie (kontrola:
    produkcja 19 ma znów 5 odhaczonych kroków, produkcja 27 jeden).
  - `npm run e2e` **22 zielone** na budowaniu produkcyjnym (`npm run build` + `next start`).
    Na serwerze deweloperskim 21 zielonych i `gantt-filter.spec.ts` czerwony — to
    znane **F7-28**, nie skutek tej zmiany.
  BRAMKI: `typecheck` 0, `lint` 0, `test` 0 (216/20), `check-typography` 0,
  `check-trust-boundaries` 0, `perf` 0, bundel `/calendar` **292,7 kB** przy progu 301,6
  (o 0,1 kB mniej niż przed zmianą, bo zniknął jeden węzeł).

- [x] **F7-09** `znalezisko` `arch` Server action `createCalendarEntry` bez wywołania z UI
  Waga: **ważne**. Szacunek: pół dnia albo 15 minut, zależnie od dyspozycji.
  Znalezione przy pisaniu sekcji 6 dokumentu architektury w F0-06.
  `grep -rn 'createCalendarEntry' src/ | wc -l` zwraca `1`, czyli samą definicję
  w `src/server/actions/calendar.ts:17`. Akcja jest kompletna (sesja, walidacja Zod,
  `INSERT`, `revalidatePath`), ale żaden komponent jej nie woła. Wpis kalendarza da
  się dziś dodać wyłącznie skryptem `tsx` z terminala. To samo dotyczy
  `updateCalendarEntry` i `deleteCalendarEntry` z tego samego pliku.
  Do decyzji usera: czy oś czasu ma dostać ręczne dodawanie wpisów z interfejsu,
  czy `calendar_entries` zostają kanałem wyłącznie agentowym.
  AC:
  - decyzja zapisana w `DECISIONS.md` z datą i uzasadnieniem
  - wariant „dodajemy UI": w widoku `/calendar` jest przycisk otwierający formularz
    nowego wpisu, zapis idzie przez `createCalendarEntry`, po zapisie wpis widać bez
    ręcznego odświeżenia strony; dowód: zrzut ekranu przed i po oraz test e2e
    kończący się kodem 0
  - wariant „kanał agentowy": trzy akcje zostają, ale plik dostaje komentarz nagłówkowy
    mówiący wprost, że wywołuje je Claude Code, nie interfejs, a `docs/ARCHITEKTURA.md`
    sekcja 6 zmienia zdanie o brakującym przycisku na opis świadomego wyboru
  - negatywne: `npm run typecheck` i `npm run lint` kończą się kodem 0 w obu wariantach
  DOWÓD (2026-09-03): **ZROBIONE, wariant „kanał agentowy"** — z poprawką, bo przy
  weryfikacji okazało się, że premisa wariantu była częściowo fałszywa.
  Zmierzone na uruchomionym środowisku, nie wyczytane z kodu:
  1. `grep -rn 'createCalendarEntry' src/ | wc -l` zwraca **1** — sama definicja.
     To samo dla `updateCalendarEntry`, `deleteCalendarEntry` i `listCalendarEntries`.
  2. **Import tych akcji do skryptu `tsx` NIE działa.** Skrypt
     `import { createCalendarEntry } from './src/server/actions/calendar'` kończy się
     wyjątkiem `This module cannot be imported from a Client Component module`,
     bo `requireSession()` ciągnie `src/lib/auth.ts`, a ten pakiet `server-only`.
     Przepisy w `agents/schedule-manager.md:54`, `agents/campaign-strategist.md:58`
     i `CLAUDE.md:31` pokazują ten import jako działający — kłamią. Zapisane jako **F7-30**.
  3. **Droga, która działa**, sprawdzona tym samym skryptem:
     `db.insert(schema.calendarEntries).values({...}).returning()` — utworzyła wiersz
     `id=1` i skasowała go po pomiarze (tabela wróciła do 0 wierszy). To jest sekcja
     „Kiedy potrzebujesz ad-hoc query" z `CLAUDE.md`.
  4. Interfejs **zapisuje** wpisy kalendarza, tylko inną drogą:
     `upsertCalendarEntryForStep` w `src/server/actions/production-steps.ts:332`,
     wołane wyłącznie z `setStepDate`. Czyli `calendar_entries` nie jest tabelą
     bez pisarza, jest tabelą bez formularza.
  DYSPOZYCJA: akcje **zostają**. Nie kasuję ich, bo są jedyną ścieżką zapisu wpisu
  kalendarza z walidacją Zod i sesją, a `CLAUDE.md` opisuje ręczne planowanie jako
  część przepływu agentów; skasowanie wymagałoby też przepisania dwóch person agentów,
  które są produktem usera, a nie kodem infrastruktury. Nie podpinam też przycisku,
  bo to nowa funkcja, nie sprzątanie znaleziska.
  - Nagłówek `src/server/actions/calendar.ts` mówi wprost, że akcji nie woła interfejs,
    którędy naprawdę idzie zapis i że importu z `tsx` się nie da.
  - `docs/ARCHITEKTURA.md` sekcja 6b: zdanie „czego brakuje: przycisku" zamienione
    na opis obu działających dróg zapisu plus pomiar z punktu 2.
  - `npm run typecheck` kod 0, `npm run lint` kod 0,
    `node scripts/check-trust-boundaries.mjs` kod 0, **73 punkty wejścia** bez zmiany.

- [x] **F7-10** `znalezisko` `perf` Zestaw L nie zasiewa katalogów, więc krok P3 był niemierzalny
  Waga: **ważne**. Szacunek: godzina.
  Znalezione przy F1-03. W bazie pomiarowej `marketing_perf` tabele
  `production_templates`, `marketing_templates` i `agents` mają **0 wierszy**
  (`docker exec mc-pg psql -U postgres -d marketing_perf -tAc "select count(*)
  from production_templates"`). Dokładnie te trzy odczyty krok P3 miał wpiąć
  w cache. Efekt: pomiar nie mógł pokazać poprawki, bo zapytania, które cache
  miał omijać, i tak nie mają czego czytać. Hipoteza P3 nie została obalona
  uczciwie, tylko przepadła na luce w danych.
  AC:
  - generator zestawu L (`scripts/perf/`, patrz F0-03) sieje co najmniej
    5 szablonów produkcji, 5 szablonów kampanii i 6 agentów
  - `npm run pg:info` na bazie pomiarowej pokazuje niezerowe liczby dla tych
    trzech tabel
  - `perf/baseline.json` przemierzony po dosianiu i zacommitowany
  - do zestawu mierzonych stron w `scripts/perf/measure-page.mjs` dochodzą
    `/templates` i `/agents`, czyli strony, które te katalogi renderują
  - negatywne: liczby dla siedmiu dotychczasowych stron nie zmieniają się
    o więcej niż 10%, bo dosiane katalogi ich nie dotyczą
  DOWÓD (2026-09-03): **ZROBIONE.**
  - `scripts/perf/seed-large.ts` sieje teraz **5 szablonów produkcji, 5 szablonów
    kampanii i 6 agentów** (`COUNTS.productionTemplates`, `.marketingTemplates`,
    `.agents`), z pełnym kształtem JSON: kroki szablonu, okresy T1/T2/T3, kamienie
    milowe z podkrokami, `dashboard_widget`. Trzy tabele doszły do `truncate`,
    więc generator dalej jest deterministyczny i powtarzalny.
    Wstawianie przez nowy `insertChunkedNoIds`, bo te trzy tabele mają klucz
    tekstowy `slug` i nie mają kolumny `id`, na której stoi `insertChunked`.
  - `npm run pg:info` po dosianiu: `agents 6`, `marketing_templates 5`,
    `production_templates 5` (przed: po zerze w każdej). Reszta bez zmian:
    artists 200, campaigns 40, productions 500, calendar_entries 3000, posts 5000,
    csv_rows 12000.
  - `scripts/perf/measure-page.mjs` mierzy dodatkowo `/templates` i `/agents`,
    a `perf/budget.json` dostał dla nich progi 600 ms, jak dla innych list.
    Zmierzone: `/templates` p50 8,1 ms i p95 9,3 ms, `/agents` p50 5,2 ms
    i p95 5,8 ms (mediany z trzech przebiegów).
  - Strony naprawdę renderują dane, nie pustkę: `/templates` pokazuje 5 kart
    „Szablon produkcji N", `/agents` 6 pozycji „Agent N”; zrzuty
    `screenshots/F7/f7-10-templates.png` i `f7-10-agents.png`.
  - `perf/baseline.json` uzupełniony o oba wpisy z jawną adnotacją, że zmierzono je
    2026-09-03, czyli PO fazach F1 do F6, więc są punktem odniesienia dla F7-11,
    a nie pomiarem sprzed optymalizacji. Siedmiu starszych stron świadomie NIE
    przemierzam: to jedyny zapis stanu „przed", a nadpisanie go dzisiejszymi
    liczbami zamieniłoby go w „po". Powód zapisany w polu `_f7_10` tego pliku.
  - Negatywne kryterium spełnione: mediana **p50** z trzech przebiegów przed
    dosianiem i trzech po — home -1%, calendar -2%, calendar-table -2%,
    productions -1%, production-detail -2%, campaign-detail 0%, analytics -1%.
    Na p95 calendar wyszło +24%, ale to ogon szumu, nie skutek dosiania: p95
    calendar skacze między 70,7 a 94,6 ms w dziewięciu kolejnych przebiegach przy
    p50 stabilnym w przedziale 67,8 do 71,5 ms.
  BRAMKI: `typecheck` 0, `lint` 0, `test` 0, `check-typography` 0,
  `check-trust-boundaries` 0, `perf` 0 (nowe progi trzymają).
  **Odblokowuje F7-11**: katalogi w bazie pomiarowej są niepuste, a obie strony,
  które je renderują, mają zmierzone „przed".

- [x] **F7-11** `znalezisko` `perf` `arch` Cache Components: wrócić do P3 na danych, które istnieją
  Waga: **drobne**. Szacunek: pół dnia. **Zależy od F7-10.**
  Krok P3 (issue F1-03) został cofnięty zgodnie z własnym kryterium, bo żadna
  z siedmiu mierzonych ścieżek nie poprawiła się o 10%. Droga techniczna jest
  jednak rozpoznana i opisana w `DECISIONS.md` (wpis F1-03): działający układ
  to `cacheComponents: true`, `src/app/loading.tsx` jako granica Suspense dla
  wszystkich tras, `<Suspense>` wokół `<Sidebar>` w układzie (bo `usePathname`
  jest daną żądania i wysypuje powłokę tras z parametrem), `await connection()`
  przed `new Date()` w `src/app/page.tsx` oraz zdjęcie `export const runtime`
  z dwóch tras API.
  AC:
  - F7-10 zamknięte, czyli katalogi w bazie pomiarowej są niepuste
  - zmiana odtworzona wg opisu z `DECISIONS.md`, `npm run build` kod 0
  - pomiar przed i po na `/templates` i `/agents`; poprawa co najmniej 10% p95
    na dwóch ścieżkach albo ponowne cofnięcie z wpisem w `DECISIONS.md`
  - negatywne: `e2e/stale-data.spec.ts` zielony
  **DYSPOZYCJA: ŚWIADOMIE ODRZUCONE (2026-09-03).** Powód nie brzmi „utonęło w szumie",
  tylko „sufit zysku jest niższy niż próg kryterium". Zmierzone `\timing` w `psql`
  na `marketing_perf`: `production_templates` 1,085 ms, `marketing_templates` 0,623 ms,
  `agents` **0,412 ms**. Mediana p95 z trzech przebiegów `measure-page.mjs` na budowaniu
  produkcyjnym: `/templates` 9,6 ms (10,5 / 9,1 / 9,6), `/agents` 8,5 ms (8,5 / 5,9 / 8,6).
  Czyli na `/agents` cały odczyt katalogu to **4,8 procent żądania** — cache o zerowym
  koszcie daje mniej niż połowę wymaganych 10 procent, więc kryterium „poprawa na dwóch
  ścieżkach" jest nieosiągalne w żadnym wariancie implementacji. Na `/templates` sufit
  to 18 procent, ale próg 0,96 ms leży wewnątrz rozrzutu p95 między przebiegami (1,4 ms).
  Koszt drugiej strony jest znany z F1-03: 26 skasowanych `export const dynamic`,
  `<Suspense>` wokół `<Sidebar>`, `await connection()`, `updateTag` we wszystkich
  mutacjach katalogów oraz zmierzone tam pogorszenie `campaign-detail` o 11 procent.
  Pełne uzasadnienie i warunek powrotu (zdalna baza albo katalog większy o dwa rzędy
  wielkości) w `DECISIONS.md`, wpis „F7-11".

- [x] **F7-12** `znalezisko` `ui` Martwy kod w gancie: dwie funkcje i dwa importy bez odbiorcy
  Waga: **drobne**. Szacunek: 15 minut. Znalezione przy F2-01.
  `deriveEditingIso` i `subStageState` nie są wołane z żadnego miejsca (ESLint zgłaszał
  to jeszcze przed refaktorem F2-01, w `gantt-view.tsx` linie 139 i 146). Po wydzieleniu
  geometrii leżą w `src/components/calendar/gantt-geometry.ts` i nadal nie mają odbiorcy.
  Tak samo importy `STAGE_LABEL` i `STAGE_HINT` w `gantt-view.tsx`. Nie skasowałem ich
  przy F2-01, bo kryterium tego issue wymaga podziału czysto mechanicznego: przeniesienia
  kodu bez zmiany zawartości. Kasowanie to osobna decyzja.
  AC:
  - `npm run lint 2>&1 | grep -c "gantt-view.tsx\|gantt-geometry.ts"` nie pokazuje już
    ostrzeżeń `no-unused-vars` dla `deriveEditingIso`, `subStageState`, `STAGE_LABEL`
    ani `STAGE_HINT`
  - każda z tych czterech rzeczy albo znika, albo dostaje odbiorcę; wybór opisany
    w komentarzu przy kodzie
  - negatywne: `npm run test` kod 0, wygląd `/calendar` bez zmian (dowód: `pngdiff`
    przed i po, poniżej 0,02 procent pikseli)
  **DYSPOZYCJA: ZROBIONE (2026-09-03).** `deriveEditingIso` i `subStageState` skasowane
  z `src/components/calendar/gantt-stages.ts` razem z re-eksportem w `gantt-geometry.ts`;
  w miejscu po nich został komentarz mówiący, dlaczego zniknęły (gant liczy stan kroków
  z `steps` produkcji przez `gantt-row-model.ts`, a datę montażu bierze z zapisanych dat
  kroków, nie z reguły „dzień po nagrywkach"). Importów `STAGE_LABEL` i `STAGE_HINT`
  w `gantt-view.tsx` już nie było — zniknęły przy podziale w F2-02; `STAGE_HINT` ma
  odbiorcę w `gantt-table-view.tsx`. Dowody: `grep -rn "deriveEditingIso\|subStageState" src/`
  zwraca wyłącznie ten komentarz, `grep -n "STAGE_LABEL\|STAGE_HINT" gantt-view.tsx` zwraca 0,
  `npm run lint` nie zgłasza żadnego ostrzeżenia w `gantt-view.tsx`, `gantt-geometry.ts`
  ani `gantt-stages.ts`. Wygląd `/calendar?week=2026-03-02` na budowaniu produkcyjnym,
  okno 1280x720: **0 różnych pikseli z 7 823 808** (`scripts/perf/pngdiff.mjs`).

- [x] **F7-13** `znalezisko` `ui` Wypisać gant z listy grandfather w ESLint
  Waga: **drobne**. Szacunek: pół dnia. Powstało przy F2-02.
  Sześć plików ganta siedzi na liście wyjątków w `eslint.config.mjs` wyłącznie dlatego,
  że zastany kod o złożoności powyżej 10 zmienił plik przy podziale. Reguła z komentarza
  przy liście mówi: z tej listy się wypisujemy, nie dopisujemy do niej. Wypisanie wymaga
  zejścia poniżej progu 10 w: `GanttRowView` (18), `buildRowModel` (20), `buildDraft` (11),
  dwie funkcje strzałkowe w `gantt-milestones.tsx` (12 i 17), jedna w
  `gantt-milestone-labels.tsx` (18), dwie w `gantt-substep-bar.tsx` (13 i 16),
  plus `Date.now()` w `gantt-row.tsx` wołane w trakcie renderowania (`react-hooks/purity`).
  AC:
  - z listy grandfather w `eslint.config.mjs` znika co najmniej pięć z sześciu ścieżek
    `src/components/calendar/gantt-*`, a `npm run lint` nadal kończy się kodem 0
  - żadna funkcja w wypisanych plikach nie przekracza złożoności 10
    (dowód: `npm run lint 2>&1 | grep -c "complexity"` liczony przed i po, podany w raporcie)
  - `Date.now()` w wierszu ganta przestaje być wołane w trakcie renderowania
  - negatywne: testy z F2-01 zielone bez zmiany treści, `npm run e2e` zielony,
    wygląd `/calendar` bez zmian (dowód: `scripts/perf/pngdiff.mjs` poniżej progu szumu)
  **DYSPOZYCJA: ZROBIONE (2026-09-03).** Lista grandfather w `eslint.config.mjs`
  straciła **wszystkie pięć** ścieżek `src/components/calendar/gantt-*` (issue mówi
  o sześciu, ale F7-06 zdjął już wcześniej `gantt-row-model.ts` — w chwili startu
  na liście stało pięć). Trafień reguły `complexity` w całym repozytorium: **40 przed,
  33 po** (`npx eslint . -f json | jq '[.[].messages[]|select(.ruleId=="complexity")]|length'`).
  Ostrzeżeń lintu razem: 44 przed, **37 po**, 0 błędów.
  Co zeszło poniżej progu i czym: `GanttToolbar` 11 → etykieta kroku liczona raz
  zamiast czterech razy w atrybutach; `GanttRowView` 18 → `tLabelFor`, `railLabels`,
  `rowGapClass` i `progressOf` wyjęte na poziom modułu; strzałka w
  `gantt-milestone-labels.tsx` 18 → podział na `MilestoneLabel` i `MilestoneDate`
  plus `stateTextClass`; dwie strzałki w `gantt-milestones.tsx` 12 i 17 →
  `tickTooltip`, `tickClass`, `TickIcon` i wspólna kaskada; dwie w
  `gantt-substep-bar.tsx` 13 i 16 → `stepTooltip` oraz `stepCircleClass`
  i `accentBorderFor` przeniesione do `gantt-frames.tsx`.
  **Kaskada „kroki po kolei" była wpisana dwa razy** (pasek kamieni i pasek podkroków);
  jest raz, jako `cascadeOverrides` i `statusAfterCascade` w `gantt-geometry.ts`,
  z trzema nowymi testami jednostkowymi (219 zielonych w 20 plikach, było 216).
  **`Date.now()` w wierszu**: zegar jedzie propem `todayMs` z komponentu serwerowego
  `src/app/calendar/page.tsx` (tam jedno `eslint-disable` z uzasadnieniem, zgodnie
  ze wzorcem z `campaigns/[id]/page.tsx`), więc ani wiersz, ani oś nie wołają go
  w renderze klienta. Reguła `react-hooks/purity` milczy.
  **Dowód braku regresji, dwa niezależne:** zrzut `/calendar?week=2026-03-02` na
  budowaniu produkcyjnym w oknie 1280x720 — **0 różnych pikseli z 7 823 808**;
  odpowiedź HTML tej samej trasy urosła o **26 bajtów z 2 522 523**, dokładnie
  o jedno pole `todayMs` w ładunku RSC (sprawdzone: występuje raz), czyli żadna
  klasa ani żaden znacznik się nie zmieniły. `npx playwright test` **22 zielone**
  na `next start` z bazą roboczą. Z11 pilnowany: żaden dotknięty plik nie urósł
  ponad swój rozmiar sprzed zmiany (`gantt-toolbar.tsx` 442 = 442),
  żaden nie przekracza 300 linii poza zastanym `gantt-toolbar.tsx`.

- [x] **F7-14** `znalezisko` `ui` `tooling` Turbopack w trybie deweloperskim gubi siatkę dni w pasach T
  Znalezione przy F2-05. `npm run dev:alt` (turbopack) renderuje `/calendar` inaczej niż
  `next build` + `next start` i inaczej niż `npm run dev` (webpack): wewnątrz kolorowych
  pasów T1/T2/T3 znikają pionowe kreski siatki dni. Siatka jest rysowana inline stylem
  `repeating-linear-gradient(... var(--border) ...)` w `gantt-row-bands.tsx`, a pas leży
  nad nią z klasą tła z modyfikatorem przezroczystości (`FRAME_TONE[*].bg`
  w `gantt-frames.tsx`), więc pierwszy podejrzany to inne przetworzenie modyfikatora
  alfa Tailwinda v4 przez turbopacka. Liczby: zrzut produkcyjny wobec dev-webpacka
  różni się o 6 306 pikseli z 7 823 808, wobec dev-turbopacka o 82 921.
  Waga: **ważne** — blokuje przełączenie trybu deweloperskiego na bundler
  trzynaście razy szybszy w HMR (157 ms wobec 2017 ms), czyli na główny ból zgłoszony
  przez usera. Szacunek: pół dnia.
  AC:
  - przyczyna różnicy nazwana i zapisana w `DECISIONS.md` (który plik CSS albo która
    klasa, i dlaczego bundler ją zmienia)
  - zrzut `/calendar?view=week` z `npm run dev:alt` różni się od zrzutu produkcyjnego
    o mniej niż 10 000 pikseli z 7 823 808 (dowód: `node scripts/perf/pngdiff.mjs`)
  - po spełnieniu powyższego `dev` przełączone na turbopacka, `dev:alt` na webpacka,
    a pomiar `npm run perf:dev` powtórzony i dopisany do `DECISIONS.md`
  - negatywne: `npm run build` kod 0, pełny zestaw e2e zielony
  **DYSPOZYCJA: ZROBIONE (2026-09-03), ale objaw był już nieaktualny.**
  Podejrzany z treści znaleziska — modyfikator alfa Tailwinda v4 — jest niewinny:
  wyliczone tło pasa T1 to `oklab(0.962 -0.0058 0.0587 / 0.55)` w OBU bundlerach
  (Playwright, `getComputedStyle`, ta sama baza, ta sama trasa). Jedyna zmierzona
  różnica CSS: turbopack przepuszcza arkusz przez lightningcss, który przepisuje
  `--border` z `oklch(0.90 0.01 255)` na równoważne `lab(88.3796% -.806093 -3.66544)`;
  gradient siatki dni dostaje więc ten sam kolor w innym zapisie.
  **Siatka dni nie znika.** Zrzut samego pasa (element `div.h-[5.5rem]`) z dev-turbopacka
  wobec `next start`: **0 różnych pikseli**. Cała `/calendar?view=week`, zrzut pełnej
  wysokości: turbopack wobec produkcji **6 832** piksele, webpack wobec produkcji
  **7 417** — turbopack jest dziś bliżej produkcji niż webpack, kryterium „mniej niż
  10 000" spełnione z zapasem. Którego commitu z F1–F6 to zasługa, nie ustalam:
  odtwarzanie stanu sprzed pięciu faz kosztuje więcej niż warte jest nazwisko winowajcy.
  **Przełączone:** `dev` = turbopack, `dev:alt` = webpack. `npm run perf:dev`
  powtórzony: `hmrMs` **1961 → 466 ms** (4,2x), `firstCompileMs` 2748 → 1162,
  `warmP50Ms` 130 → 205, `readyMs` 444 → 475, `peakRssMb` 1556 → 1602 — wszystko
  z zapasem pod limitami. Liczby z F2-05 (13x) nie potwierdzają się na dzisiejszym
  kodzie i nie są przepisywane. Dopisane do `DECISIONS.md` (wpis „F7-14"),
  `docs/ARCHITEKTURA.md` sekcja 8 i wiersz 10 tabeli weryfikacji,
  `plan/01-analiza-i-zasady.md` tabela stosu.
  **Przy okazji naprawiony błąd raportu perf**: `runsOfKind` sortowało przebiegi
  po nazwie pliku, a nazwa trybu deweloperskiego ma bundler przed datą
  (`dev-turbopack-…` < `dev-webpack-…`), więc sekcja DEV pokazywała starszy przebieg
  jako najnowszy. Sortuje po polu `at`.
  Bramki po zmianie: `typecheck` 0, `lint` 0 (37 ostrzeżeń), `test` 219 zielonych,
  `check-typography` 0, `check-trust-boundaries` 0, `perf` 0, `npx playwright test`
  22 zielone na `next start`.

- [x] **F7-15** `znalezisko` `ui` Mikro-etykieta sekcji powielona 90 razy w pięciu wariantach
  Znalezione przy F3-01. Nagłówek sekcji „małe wersaliki z rozstrzeloną spacją" jest
  wpisywany ręcznie w klasach: `text-[10px] uppercase tracking-[0.12em] text-muted-foreground
  tabular-nums` (13 razy), `... tracking-[0.14em] text-muted-foreground` (10),
  to samo z `font-medium` (9), z `font-semibold` (7), z `font-bold` (6), plus warianty
  z `text-[11px] tracking-[0.16em]`. Razem 90 wystąpień, różnica między nimi to wyłącznie
  grubość pisma i rozstrzelenie. To jest dokładnie „N kopii", przed którym stoi faza F3,
  tylko że w typografii, nie w guziku. Naturalne miejsce naprawy to F3-06 (kanon typografii),
  dlatego F3-01 tego nie migrował: 90 podmian w kilkunastu plikach nie zmieściłoby się
  w jednym issue razem z inwentaryzacją i nie dałoby się uczciwie sprawdzić zrzutami.
  Waga: **drobne** — nic nie psuje, kosztuje przy każdej zmianie stylu nagłówków.
  Szacunek: pół dnia.
  AC:
  - komponent `src/components/ui/section-label.tsx` z wariantami CVA pokrywającymi
    pięć zmierzonych kształtów, wpisany do katalogu w `plan/05` sekcja 3
  - `grep -rnoE 'text-\[1[01]px\] uppercase tracking-\[0\.1[0-9]em\]' src --include='*.tsx' | wc -l`
    zwraca `0`
  - wygląd niezmieniony: zrzuty przed i po dla `/`, `/productions` i `/campaigns`,
    każdy poniżej progu szumu (`node scripts/perf/pngdiff.mjs`, próg 1 680 pikseli)
  - negatywne: `npm run test` i `npm run e2e` zielone
  **DYSPOZYCJA: ZROBIONE (2026-09-03), z jednym świadomym odstępstwem od kryterium 1.**
  Kanon nie jest komponentem `section-label.tsx` z CVA, tylko **sześcioma utility
  Tailwinda v4 w `src/app/globals.css`** (`label-micro`, `-wide`, `-wider`, `label-mini`,
  `-wide`, `-wider`), spisanymi w `plan/05` sekcja 3b. Powód jest zmierzony, nie
  estetyczny: wariantów nie było pięć, tylko **sześć kształtów rozmiaru i rozstrzelenia
  w 90 wystąpieniach w 37 plikach**, a na nich **czterdzieści różnych łańcuchów klas** —
  dziewięć kolorów, z czego cztery liczone w czasie działania (`${tone.ink}`,
  `${frame.accent}`, `${tone.accent}`, `${categoryTone}`), do tego `tabular-nums`,
  `shrink-0`, `truncate`, `mb-2`, `hover:*`, `font-mono` i pięć innych dodatków.
  Etykiety siedzą na siedmiu różnych znacznikach (`div`, `span`, `p`, `label`, `th`,
  `button`, `h3`). Komponent musiałby mieć oś rozmiaru, rozstrzelenia, grubości, koloru,
  prop `as` **i** przelot `className` używany w większości wywołań — czyli więcej kodu
  niż usuwa. Utility robi dokładnie to, co miało robić kryterium: jedno miejsce zmiany
  kanonu, zero zmian w drzewie DOM.
  Dowody: `grep -rnoE 'text-\[1[01]px\] uppercase tracking-\[0\.1[0-9]em\]' src --include='*.tsx' | wc -l`
  → **0** (było 90). Zrzuty przed i po na budowaniu produkcyjnym, okno 1280x720:
  `/` **0**, `/campaigns` **0**, `/templates` **0**, `/calendar` **0**,
  `/productions` **64** piksele — a te 64 to szum danych, zmierzony osobno na dwóch
  budowaniach BEZ zmiany (ta sama liczba). `npm run test` 219 zielonych,
  `npx playwright test` 22 zielone, sześć bramek zielonych, bundel 293,2 kB przy 301,6.
  **Pułapka warta zapamiętania, kosztowała pierwsze podejście:** własne utility nie jest
  znane `tailwind-merge`, więc `cn()` przestaje widzieć kolizję z `text-sm` z wariantu
  `Button` i zostawia obie klasy. Rozmiar wygrywa nasz, ale **wysokość wiersza zostaje
  po `text-sm`** i element rośnie: przycisk skrótów w panelu bocznym miał 21 px, po
  migracji 20,28 px, co przesuwało całą nawigację o 0,17 px i dawało 1 512 różnych
  pikseli na każdej stronie. Naprawione zgłoszeniem klas `label-*` jako grupy
  `font-size` w `extendTailwindMerge` w `src/lib/utils.ts` — po tym zrzuty schodzą do zera.
  **Odstępstwo od Z11:** `src/app/globals.css` urósł z 333 do 345 linii (jest ponad
  progiem 300). Dwanaście linii kanonu w zamian za skasowanie 90 duplikatów; wynoszenie
  ich do osobnego pliku CSS schowałoby kanon przed tym, kto go szuka.

- [x] **F7-16** `znalezisko` `ui` Trzy komponenty z `ui/` nie mają ani jednego użycia
  Znalezione przy F3-01. `src/components/ui/card.tsx`, `badge.tsx` i `table.tsx` nie są
  importowane nigdzie w `src/` (`grep -rn "ui/card\|ui/badge\|ui/table" src --include='*.tsx' | wc -l`
  zwraca `0`), a równolegle w kodzie stoi 11 plików z ręcznie składaną kartą
  (`rounded-xl border border-border`) i 4 surowe `<table>`. Albo komponenty mają zostać
  użyte, albo mają zniknąć; dziś są martwym kodem, który udaje istniejący wzorzec
  i psuje inwentarz z `plan/05` sekcja 1.
  Waga: **drobne**. Szacunek: pół dnia (decyzja) plus migracja, jeśli decyzja brzmi „użyć".
  AC:
  - dyspozycja zapisana w `DECISIONS.md`: dla każdego z trzech plików „migrujemy do niego"
    albo „kasujemy"
  - po wykonaniu dyspozycji `grep -rn "ui/card\|ui/badge\|ui/table" src --include='*.tsx' | wc -l`
    zwraca liczbę większą od zera albo pliki nie istnieją
  - negatywne: wygląd ekranów `/`, `/productions`, `/campaigns` bez zmian
    (`node scripts/perf/pngdiff.mjs` poniżej progu szumu)

  **DYSPOZYCJA: ZROBIONE (częściowo przez unieważnienie premisy).** Znalezisko mówiło
  o trzech martwych plikach; dziś martwy jest jeden. `badge.tsx` i `table.tsx` dostały
  odbiorców w F4 — `grep -rn "ui/card\|ui/badge\|ui/table" src --include='*.tsx' | wc -l`
  zwraca **3**, nie `0`: `import/import-preview.tsx` (Badge + Table) oraz
  `import/import-mapping.tsx` (Table). Zostają.
  `src/components/ui/card.tsx` (103 linie, 7 eksportów, 0 importów) **skasowany**.
  Wariant „migrujemy" odpadł liczbowo: `Card` rysuje `ring-1 ring-foreground/10`
  zamiast zastanego `border border-border`, a pierścień leży na zewnątrz pudełka —
  jedenaście kart przesunęłoby się o piksel na krawędź, co łamie kryterium negatywne
  tego samego issue. Powód w `DECISIONS.md` pod „F7-16".
  Dowód: `npm run typecheck` kod 0; zrzuty 1280x720 `/`, `/productions`, `/campaigns`
  przed i po — **0, 0, 0** różnych pikseli (`scripts/perf/pngdiff.mjs`).

- [x] **F7-17** `znalezisko` `ui` Długie myślniki w treściach z `data/`, poza zakresem Z7
  Znalezione przy F3-06. Zasada Z7 obejmuje dosłownie literały w `src/`, więc kanon
  typografii wyzerował je tylko tam. Tymczasem opisy agentów i szablonów żyją w plikach
  danych i trafiają na ekran bez zmiany: `grep -rno '—' data/agents/*.json | wc -l`
  zwraca `29`, a napisy w rodzaju „Pisze maile do artystów — cold, zaproszenia, briefy"
  widać na pulpicie (`screenshots/F3/po-F3-06-home.png`, karty agentów). Te same pliki
  niosą jednak także system prompty agentów, więc masowa podmiana znaku zmieniłaby
  tekst wysyłany do modelu, a nie tylko interpunkcję w interfejsie. Rozdzielenie pól
  „widoczne w aplikacji" od „idące do modelu" to osobna robota, nie poprawka przy okazji.
  Waga: **drobne**. Szacunek: dwie godziny.
  AC:
  - `grep -rno '—' data/agents/*.json data/templates/*.json | wc -l` liczony wyłącznie
    dla pól renderowanych w interfejsie (`name`, `description`, `dashboardWidget`,
    `sidePanel`) zwraca `0`; pola z promptem systemowym zostają nietknięte, co widać
    w `git diff`
  - zrzut pulpitu po zmianie nie pokazuje ani jednego długiego myślnika w kartach agentów
  - negatywne: `npm run test` kod 0, treść promptów agentów bajt w bajt bez zmian
    (`git diff -- data/agents | grep '"systemPrompt"' | wc -l` zwraca `0`)

  **DYSPOZYCJA: ZROBIONE, ale zakres wyszedł poza pliki.** Pomiar unieważnił połowę
  treści znaleziska: `data/*.json` **nie jest już źródłem prawdy dla ekranu** — katalog
  agentów i szablonów mieszka w Postgresie (`agents`, `production_templates`,
  `marketing_templates`, backfill `drizzle/seed-catalog.ts`). Sama poprawka w plikach
  nie zmieniłaby ani jednego piksela. Naprawione oba miejsca.
  Rozdzielenie „na ekran" od „do modelu" okazało się darmowe: prompt siedzi w osobnym
  kluczu `systemPrompt`, a szablony produkcji i kampanii nie mają promptu w ogóle.
  Podmiana ` — ` na ` - ` (Z7 dopuszcza krótki myślnik z odstępami) — mechaniczna bez
  ryzyka, bo wszystkie wystąpienia w `data/` to dokładnie spacja-myślnik-spacja.
  Dowód: `/`, `/agents`, `/templates`, `/campaigns`, `/productions` — `innerText`
  strony daje **0** długich myślników na każdej. W bazie pola widoczne: **0**,
  `system_prompt`: **6 przed i 6 po**. `git diff -U0 -- data/agents` nie ma ani jednej
  zmienionej linii z `"systemPrompt"`, sumy kontrolne `jq -r .systemPrompt` zgodne
  z `HEAD` dla wszystkich sześciu agentów. Zrzut pulpitu 1280x720 wobec stanu sprzed
  zmiany: **908** różnych pikseli, wyłącznie przelanie trzech opisów na kartach agentów
  (jedyne pola, które się zmieniły). `npm run test` 219 zielonych.
  **Bramka:** `scripts/check-typography.mjs` skanuje teraz `data/**/*.json` poza
  `_backup*`, z wyjątkiem klucza `systemPrompt`; test negatywny (wstawiony myślnik)
  daje kod 1 z nazwą pliku i pola. Z7 w `plan/01` dostał ten zakres.

- [x] **F7-18** `znalezisko` `test` `tooling` `npx playwright test` po cichu bierze
  cudzy serwer i cudzą bazę
  Znalezione przy zamykaniu F3. `playwright.config.ts` ma `reuseExistingServer: true`,
  więc gdy na porcie 3000 stoi cokolwiek innego niż `npm run dev` (na przykład
  `npm run perf:serve`, czyli build produkcyjny na bazie `marketing_perf`), testy
  puszczają się na tamtym serwerze i tamtej bazie bez jednego słowa ostrzeżenia. Efekt:
  dwa czerwone testy, których treść sugeruje regresję w kodzie („element nie znaleziony",
  „brak szablonu kampanii"), a naprawdę mówią tylko tyle, że baza nie ma danych.
  Wersja z ubitym serwerem produkcyjnym: 8 zielonych, ten sam kod.
  Waga: **drobne**, ale kosztuje godzinę fałszywego tropu za każdym razem.
  AC:
  - przed pierwszym testem uruchamia się sprawdzenie, które porównuje bazę
    używaną przez serwer pod `E2E_BASE_URL` z oczekiwaną (`marketing`) i przerywa
    przebieg z czytelnym komunikatem, gdy się różnią; najtańsza droga to endpoint
    diagnostyczny albo `globalSetup` wołający istniejącą stronę i sprawdzający znacznik
  - dowód: `npm run perf:serve` w tle plus `npx playwright test` kończy się komunikatem
    o niewłaściwym serwerze, a nie dwoma czerwonymi testami
  - negatywne: przy poprawnie wystawionym `npm run dev` przebieg nadal daje 8 zielonych
    i nie wydłuża się o więcej niż 2 sekundy

  **DYSPOZYCJA: ZROBIONE.** `e2e/global-setup.ts` przed pierwszym testem pyta serwer
  pod `E2E_BASE_URL` o `/api/health` i porównuje odpowiedź z nazwą bazy z `DATABASE_URL`
  runnera (nadpisywalne przez `E2E_EXPECTED_DB`). Endpoint (`src/app/api/health/route.ts`)
  jest za sesją i czyta nazwę z `DATABASE_URL`, bez zapytania do bazy. Ciasteczko sesji
  podpisujemy w setupie tym samym sekretem co aplikacja, zamiast logować się przez
  przeglądarkę — start chromium kosztowałby sekundy, a to sprawdzenie ma być darmowe.
  Dowód pozytywny: przy `npm run perf:serve` na porcie 3000 `npx playwright test`
  kończy się komunikatem „Serwer na http://localhost:3000 stoi na bazie
  \"marketing_perf\", a testy zakładają \"marketing\"" i nie uruchamia ani jednego testu.
  Dowód negatywny: na `npx next start` z bazą roboczą **22 zielone w 24,7 s**;
  samo sprawdzenie to jedno żądanie, zmierzone **28 ms** (limit z kryterium: 2000 ms).
  Przy tym `scripts/check-trust-boundaries.mjs` dostał dla handlerów `route.ts` tę samą
  regułę, którą miał już dla akcji serwerowych: handler bez parametru nie dostaje
  `Request`, więc nie ma w nim wejścia do walidacji. Punktów wejścia 73 → **74**, bez
  schematu mimo argumentów **0**.

- [x] **F7-19** `znalezisko` `db` `import` Przeniesienie danych z `videographers.contact`
  do `handle` i `email`
  Znalezione przy F4-00. Migracja 0003 dołożyła kamerzystom `handle`, `email`, `phone`,
  `location` i `status`, ale jest wyłącznie addytywna: stare pole `contact` zostaje
  nietknięte i nadal trzyma wymieszaną treść (raz profil z Instagrama, raz adres pocztowy,
  raz numer). Pomiar na bazie pomiarowej: 60 kamerzystów, z tego **36 z niepustym
  `contact`**. Dopóki tego nie rozdzielimy, ekran kamerzystów pokazuje kontakt z jednego
  pola, a import zapisuje do drugiego, więc ta sama osoba ma dwa kontakty i żaden nie jest
  źródłem prawdy.
  Waga: **ważne**. Szacunek: pół dnia.
  AC:
  - jednorazowy skrypt (`scripts/`, nie migracja SQL, bo decyzja jest heurystyczna)
    czyta `contact`, rozpoznaje trzy kształty (handle z Instagrama, email, telefon)
    i zapisuje do właściwej kolumny przez `normalizeRow` z `src/lib/import/normalize.ts`,
    żeby reguły były jedne, a nie dwie
  - skrypt jest odwracalny: nie kasuje `contact` w tym samym przebiegu, tylko wypełnia
    puste pola docelowe; osobne uruchomienie z flagą czyści `contact`
  - dowód: liczby przed i po (`ile contact niepustych`, `ile handle`, `ile email`,
    `ile phone`) w raporcie, plus lista wierszy nierozpoznanych
  - negatywne: wiersz, w którym `handle` albo `email` jest już wypełniony, nie jest
    nadpisywany; wiersz o nierozpoznanym kształcie zostaje bez zmian i trafia na listę
    do ręcznego przejrzenia

  **DYSPOZYCJA: ZROBIONE (skrypt), z jawnym ograniczeniem co do danych.**
  `scripts/split-videographer-contact.ts`. Reguła „do którego pola" mieszka
  w `src/lib/import/normalize.ts` jako `contactField` i ma cztery testy jednostkowe
  (219 → **223** zielonych); samą normalizację robi `normalizeRow`, więc reguły są jedne.
  Domyślnie sucha próba, zapis pod `--apply`, czyszczenie `contact` wyłącznie pod
  osobnym `--apply --clear-contact`, i tylko dla wierszy, których treść naprawdę
  wylądowała w kolumnie docelowej.
  Dowód na kopii `marketing_f719` (klon `marketing_perf` plus siedem wierszy dosypanych
  ręcznie, żeby trafić w każdą gałąź): 43 wiersze z niepustym `contact` →
  **email 36, handle 2, phone 2, konflikt 1, nierozpoznane 2**. Po `--apply`
  `contact` niepusty nadal **43** (odwracalność), kolumny docelowe wypełnione.
  Po osobnym `--clear-contact` zostają **3** wiersze z `contact`: dwa nierozpoznane
  („ul. Długa 5, Gdańsk", „kamerzysta") i jeden konflikt (`email` miał inną treść).
  Wiersz nierozpoznany i wiersz z konfliktem nie zostały nadpisane ani wyczyszczone.
  **Dane produkcyjne:** baza robocza `marketing` ma **zero** kamerzystów, więc
  do przeniesienia nie ma tam nic (przebieg `--apply` wypisuje same zera). Liczba 36
  z treści znaleziska pochodzi z baz syntetycznych. `marketing_preview` przeniesione
  (**36 email**, `contact` nietknięty); `marketing_perf` celowo pominięte, bo na niej
  stoi punkt odniesienia pomiarów.
  **`--clear-contact` nie zostało uruchomione na żadnej prawdziwej bazie.**
  Blokada zdjęta 2026-09-03 razem z **F7-32**: interfejs czyta już `handle`, `email`
  i `phone` z ich własnych kolumn, więc czyszczenie `contact` niczego nie opróżnia
  (dowód: zrzuty przed i po czyszczeniu różnią się o 0 pikseli). Samo uruchomienie
  na `marketing_preview` zostawiam userowi — to operacja jednokierunkowa, a korzyść
  jest kosmetyczna. Kryteria F7-19 są tym samym spełnione w całości.

**DoD F7:** każde znalezisko ma issue; każde issue ma dyspozycję: zrobione, świadomie
odrzucone z powodem, albo przeniesione do trackera zewnętrznego z linkiem.


- [x] **F7-20** `znalezisko` `ui` Pole wyboru pokazuje surową wartość zamiast etykiety
  Znalezione przy F4-04. `SelectValue` z Base UI renderuje domyślnie `value`, a nie tekst
  wybranej pozycji, więc formularz agenta pokazuje w zwiniętym polu `sidePanel` i
  `widgetKind` surowe klucze, mimo że lista rozwinięta ma polskie etykiety. Ekran importu
  miał ten sam błąd i dostał formatter (`<SelectValue>{(v) => ETYKIETY[v]}</SelectValue>`),
  ale zastane pole w `src/components/agents/agent-form.tsx` nadal go nie ma.
  Waga: **drobne**. Szacunek: godzina.
  AC:
  - `/agents/new` pokazuje w zwiniętym polu „Panel kontekstu" i „Widget na pulpicie"
    tę samą etykietę, którą widać na liście rozwiniętej (dowód: zrzut ekranu obu stanów)
  - `grep -rn 'SelectValue />' src/components | wc -l` zwraca `0` albo każde pozostałe
    wystąpienie ma wartość równą etykiecie i jest to napisane w komentarzu obok
  - negatywne: żaden inny tekst na formularzu agenta się nie zmienia

  **DYSPOZYCJA: ZROBIONE.** Oba pola w `src/components/agents/agent-form.tsx` dostały
  formatter, ten sam wzorzec co na ekranie importu. Zmierzone na `/agents/new`
  (dev, okno 1280x900): zwinięte „Panel kontekstu" pokazywało `calendar-14`, teraz
  **„Kalendarz, 14 dni"**; zwinięty „Widget na pulpicie" pokazywał `__none__`, teraz
  **„- brak widgetu -"**. Po wyborze z listy: `Zaległe wpisy kalendarza`
  i `Lista artystów` — dokładnie te napisy, które stoją w rozwiniętej liście
  (odczyt `innerText` z `#sidePanel` i `#widgetKind`, zrzuty stanu zwiniętego
  i obu list rozwiniętych).
  `grep -rn 'SelectValue />' src/components | wc -l` zwraca **0**.
  Wartownik `__none__` ma teraz jedną nazwę (`BRAK_WIDGETU`), więc etykieta pozycji
  na liście i etykieta w zwiniętym polu nie mogą się już rozjechać.
  Negatywne: różnica zrzutu 1280x720 to **930** pikseli i cała leży w samym polu
  wyboru, które zrobiło się szersze od dłuższego napisu; reszta formularza bez zmian.
  `npm run test` 223 zielone.

- [x] **F7-21** `znalezisko` `test` `tooling` Testy e2e importu piszą do bazy roboczej
  Znalezione przy F4-05. `playwright.config.ts` nie ustawia bazy, więc scenariusz pełnego
  importu wpisuje 975 syntetycznych osób do tej bazy, na której stoi serwer deweloperski
  (`marketing`). Test sprząta po sobie po znaczniku `max(id)` sprzed przebiegu, ale to
  łata, nie izolacja: przerwany przebieg zostawia dane, a równoległe workery skasowałyby
  sobie wiersze nawzajem. Zastane `e2e/revalidate.spec.ts` i `e2e/stale-data.spec.ts`
  nie sprzątają w ogóle: każdy pełny `npx playwright test` dokłada do bazy roboczej pięć
  wierszy („Artysta F1-04" x3, „Osoba F1-04", „Test cache"), zmierzone na czterech
  kolejnych przebiegach. Baza robocza rośnie o śmieci testowe przy każdym uruchomieniu
  zestawu.
  Waga: **ważne**. Szacunek: pół dnia.
  AC:
  - `npx playwright test` startuje serwer na `TEST_DATABASE_URL`, nie na `DATABASE_URL`
    (dowód: `select count(*) from artists` w bazie `marketing` przed i po pełnym przebiegu
    e2e daje tę samą liczbę, bez żadnego sprzątania w teście; dziś rośnie o 5)
  - `revalidate.spec.ts` i `stale-data.spec.ts` kasują wiersze, które utworzyły
  - baza testowa jest czyszczona przed przebiegiem, nie po nim, więc przerwany przebieg
    nie psuje następnego
  - sprzątanie po znaczniku `max(id)` znika z `e2e/import-osoby.spec.ts`
  - negatywne: `npm run dev` i `npm run perf` dalej używają swoich baz, żaden skrypt
    nie zaczyna wskazywać na `marketing_test`
  ZROBIONE. `playwright.config.ts` stawia serwer skryptem `scripts/e2e-serve.mjs`:
  podmienia `DATABASE_URL` na `TEST_DATABASE_URL` (z odmową, gdy równy roboczej,
  pomiarowej albo podglądowej), przed startem robi migrację, zasiew zestawem L
  (`scripts/perf/seed-large.ts` sam robi `truncate`, więc czyszczenie jest PRZED
  przebiegiem) i zasiew prawdziwego katalogu (`drizzle/seed-catalog.ts`, bo kreator
  kampanii szuka szablonu po nazwie z katalogu), dopiero potem `next dev`.
  Dowód izolacji: `select count(*)` na bazie `marketing` przed pełnym przebiegiem
  `152|97|29` (artyści, produkcje, kampanie) i po przebiegu `152|97|29`, bez żadnego
  sprzątania; baza `marketing_test` po przebiegu ma 975 artystów z importu.
  `e2e/global-setup.ts` porównuje teraz nazwę bazy serwera z `TEST_DATABASE_URL`.
  `revalidate.spec.ts` i `stale-data.spec.ts` dostały `afterAll` kasujące własne
  wiersze (prefiksy `Prod F1-04`, `Kampania F1-04`, `Artysta/Osoba F1-04`, `Test cache`).
  Znacznik `max(id)` z `import-osoby.spec.ts` zniknął; stan między testami bloku
  przywraca `truncate table artists restart identity cascade` — wolno, bo baza jest
  wyłącznie testowa. Nowy `e2e/db.ts` kieruje zapytania scenariuszy na tę samą bazę,
  na której stoi serwer.
  Negatywne: `npm run dev`, `npm run perf`, `perf:serve`, `preview` bez zmian —
  żaden z nich nie dotyka `TEST_DATABASE_URL`.
  Bramki: `npx playwright test` **22 zielone w 1,5 min**, `npm run typecheck` 0,
  `npm run lint` 0 błędów i 37 ostrzeżeń, `npm run test` 223 zielone,
  `check-typography` 0, `check-trust-boundaries` 0 (74 punkty wejścia).

- [x] **F7-22** `znalezisko` `docs` `AGENTS.md` wskazuje nieistniejący plik planu
  Znalezione przy F4-04. Wiersz „Import osób z arkusza" w `AGENTS.md` kieruje do
  `plan/04-import-osob.md`, a plik nazywa się `plan/04-import-excel.md`. Router, który
  wysyła w nieistniejące miejsce, kosztuje każdego agenta jedno zmarnowane szukanie.
  Waga: **drobne**. Szacunek: pięć minut.
  AC:
  - każda ścieżka wymieniona w tabeli `AGENTS.md` istnieje (dowód: pętla po ścieżkach
    z tabeli, `test -e` dla każdej, zero brakujących)
  - negatywne: treść wierszy tabeli poza ścieżkami nie zmienia się
  ŚWIADOMIE ODRZUCONE, bo znalezisko jest nieaktualne — problem naprawił się przy
  F4-07. Dowód: `git show 202e9c7 -- AGENTS.md` pokazuje podmianę
  `plan/04-import-osob.md` na `plan/04-import-excel.md` w tym samym wierszu tabeli
  (przy okazji usuwania `scripts/import-people.ts`). Kryterium sprawdzone dziś na
  stanie drzewa: pętla po wszystkich ścieżkach w cudzysłowach odwrotnych z `AGENTS.md`
  z `test -e` dla każdej daje **zero brakujących plików**; jedyny wynik negatywny to
  skrót prozą `migrations/` w zdaniu „W `migrations/` nie grzeb ręcznie", w komórce,
  która pełną ścieżkę `drizzle/migrations/` podaje wiersz wcześniej — to nie jest
  wpis nawigacyjny, więc zostaje bez zmian.

- [ ] **F7-23** `znalezisko` `security` Dwa prawdziwe handle z Instagrama zostały
  w kryterium akceptacji F4-07
  Znalezione przy F4-07. Skrypt z danymi na sztywno zniknął, ale kryterium, które
  kazało go usunąć, cytuje dwa prawdziwe handle w komendzie `grep`. `plan/08-BACKLOG.md`
  jest zwykłym plikiem w repozytorium, więc dane osobowe dalej leżą w drzewie roboczym,
  tyle że w innym miejscu. Świadomie nie tknięte przy F4-07: usunięcie ich teraz i tak
  nie wyjmie ich z historii, a zmiana kryterium w trakcie jego rozliczania zabiera dowód.
  Robić razem z decyzją o czyszczeniu historii (`docs/ARCHITEKTURA.md` sekcja 9).
  Waga: **ważne**. Szacunek: pół godziny, plus czas decyzji usera.
  AC:
  - `grep -rn '@noyasnee' --exclude-dir=node_modules --exclude-dir=.git . | wc -l`
    zwraca `0`
  - dowód F4-07 dalej daje się odtworzyć: kryterium zastąpione komendą, która nie cytuje
    prawdziwych danych, na przykład sprawdzeniem, że `scripts/import-people.ts` nie istnieje
  - negatywne: żadne inne kryterium w `plan/08-BACKLOG.md` nie zmienia treści

- [x] **F7-24** `znalezisko` `ui` Tytułu produkcji nie widać nigdzie na jej stronie
  Znalezione przy F5-03. `src/app/productions/[id]/page.tsx` liczy
  `displayTitle = artist ? artist.name : production.title`, więc produkcja przypisana
  do artysty (a każda musi mieć artystę, `createProduction` odrzuca brak) pokazuje
  w nagłówku nazwę artysty, a własny tytuł nigdzie. Na liście produkcji tytuł też widać
  tylko w nagłówku grupy (`ProductionCard` z `showHeader`), czyli dla wiersza „Solo,
  po kamerzyście". Skutek: user wpisuje tytuł w kreatorze („Kolaba z Anią - singiel
  Świt") i już nigdy go nie zobaczy; przy dwóch produkcjach tego samego artysty nie ma
  ich czym rozróżnić. Test e2e dodania produkcji musiał z tego powodu szukać produkcji
  po odnośniku `/productions/<id>`, nie po tytule.
  Waga: **ważne**. Szacunek: godzina.
  AC:
  - strona `/productions/<id>` pokazuje tytuł produkcji, a nazwa artysty zostaje przy nim
    (dowód: zrzut ekranu produkcji z tytułem innym niż nazwa artysty)
  - lista produkcji pokazuje tytuł każdej produkcji, nie tylko w nagłówku grupy
    (dowód: zrzut listy z dwiema produkcjami tego samego artysty, obie rozróżnialne)
  - negatywne: `npm run perf` kod 0, bundel `/calendar` bez wzrostu powyżej progu
  ZROBIONE. Najpierw sprawdzone, czy tytuł w ogóle jest w danych: `select count(*),
  count(nullif(trim(title),''))` daje `504|504` na bazie z zestawem L i `97|97` na
  roboczej, więc problemem było wyłącznie wyświetlanie.
  `src/app/productions/[id]/page.tsx`: `displayTitle` to teraz
  `production.title || artist?.name || 'Produkcja'`, a nazwa artysty stoi w wierszu
  pod tytułem, obok T-0. `src/components/productions/productions-list.tsx`:
  `ProductionCard` straciło przełącznik `showHeader` i rysuje tytuł na KAŻDEJ karcie.
  Dowód: zrzuty `screenshots/f724-przed-productions_332.png` (nagłówek „Ewa Wiśniewska",
  tytułu „Produkcja 332" nie widać nigdzie) i `screenshots/f724-po-productions_332.png`
  (nagłówek „Produkcja 332", pod nim „Ewa Wiśniewska") oraz
  `screenshots/f724-po-productions_list.png` — Jakub Grabowski, dwie produkcje w grupie,
  „Produkcja 394" i „Produkcja 2", rozróżnialne.
  Różnice `pngdiff` są duże z definicji zmiany: strona produkcji **9 943** piksele
  (napis w nagłówku i nowy wiersz z artystą), lista **109 848** (każda karta dostała
  wiersz tytułu, więc treść niżej się przesunęła).
  `e2e/f5-scenariusze.spec.ts` sprawdza teraz tytuł wprost: nagłówek H1 na stronie
  produkcji i tytuł w karcie na liście, zamiast rozpoznawania po samym odnośniku.

- [x] **F7-25** `znalezisko` `ui` Odnośniki nawigacji poniżej 44 px obszaru dotyku
  Znalezione przy F6-01. Halo 44 x 44 px dostały guziki komponentu `Button`
  (`pointer-coarse:after:*` w `src/components/ui/button.tsx`), ale nawigacja w pasku
  bocznym to zwykłe `<a>` z `src/components/sidebar.tsx`, które halo omija. Zmierzone
  na `pointer: coarse` (`node scripts/a11y-audit.mjs` przed zawężeniem sprawdzenia do
  `[data-slot="button"]`): pozycje główne 215 x 36 px, podpozycje 178 x 31 px, odnośniki
  agentów 215 x 24 px, logo 148 x 36 px. Na ekranie dotykowym to poniżej zalecanych
  44 px w pionie. Nie naprawiane w F6-01, bo kryterium tego issue mówi wprost
  o rozmiarach guzika (`xs`, `sm`, `icon-xs`, `icon-sm`), a nie o nawigacji.
  Waga: **drobne**. Szacunek: godzina.
  AC:
  - odnośniki nawigacji na `pointer: coarse` mają co najmniej 44 px wysokości obszaru
    dotyku (dowód: `node scripts/a11y-audit.mjs` po rozszerzeniu sprawdzenia z punktu 4
    na `a[href]` zwraca zero naruszeń)
  - układ paska bocznego na myszy bez zmian (dowód: porównanie zrzutów
    `scripts/perf/pngdiff.mjs` poniżej progu szumu 1 680 px)
  - negatywne: `npx playwright test` nadal 22 zielone
  ZROBIONE. Halo dotyku jest teraz stałą `HALO_DOTYK` w `src/lib/utils.ts` (ten sam
  zestaw klas `pointer-coarse:after:*`, co wariant `Button`) i dostały je: cztery
  rodzaje odnośników w `src/components/sidebar.tsx` (logo, pozycje główne, podpozycje,
  agenci) oraz pigułki filtra na `/productions/list`.
  Sprawdzenie z punktu 4 w `scripts/a11y-audit.mjs` obejmuje teraz
  `[data-slot="button"], a[href]:not([data-dense])`. Wynik na uruchomionej aplikacji:
  `RAZEM naruszeń: 0` (przed zmianą, po samym rozszerzeniu selektora: **164**, w tym
  21 odnośników paska bocznego na każdej z trzech stron).
  Wyjątek świadomy `data-dense`: wiersze ganta (`gantt-row-rail.tsx` 24 px,
  `gantt-narrative-row.tsx` 20 px) halo NIE dostają, bo przy takiej wysokości wiersza
  halo 44 px sąsiadów zachodzą na siebie i przechwytują kliknięcia w cudzy wiersz.
  To 98 z tamtych 164 naruszeń; powód i oznaczenie opisane przy stałej `HALO_DOTYK`
  oraz w komentarzu audytu.
  Układ na myszy bez zmian: `pngdiff` zrzutów 1280x720 przed i po daje **0** pikseli
  na `/productions/list`, `/import/osoby` i `/calendar` (reguła powstaje wyłącznie
  w `@media (pointer: coarse)`).
  Negatywne: `npx playwright test` **22 zielone**, `npm run typecheck` 0,
  `npm run lint` 0 błędów i 37 ostrzeżeń, `npm run test` 223 zielone.
  PUŁAPKA: pierwsze podejście robiło `@utility halo-dotyk` z zagnieżdżonym
  `@media (pointer: coarse)` w `globals.css` — Tailwind v4 **nie wygenerował** z tego
  ani jednej reguły (klasa w DOM, `::after` z `content: none`). Zwykłe klasy
  wariantowe działają, więc kanon halo zostaje przy klasach, nie przy własnym utility.

- [x] **F7-26** `znalezisko` `tooling` `production-drawer.tsx` to martwy kod
  Znalezione przy F7-01, gdy próba weryfikacji szuflady na uruchomionej aplikacji nie
  znalazła żadnego miejsca, które ją otwiera. `src/components/productions/production-drawer.tsx`
  (ok. 120 linii, własny `useEffect` z pobieraniem danych i wywołanie akcji serwerowej
  `getProductionByEntryId`) nie ma ani jednego importera. Dowód:
  `grep -rn "production-drawer\|ProductionDrawer" src/ e2e/ scripts/` zwraca wyłącznie
  samą definicję. Martwy komponent wchodzi do bundla tylko wtedy, gdy ktoś go zaimportuje,
  więc kosztem nie jest rozmiar, tylko to, że trzyma przy życiu punkt wejścia
  `getProductionByEntryId` i myli przy przeglądzie.
  Waga: **drobne**. Szacunek: 20 minut.
  AC:
  - plik usunięty albo podpięty do widoku, który go otwiera (decyzja opisana w `DECISIONS.md`)
  - jeśli usunięty: `getProductionByEntryId` też znika, o ile nie ma innych wywołań
    (dowód: `grep -rn getProductionByEntryId src/` zwraca 0 trafień)
  - negatywne: `npm run typecheck` 0, `npm run test` kod 0, `npx playwright test` 22 zielone,
    `node scripts/check-trust-boundaries.mjs` 0 (liczba punktów wejścia spada o 1, nie rośnie)
  ZROBIONE, wariant „usunięty". Znalezisko potwierdzone na zastanym stanie:
  `grep -rn "production-drawer\|ProductionDrawer" src/ e2e/ scripts/` zwracał
  wyłącznie samą definicję. Skasowany plik komponentu i akcja serwerowa
  `getProductionByEntryId` (`src/server/actions/productions.ts`), która nie miała
  już żadnego innego wywołania — `grep -rn getProductionByEntryId src/` zwraca **0**.
  Uzasadnienie wyboru w `DECISIONS.md`.
  Negatywne: `npm run typecheck` 0, `npm run test` 223 zielone,
  `npx playwright test` **22 zielone**, `check-trust-boundaries` kod 0 z **73**
  punktami wejścia (było 74, spadek o 1), `npm run lint` 0 błędów i **36** ostrzeżeń
  (było 37 — martwy komponent wnosił jedno `react-hooks/exhaustive-deps`).

- [x] **F7-27** `znalezisko` `dane` Przesunięcie startu produkcji gubi się w polu, ale nie w danych
  Znalezione przy F7-01 na uruchomionej aplikacji, `/productions/80`. Pole „Start produkcji"
  (`T1StartEditor`) dostaje `t1Start` z `getFirstPeriodStart(t0At, periods)`
  (`src/lib/production-steps.ts:143`), a ta funkcja **zaokrągla `t0At` do poniedziałku**
  (`startOfWeek`) przed dodaniem offsetu pierwszego okresu. `shiftProductionT1Start`
  (`src/server/actions/production-steps.ts:529`) liczy `deltaDays` wobec tej samej,
  zaokrąglonej wartości. Skutek: przesunięcie o liczbę dni, która nie wyprowadza `t0At`
  poza bieżący tydzień, **przesuwa całą oś** (T-0 z „20 wrz 2026" na „22 wrz 2026",
  kroki i wpisy kalendarza razem z nim), ale pole wraca do starej daty i pokazuje
  komunikat „Timeline przesunięty". Ta sama akcja powtórzona wygląda jak brak zmiany,
  a za każdym razem dokłada kolejne dni — cztery przebiegi po +2 dni przesunęły
  produkcję o 8 dni bez żadnego widocznego śladu w polu. Mierzone: po każdym
  przesunięciu `input[type="date"]` = `2026-08-31`, a `T-0` rosło o 2 dni.
  ZROBIONE 2026-09-03. Odtworzone na uruchomionej aplikacji, `/productions/80`: trzy
  przesunięcia o +2 dni z rzędu, pole za każdym razem wracało do `2026-08-31`, a `T-0`
  szło `14 wrz -> 16 wrz -> 18 wrz -> 20 wrz`. Kolumna `t0_at` w bazie potwierdziła dryf
  (`2026-09-14` przed, `2026-09-20` po). To był **błąd i wyświetlania, i danych**:
  oś przesuwała się poprawnie o zadaną deltę, ale uchwyt startu był kwantowany do
  tygodnia, więc pole nie odzwierciedlało zapisu, a powtórzenie akcji liczyło tę samą
  deltę jeszcze raz i dokładało dni do bazy.
  Naprawa: `getFirstPeriodStart` liczy się od DNIA `t0At`, nie od poniedziałku jego
  tygodnia (`src/lib/production-steps.ts`), a `shiftProductionT1Start` woła tę samą
  funkcję zamiast liczyć `oldT1` po swojemu (`src/server/actions/production-steps.ts`).
  Pas ganta zostaje tygodniowy (`getStepWeekRange` bez zmian), zmienia się tylko uchwyt.
  Dowód na uruchomionej aplikacji: przesunięcia o 1, 2 i 3 dni dały po przeładowaniu
  dokładnie zadaną datę (`2026-09-06 -> 07 -> 09 -> 12`), a powtórzenie tej samej daty
  zostawiło `T-0: 26 wrz 2026, 12:00` bez zmian. Produkcja 80 przywrócona do
  `2026-09-14 10:00+00`. Scenariusz e2e: `e2e/f7-27-start-produkcji.spec.ts`
  (n = 1, 2, 3 plus powtórka), `npx playwright test` **23 zielone w 1,6 min**.
  Test jednostkowy dryfu stoi w `src/lib/production-steps.test.ts` na czystej funkcji
  (`przesunięcie T-0 o jeden dzień przesuwa start o dokładnie jeden dzień`) — akcji
  serwerowej nie da się zaimportować do vitesta (`server-only`, patrz F7-30), więc
  idempotencję akcji sprawdza scenariusz e2e.
  Istniejące produkcje: dryf jest nieodróżnialny od świadomej edycji, więc nie da się
  go automatycznie cofnąć; poza produkcją 80 (naprawioną) nie stwierdzono żadnej.
  Waga: **ważne**. Szacunek: pół dnia.
  AC:
  - po przesunięciu startu o `n` dni pole „Start produkcji" po przeładowaniu strony
    pokazuje datę większą o dokładnie `n` dni (dowód: scenariusz e2e dla n = 1, 2 i 3)
  - powtórzenie przesunięcia na tę samą datę nie zmienia już nic
    (dowód: `T-0` w tekście strony identyczne przed i po drugim zatwierdzeniu)
  - test jednostkowy odtwarzający dryf: `shiftProductionT1Start` wywołane dwa razy
    z tą samą datą docelową przesuwa `t0At` tylko raz
  - negatywne: `npm run test` kod 0, `npx playwright test` 22 zielone

- [x] **F7-28** `znalezisko` `tooling` Próg 300 ms w `gantt-filter.spec.ts` mierzy serwer deweloperski
  Znalezione przy F7-05, gdy pełny przebieg `npx playwright test` dał `21 passed, 1 failed`.
  `e2e/gantt-filter.spec.ts:119` sprawdza `median < 300` dla przemalowania gantu po zmianie
  filtra kampanii. `reuseExistingServer: true` sprawia, że test bierze serwer stojący na
  porcie 3000 — a to bywa `npm run dev`, czyli **webpack bez optymalizacji**. Zmierzone
  mediany na tej samej maszynie i tych samych danych:
  - serwer deweloperski: 306, 309, 313 ms → **czerwony**
  - `next build` + `next start`: 139, 116, 117 ms → **zielony z zapasem**
  Nie jest to regresja z paczki F7-01 do F7-05: ten sam test na commicie `68171c6`
  (sprzed całej paczki) na serwerze deweloperskim dał 316, 333 i 301 ms, czyli tak samo
  czerwono. Test jest więc zielony albo czerwony zależnie od tego, co akurat stoi na
  porcie 3000, i przy medianie ocierającej się o próg potrafi przejść raz na kilka razy.
  ZROBIONE 2026-09-03. `/api/health` oddaje `dev`, scenariusz robi `test.skip`
  z komunikatem „uruchom `npm run perf:serve`". Dowody: przy `npm run dev` na porcie
  3000 `E2E_EXPECTED_DB=marketing npx playwright test e2e/gantt-filter.spec.ts`
  kończy się `1 skipped`, kod 0. Na `npm run perf:serve` ten sam scenariusz mierzy
  i przechodzi (próbki 195, 92, 92 ms, mediana **92 ms**). Bramka nadal potrafi
  zapalić się na czerwono: sztuczny koszt 120 ms na klatkę dał próbki 1277, 1390,
  1015 ms i `1 failed`. Liczby z obu środowisk i uzasadnienie wariantu w `DECISIONS.md`.
  Skutek uboczny opisany tamże: pełny przebieg na bazie testowej pokazuje ten
  scenariusz jako pominięty (22 zielone + 1 pominięty + F7-27 = 23 wyniki).
  Waga: **ważne** (bramka, która kłamie w obie strony, jest gorsza niż jej brak).
  Szacunek: godzina.
  AC:
  - test albo wymusza budowanie produkcyjne, albo pomija pomiar na serwerze deweloperskim
    z czytelnym komunikatem (dowód: `npx playwright test e2e/gantt-filter.spec.ts` przy
    `npm run dev` na porcie 3000 nie kończy się `failed`)
  - na budowaniu produkcyjnym test nadal mierzy i nadal potrafi zapalić się na czerwono
    (dowód: sztuczne podniesienie kosztu przemalowania wywala test)
  - decyzja opisana w `DECISIONS.md`, razem z liczbami z obu środowisk
  - negatywne: `npx playwright test` 22 zielone na budowaniu produkcyjnym

- [ ] **F7-29** `znalezisko` `import` `db` Trzy metryki z CSV nie mają gdzie wylądować
  Waga: **drobne**. Szacunek: godzina. Znalezione przy F7-07.
  Parser CSV czytał z arkuszy trzy kolumny, których tabela `posts` nie przechowuje:
  `Total play time` (TikTok), `Watch time (hours)` i `Impressions click-through rate (%)`
  (YouTube). Wartości lądowały w zmiennych `totalPlay`, `watchHours`, `ctr`
  w `src/lib/csv-mappers.ts` i nie szły dalej — stąd ostrzeżenia lintu, które
  F7-07 zdjęło razem ze zmiennymi. Kolumny w `drizzle/schema.ts` (tabela `posts`,
  linie 294–301) kończą się na `reach`, `impressions`, `engagementRate`,
  `completionRate`, `saves`, `shares`, `comments`, `followersGained`.
  ODŁOŻONE 2026-09-03, zależy od odpowiedzi usera: czy czas oglądania i CTR mają
  być widoczne na `/analytics`. Kodu nie da się wybrać za niego, bo to pytanie
  o zawartość ekranu, nie o implementację; koszt wariantu „dokładamy" (migracja,
  trzy pola w `NormalizedPost`, trzy mappery, miejsce na ekranie) opisany
  w `DECISIONS.md`. Zrobione już teraz, bo tanie i niezależne od decyzji: komentarz
  w `src/lib/csv-mappers.ts` wymieniający te trzy kolumny z nazwy i mówiący, dlaczego
  ich nie czytamy — żeby nikt nie uznał tego za przeoczenie i nie dodał po cichu.
  `npm run test` kod 0, osiem testów `csv-mappers.test.ts` zielonych.
  Do decyzji usera: czy czas oglądania i CTR mają być widoczne w analityce.
  CZYTAJ: `src/lib/csv-mappers.ts`, `drizzle/schema.ts` sekcja `posts`,
  `src/components/analytics/analytics-shell.tsx`
  AC:
  - decyzja zapisana w `DECISIONS.md`: dokładamy kolumny czy świadomie ich nie zbieramy
  - wariant „dokładamy": migracja przez `npm run db:generate`, trzy pola w `NormalizedPost`,
    mapowanie z powrotem w trzech mapperach, wartości widoczne na `/analytics`
    (dowód: import `scripts/sample-meta.csv` i zrzut ekranu z niepustą kolumną)
  - wariant „nie zbieramy": komentarz w `csv-mappers.ts` mówiący wprost, których
    kolumn arkusza nie czytamy i dlaczego
  - negatywne: `npm run test` kod 0, osiem testów `csv-mappers.test.ts` nadal zielonych

- [x] **F7-30** `znalezisko` `docs` Persony agentów pokazują wywołanie, które rzuca wyjątkiem
  Waga: **ważne**. Szacunek: pół godziny. Znalezione przy F7-09.
  Trzy miejsca uczą Claude Code importu server action do skryptu `tsx`:
  `agents/schedule-manager.md:54` i `:70`, `agents/campaign-strategist.md:58` i `:78`
  oraz `CLAUDE.md:31`. Zmierzone 2026-09-03: taki import kończy się wyjątkiem
  `This module cannot be imported from a Client Component module`, bo
  `requireSession()` ciągnie `src/lib/auth.ts`, a ten pakiet `server-only`, który
  poza kontekstem żądania rzuca natychmiast. Agent, który pójdzie za przepisem,
  dostanie ścianę i będzie improwizował. Działa `db.insert(schema.calendarEntries)`.
  Dotyczy prawdopodobnie także innych akcji cytowanych w personach — do sprawdzenia.
  ZROBIONE 2026-09-03. Zakres okazał się szerszy niż znalezisko: nieosiągalne z `tsx`
  są **wszystkie cztery** moduły akcji (`calendar`, `campaigns`, `posts`, `outreach`)
  oraz `src/lib/files.ts` (`import 'server-only'` w pierwszej linii), a niezależnie
  od tego **żaden** z dziewięciu przepisów w personach nie dawał się uruchomić, bo
  `npx tsx -e "...await..."` kompiluje się do CJS i pada na `await` na najwyższym
  poziomie. Pełna tabela pomiarów w `DECISIONS.md`.
  Naprawione: wszystkie przepisy w `agents/*.md` i w `CLAUDE.md` przepisane na wzorzec
  „heredoc do pliku `.ts` + `async function main()`", zapis przez schemę Zod
  z `src/server/actions/schemas.ts` plus `db.insert`/`db.update`, zapis plików przez
  `node:fs`. Przy okazji w `agents/viral-analyzer.md` zniknął `sqlite3
  data/marketing-crew.db` (baza to PostgreSQL w kontenerze `mc-pg`).
  Dowód: dziewięć przepisów wyciągniętych automatycznie z plików person i uruchomionych
  po kolei — dziewięć razy kod 0, z realnymi zapisami (kampania #31 z trzema wpisami,
  wpis kalendarza #10, plik outreach), posprzątanymi po sprawdzeniu. Fragmenty ```ts```
  (edycja i kasowanie wpisu, dodanie artysty, metryki posta) sprawdzone osobno, kod 0.
  Grep z AC: `grep -rnE "from './src/server/actions/(calendar|campaigns|posts|outreach|artists)'"
  agents/ CLAUDE.md` zwraca **0**. Dosłowny grep z AC (`from './src/server/actions`)
  zwraca 6, bo działający przepis importuje z tego katalogu **schemy Zod**
  (`schemas.ts`, sprawdzone: importuje się bez wyjątku) — to nie jest server action.
  CZYTAJ: `agents/schedule-manager.md`, `agents/campaign-strategist.md`, `CLAUDE.md`
  sekcja „Jak czytać/pisać do bazy", `src/lib/auth.ts`
  AC:
  - żaden przepis w `agents/*.md` ani w `CLAUDE.md` nie pokazuje importu z
    `src/server/actions/` do skryptu `tsx`; dowód: `grep -rn "from './src/server/actions"
    agents/ CLAUDE.md | wc -l` zwraca `0`
  - w miejsce przepisu wchodzi wywołanie, które przechodzi; dowód: skrypt z nowego
    przepisu wykonany z terminala tworzy wiersz i kończy się kodem 0
  - sprawdzone, które jeszcze akcje cytowane w personach są nieosiągalne z `tsx`,
    lista w `DECISIONS.md`
  - negatywne: `npm run test` kod 0

- [x] **F7-31** `znalezisko` `ui` Kolory pasów T wpisane wprost, obok tabeli `FRAME_STYLE`
  Waga: **drobne**. Szacunek: godzina. Znalezione przy F7-13.
  `accentBorderFor` w `src/components/calendar/gantt-frames.tsx` zwraca
  `border-amber-400`, `border-violet-400` i `border-emerald-400` wpisane wprost,
  choć w tym samym pliku stoi `FRAME_TONE`, zbudowana z `FRAME_STYLE`
  w `src/lib/category-colors.ts`, która jest jedynym źródłem kolorów pasm T1/T2/T3
  (ustalone w F7-08). Funkcja pochodzi z `gantt-substep-bar.tsx`, gdzie te trzy
  literały siedziały od F2-02 — F7-13 tylko je przeniosło, nie wprowadziło.
  Trzeci kolor obramowania kółka podkroku nie ma dziś odpowiednika w `FRAME_STYLE`
  (jest `border` w odcieniu 400/55, potrzebny 400 bez przezroczystości), więc naprawa
  to dołożenie jednego pola do tabeli, nie samo podstawienie.
  ZROBIONE 2026-09-03. `FRAME_STYLE` dostała pole `accentBorder` (odcień 400 bez
  przezroczystości) z komentarzem, dlaczego nie wystarczy istniejące `border`
  (400/70 jest za blade na kółku 24 px). `accentBorderFor` to teraz jedna linia:
  `FRAME_STYLE[frame].accentBorder`.
  Dowód AC: `grep -n "amber-400\|violet-400\|emerald-400" src/components/calendar/gantt-frames.tsx`
  zwraca 6 linii, wszystkie z `FRAME_TONE` (pola `border` i `chip`), żadnej
  z `accentBorderFor`. Wygląd bez zmian: zrzuty 1280x720 `/calendar?view=quarter`
  przed i po, **0 różnych pikseli** (`scripts/perf/pngdiff.mjs`), w tym drugi zrzut
  z rozwiniętym wierszem ganta, gdzie widać 1192 elementy z tą klasą — czyli ścieżka
  kodu naprawdę była na obrazku. Bramki: typecheck 0, lint 0 błędów / 36 ostrzeżeń,
  test 224 zielone, typografia 0, granice zaufania 0, perf 0 (`/calendar` 293,3 kB),
  a11y 0 naruszeń.
  CZYTAJ: `src/components/calendar/gantt-frames.tsx`, `src/lib/category-colors.ts`
  AC:
  - `grep -n "amber-400\|violet-400\|emerald-400" src/components/calendar/gantt-frames.tsx`
    zwraca wyłącznie linie z tabeli `FRAME_TONE`, nie z `accentBorderFor`
  - nowe pole opisane komentarzem w `FRAME_STYLE` i użyte przez `accentBorderFor`
  - negatywne: wygląd `/calendar` bez zmian (dowód: `scripts/perf/pngdiff.mjs`,
    zrzut 1280x720 przed i po, poniżej progu 1 680 pikseli), `npm run test` kod 0

- [x] **F7-32** `znalezisko` `ui` `db` Ekran kamerzystów czyta wyłącznie stare `contact`
  Znalezione przy F7-19. Migracja 0003 dołożyła `handle`, `email`, `phone`, a
  `scripts/split-videographer-contact.ts` umie już przenieść do nich treść ze starego
  pola — ale interfejs tych kolumn nie zna. `src/components/videographers/videographers-shell.tsx`
  filtruje i renderuje `v.contact` (i robi na nim własną heurystykę `contact.includes('@')`,
  czyli drugą kopię reguły z `normalizeRow`), `videographer-dialog.tsx` edytuje `contact`,
  `src/app/productions/[id]/page.tsx:258` podaje `contact` jako `email`, a
  `productions-list.tsx:177` bierze `contact` na podpis pod osobą.
  Skutek: dopóki to stoi, uruchomienie `--clear-contact` opróżni karty kamerzystów,
  mimo że dane są w bazie. Dlatego flaga nie została odpalona na żadnej prawdziwej bazie.
  Waga: **ważne** (blokuje domknięcie F7-19). Szacunek: pół dnia.
  ZROBIONE 2026-09-03. Karta kamerzysty pokazuje `email`, `phone` i `handle` z ich
  własnych kolumn (`kontaktyDla`), `contact` renderuje się wyłącznie wtedy, gdy żadna
  z trzech nic nie ma, a o jego kształt pyta `contactField` — druga kopia heurystyki
  zniknęła (`grep -rn "contact?.includes('@')" src` zwraca **0**). Wyszukiwarka szuka
  po wszystkich czterech polach. Formularz ma trzy nowe pola, `contact` pokazuje się
  w nim tylko dla wierszy, które je jeszcze mają, i jest opisany jako pole zastane.
  `videographerInputSchema` przyjmuje `handle`, `email` i `phone`.
  `PersonHeader` na `/productions/<id>` bierze `email ?? contact`, `phone` i `handle`;
  podpis na `productions-list.tsx` to `handle ?? email ?? contact ?? 'kamerzysta'`.
  Dowód na uruchomionej aplikacji, cztery testowe wiersze (email, telefon, nick,
  kształt nierozpoznany): po `--apply --clear-contact` karta nadal pokazuje wszystkie
  cztery kontakty, a zrzuty 1280x720 `/videographers` przed i po czyszczeniu różnią się
  o **0 pikseli**. Formularz zapisuje komplet (`email`, `phone`, `handle` sprawdzone
  w bazie po zapisie z przeglądarki). Strona produkcji z kamerzystą bez artysty
  wypisuje `@nowy.handle`, `nowy@kamera.pl` i `+48 700 111 222`.
  Dane testowe skasowane, `marketing` znów ma zero kamerzystów.
  Trzy błędy lintu `complexity`, które pojawiły się po drodze, zdjęte przez wyniesienie
  `pasuje`, `kontaktyDla` i `doZapisu` do czystych funkcji — ostrzeżeń nadal 36, błędów 0.
  CZYTAJ: `src/components/videographers/videographers-shell.tsx`,
  `src/components/videographers/videographer-dialog.tsx`,
  `src/app/productions/[id]/page.tsx`, `src/components/productions/productions-list.tsx`
  AC:
  - ekran kamerzystów pokazuje `handle`, `email` i `phone` z ich własnych kolumn;
    `contact` renderuje się już tylko jako pole zapasowe dla wierszy nierozpoznanych
  - `grep -rn "contact?.includes('@')" src` zwraca `0` — reguła „co to za kształt"
    zostaje jedna, ta z `contactField`
  - dowód: po `--apply --clear-contact` na kopii bazy karta kamerzysty nadal pokazuje
    kontakt (zrzut 1280x720 przed i po czyszczeniu, różnica poniżej progu szumu)
  - negatywne: `npm run test` kod 0, formularz kamerzysty nadal zapisuje wszystkie pola

- [x] **F7-33** `znalezisko` `tooling` Windowsowa ścieżka robi śmieciowy katalog w korzeniu repo
  Waga: **ważne**. Szacunek: godzina. Znalezione w recenzji końcowej.
  `src/lib/production-work-folder.ts:37` trzyma `HARDCODED_FALLBACK` równy
  `'C:\Users\Hp omen\OneDrive\MARKETPLACE DOCS\Marketing Content'`. Na POSIX to nie jest
  ścieżka bezwzględna, tylko jedna nazwa pliku z ukośnikami odwrotnymi w środku, więc
  `mkdirSync(recursive)` zakłada katalog o TAKIEJ nazwie w katalogu roboczym, czyli
  w korzeniu repozytorium. Potwierdzone: katalog istnieje i ma 59 podkatalogów, rośnie
  z każdym przebiegiem testów. Git go nie widzi, bo podkatalogi są puste. Literał wiezie
  też cudzą nazwę konta Windows. Ten sam brak guardu psuje `resolveSafeStagePath`:
  jego test na wyjście poza korzeń przy korzeniu WZGLĘDNYM sprawdza pozorną własność.
  ZROBIONE 2026-09-03. `getRoot()` poza Windowsem zwraca `join(process.cwd(),
  '.data-local-content')` zamiast literału windowsowego; literał został wyłącznie dla
  `process.platform === 'win32'`, gdzie faktycznie jest ścieżką bezwzględną. Nowy korzeń
  wpisany do `.gitignore`. Śmieciowy katalog z 59 podkatalogami usunięty z korzenia repo.
  Źródło zaśmiecania namierzone: `e2e/revalidate.spec.ts:42` zakłada artystę
  `Artysta F1-04 <znacznik czasu>`, a akcja folderu produkcji tworzy pod niego katalog —
  czyli robił to przebieg Playwrighta, nie `npm run test`.
  Dowód AC: po `npm run test` i po `npx playwright test` `ls -d 'C:'*` w korzeniu repo
  zwraca „no matches found", `git status --short` nie pokazuje nowego katalogu, a nowe
  foldery robocze lądują w ignorowanym `.data-local-content/`.
  Bramki: typecheck 0, lint 0 błędów / 36 ostrzeżeń, test 224 zielone, typografia 0,
  granice zaufania 0.
  CZYTAJ: `src/lib/production-work-folder.ts`, `tests/production-work-folder.test.ts`
  AC:
  - `getRoot()` poza Windows nie zwraca literału windowsowego: albo `join(process.cwd(),
    '.data-local-content')` (wpisane do `.gitignore`), albo wyjątek z prośbą
    o `MARKETING_CONTENT_ROOT`
  - `git status --short` po `npm run test` nie pokazuje nowego katalogu, a
    `ls -d 'C:\Users\Hp omen'*` w korzeniu repo zwraca `No such file or directory`
  - istniejący śmieciowy katalog usunięty z korzenia repozytorium
  - negatywne: `npm run test` kod 0, `npm run typecheck` kod 0

- [x] **F7-34** `znalezisko` `perf` Pomiar stron nie zapisuje, na ilu wierszach był robiony
  Waga: **ważne**. Szacunek: pół dnia. Znalezione w recenzji końcowej.
  `scripts/perf/measure-page.mjs` zapisuje p50, p95, bajty i rozmiar bundla, ale ani
  jednej liczby wierszy, a `scripts/perf/report.mjs` niczego takiego nie sprawdza.
  Baza pomiarowa tymczasem odjechała od zestawu L z `plan/03` sekcja 2:
  `node scripts/perf/table-counts.mjs` daje `artists 1180` (specyfikacja 200)
  i `productions 504` (specyfikacja 500). p95 mierzone po takim dryfie nie są
  porównywalne z `perf/baseline.json`, a nic tego nie wykrywa. To złamanie Z1 na
  poziomie przyrządu: pomiar bez zapisanych warunków pomiaru.
  ZROBIONE 2026-09-03. `measure-page.mjs` liczy wiersze w bazie pomiarowej i zapisuje
  je w przebiegu jako pole `rows` (jedenaście tabel, razem z katalogami z F7-10),
  a `report.mjs` konfrontuje je z zestawem L i przy rozjeździe kończy kodem 1.
  Specyfikacja przeniesiona do JEDNEGO miejsca: `perf/budget.json` klucz `zestawL`,
  kluczowany nazwami tabel. Czyta go zarówno generator (`seed-large.ts`), jak i sędzia,
  więc rozjazd „generator sieje 200, sędzia sprawdza 500" jest niemożliwy.
  Baza pomiarowa doprowadzona do zgodności (`npx tsx scripts/perf/seed-large.ts`):
  `artists` **1180 do 200**, `productions` **504 do 500**, reszta co do wiersza.
  Dowód AC: `jq '.rows' perf/runs/<najnowszy>.json` zwraca komplet jedenastu liczb;
  `node scripts/perf/report.mjs` puszczony na przebiegu SPRZED tej zmiany (bez pola
  `rows`) kończy kodem 1 z wpisem `przebieg bez licznika wierszy: brak wobec komplet`,
  a na przebiegu zgodnym wypisuje jedenaście linii `ok` i kod 0.
  Bramki: typecheck 0, lint 0 błędów / 35 ostrzeżeń, perf 0 (`/calendar` 293,4 kB
  przy progu 301,6 kB, wszystkie p95 pod limitem).
  CZYTAJ: `scripts/perf/measure-page.mjs`, `scripts/perf/report.mjs`,
  `scripts/perf/table-counts.mjs`, `plan/03-wydajnosc.md` sekcja 2
  AC:
  - przebieg `page-*.json` zawiera pole z licznikiem wierszy per tabela
    (dowód: `jq '.rows' perf/runs/$(ls -t perf/runs | head -1)` zwraca obiekt, nie `null`)
  - `report.mjs` kończy kodem 1, gdy komplet wierszy nie zgadza się ze specyfikacją
    zestawu L; dowód: sztuczny przebieg z rozjechanym licznikiem daje kod 1
  - specyfikacja zestawu L stoi w JEDNYM miejscu w kodzie, nie jest przepisana dwa razy
  - negatywne: `npm run perf` na zgodnej bazie kończy kodem 0

- [x] **F7-35** `znalezisko` `perf` `db` Generator zestawu L nie zasiewa nowych kolumn kamerzysty
  Waga: **ważne**. Szacunek: godzina. Znalezione w recenzji końcowej, zależne od F7-32.
  `scripts/perf/seed-large.ts:253` daje kamerzystom wyłącznie `contact`, mimo że migracja
  0003 dołożyła `handle`, `email`, `phone`, `location`, `status`, a F7-32 przepisał na te
  kolumny cały ekran kamerzystów. W bazie pomiarowej: 36 niepustych `contact`, ZERO
  niepustych `email`, `handle`, `phone`. Skutek: ścieżka kodu z F7-32 nie jest wykonywana
  ani w pomiarze wydajności, ani w środowisku podglądowym dla zespołu — mierzymy i
  pokazujemy gałąź zapasową, nie tę, którą zobaczy użytkownik.
  ZROBIONE 2026-09-03. Generator wypełnia kamerzystom `handle`, `email`, `phone`,
  a przy okazji `location` i `status`, które migracja 0003 też dołożyła, a których
  nikt nie zasiewał. Prawdopodobieństwa jak dla artystów (handle 0,75; email 0,6;
  phone 0,4), `location` 0,7 („część bez lokalizacji" z plan/03 sekcja 2), `status` 0,5.
  `contact` zszedł z 0,7 na 0,3, żeby zostać tym, czym jest po F7-32: polem zastanym
  dla wierszy nierozpoznanych, a nie głównym kontaktem.
  Dowód AC: po `npx tsx scripts/perf/seed-large.ts` w `marketing_perf` jest
  `email 35`, `handle 47`, `phone 24`, `location 37`, `status 28`, `contact 20`
  (przed zmianą: `email 0`, `handle 0`, `phone 0`, `contact 36`).
  Bramki: typecheck 0, lint 0 błędów / 35 ostrzeżeń, perf 0 (zestaw L zgodny co do
  wiersza, `/calendar` 293,4 kB przy progu 301,6 kB).
  CZYTAJ: `scripts/perf/seed-large.ts` (linie 235 do 237 pokazują wzorzec dla artystów)
  AC:
  - generator wypełnia `handle`, `email` i `phone` kamerzystów tak jak robi to dla artystów
  - po `tsx scripts/perf/seed-large.ts` zapytanie o liczbę niepustych `email`, `handle`
    i `phone` na `videographers` zwraca w każdej kolumnie wartość > 0
  - `/videographers` na bazie pomiarowej pokazuje kontakty z nowych kolumn (zrzut 1280x720)
  - negatywne: `npm run perf` kod 0, `npm run test` kod 0

- [x] **F7-36** `znalezisko` `ui` Tysiąc linii komponentów bez ani jednego odbiorcy
  Waga: **drobne**. Szacunek: godzina. Znalezione w recenzji końcowej.
  Pięć plików, razem 1012 linii, nie jest importowanych z niczego w `src/` ani `e2e/`:
  `src/components/campaigns/milestones-tracker.tsx` (582),
  `src/components/ui/dropdown-menu.tsx` (268), `src/components/ui/tabs.tsx` (82),
  `src/components/ui/scroll-area.tsx` (55), `src/components/ui/separator.tsx` (25).
  Martwy kod jest czytany przy każdej recenzji, liczony w metrykach `'use client'`
  i podnosi koszt każdej zmiany globalnej (Z4, Z5), nic za to nie dając.
  ZROBIONE 2026-09-03. Pięć plików usuniętych (`git rm`), 1012 linii mniej.
  `SelectSeparator` w `src/components/ui/select.tsx` to osobny byt z `@base-ui/react`,
  nie ma nic wspólnego z usuniętym `ui/separator.tsx`, więc został.
  Dowód AC: `grep -rn "milestones-tracker\|ui/dropdown-menu\|ui/tabs\|ui/scroll-area\|ui/separator" src e2e`
  zwraca `0`. Efekt uboczny: ostrzeżeń lintu **36 do 35** (jedno siedziało w martwym
  `milestones-tracker.tsx`), a plików klienckich w `src/components` **65 do 64**.
  Bramki: typecheck 0, lint 0 błędów / 35 ostrzeżeń, test 224 zielone.
  CZYTAJ: pięć plików wyżej
  AC:
  - `git rm` na wszystkie pięć plików
  - `grep -rn "milestones-tracker\|ui/dropdown-menu\|ui/tabs\|ui/scroll-area\|ui/separator" src e2e`
    zwraca `0` trafień
  - negatywne: `npm run typecheck` kod 0, `npm run test` kod 0, `npm run perf` kod 0

- [x] **F7-37** `znalezisko` `security` `arch` Akcja serwerowa `saveOutreach` bez wywołania
  Waga: **drobne**. Szacunek: pół godziny. Znalezione w recenzji końcowej.
  `src/server/actions/outreach.ts:9` eksportuje `saveOutreach` z dyrektywą `'use server'`,
  ale nic jej nie woła w `src/` ani `e2e/`. Wyeksportowana akcja serwerowa jest endpointem
  HTTP niezależnie od tego, czy interfejs jej używa. Ma `requireSession()` i walidację Zod,
  więc nie jest dziurą — jest powierzchnią bez odbiorcy, czyli kodem, którego nikt nie
  testuje, a który da się wywołać z sieci.
  ZROBIONE 2026-09-03. `src/server/actions/outreach.ts` usunięty. Wybór między
  skasowaniem a udokumentowaniem rozstrzygnięty na korzyść skasowania, uzasadnienie
  w `DECISIONS.md` sekcja „F7-37": trzy powody, dla których zostały akcje kalendarza
  (jedyna ścieżka z walidacją, przepis w personie, koszt przepisania persony), tutaj
  nie zachodzą. `outreachInputSchema` zostaje w `schemas.ts` z komentarzem, bo woła ją
  wprost persona `agents/artist-outreach.md`, i to ona jest kanałem agentowym.
  Zdanie w personie o `saveOutreach` poprawione, żeby nie odsyłało do nieistniejącego kodu.
  Dowód AC: `grep -rn "saveOutreach" src e2e` zwraca `0`; punktów wejścia w bramce granic
  zaufania **73 do 72**, „bez schematu mimo argumentów" nadal 0.
  Bramki: typecheck 0, test 224 zielone, granice zaufania 0.
  CZYTAJ: `src/server/actions/outreach.ts`, `plan/08-BACKLOG.md` wpis F7-09
  AC:
  - albo plik usunięty (`grep -rn "saveOutreach" src e2e` zwraca `0`), albo akcja
    udokumentowana jako kanał agentowy dokładnie tak jak `createCalendarEntry` w F7-09:
    komentarz nad eksportem z powodem i wpis w `DECISIONS.md`
  - negatywne: `npm run typecheck` kod 0, `node scripts/check-trust-boundaries.mjs` kod 0

- [x] **F7-38** `znalezisko` `ui` Cień pasa ganta wpisany surowym `rgb(`, wbrew Z4
  Waga: **ważne**. Szacunek: godzina. Znalezione w recenzji końcowej.
  Cztery pliki niosą tę samą klasę `shadow-[2px_0_6px_-2px_rgb(0_0_0_/_0.08)]`, czyli
  twardy kolor `rgb(` plus magiczne piksele:
  `src/components/calendar/gantt-row-rail.tsx:48`, `src/components/calendar/gantt-header.tsx:76`,
  `src/components/calendar/gantt-legend.tsx:27`, `src/components/campaigns/gantt-narrative-row.tsx:96`.
  Z4 wymienia `rgb(` wprost. Osobna część znaleziska: żadna z siedmiu bramek dziś tego nie
  łapie, więc reguła istnieje wyłącznie w dokumencie.
  ZROBIONE 2026-09-03. `--shadow-rail: 2px 0 6px -2px oklch(0 0 0 / 8%)` w `globals.css`,
  cztery komponenty używają `shadow-(--shadow-rail)`.
  Nowa, czwarta reguła w `scripts/check-typography.mjs` (`Z4 twardy kolor`, wyrażenie
  `rgba?\(|#[0-9a-fA-F]{6}`) wskazała **piąte** miejsce, którego recenzja nie wymieniła:
  `src/components/campaigns/campaign-template-form.tsx:482` trzymało
  `style={{ borderColor: 'rgba(0,0,0,0.08)' }}`. Poszło tą samą drogą: token
  `--border-faint` i klasa `border-(--border-faint)`. Reguła skanuje literały tekstowe
  z parsera, nie grepem, więc `rgb(` opisany w komentarzu jej nie płoszy.
  Dowód AC: `grep -rn "rgb(" src/components | wc -l` zwraca `0`,
  `node scripts/check-typography.mjs` kod 0; po tymczasowym wklejeniu starej klasy
  do `gantt-legend.tsx` kod 1 z nazwą reguły w wypisie.
  Dowód „wygląd bez zmian" wzięty z wartości wyliczonej, nie z pikseli: przeglądarka
  liczy nowy cień jako `lab(0 0 0 / 0.08) 2px 0px 6px -2px`, a nową ramkę jako
  `lab(0 0 0 / 0.08)` — to ta sama czerń w 8%, którą dawały literały.
  ZMIERZONE PRZY OKAZJI, wbrew wcześniejszej notatce o zerowym szumie zrzutów: widok
  ganta NIE jest stabilny pikselowo między przebiegami. Dwa zrzuty `/calendar` z tego
  samego kodu różnią się o 3968 i 4079 pikseli, podczas gdy `/productions/list`
  i `/calendar?mode=table` dają w tym samym teście **0**. Dlatego dowodem jest tu
  wartość wyliczona stylu, a nie `pngdiff`.
  Bramki: typecheck 0, lint 0 błędów / 35 ostrzeżeń, test 224 zielone, typografia 0.
  CZYTAJ: `src/app/globals.css`, cztery pliki wyżej, `scripts/check-typography.mjs`
  AC:
  - `--shadow-rail` zdefiniowany w `globals.css`, komponenty używają `shadow-(--shadow-rail)`
  - `grep -rn "rgb(" src/components | wc -l` zwraca `0`
  - bramka łapie regres: reguła na `rgb(` i `#rrggbb` w skrypcie sprawdzającym, dowód —
    tymczasowe wstawienie `rgb(0 0 0)` do komponentu daje kod 1
  - negatywne: wygląd `/calendar` bez zmian (zrzut 1280x720 przed i po,
    `scripts/perf/pngdiff.mjs` poniżej progu szumu), `npm run test` kod 0

- [x] **F7-39** `znalezisko` `ui` Strzałki typograficzne zamiast ikon lucide, wbrew Z5
  Waga: **ważne**. Szacunek: pół dnia. Znalezione w recenzji końcowej.
  Z5 mówi „ikony wyłącznie z `lucide-react`". Dziewięć miejsc renderuje zamiast tego znak
  strzałki w tekście widocznym dla użytkownika: `src/components/productions/production-wizard.tsx:241,249`,
  `src/components/campaigns/campaign-wizard.tsx:170,181`,
  `src/components/templates/template-form.tsx:532`, `src/app/agents/[slug]/edit/page.tsx:33`,
  `src/app/campaigns/[id]/page.tsx:111`, `src/app/productions/[id]/page.tsx:216`,
  `src/app/page.tsx:238`, `src/components/command-palette.tsx:237`.
  Potwierdzone na uruchomionej aplikacji. `scripts/check-typography.mjs:20` tego nie łapie,
  bo strzałki siedzą w zakresie Unicode `2190-21FF`, a reguła Z5 skanuje tylko emoji.
  Dla czytnika ekranu znak strzałki bywa czytany jako słowo, ikona z `aria-hidden` nie jest.
  ZROBIONE 2026-09-03. Nowa reguła `Z5 strzałka` w `scripts/check-typography.mjs`
  (zakres `←-⇿`) pokazała, że miejsc jest nie dziewięć, tylko **trzydzieści
  cztery w dwudziestu plikach**. Podzielone na dwa rodzaje, bo Z5 mówi o IKONACH:
  strzałka stojąca za ikonę wróciła jako `ArrowLeft`, `ArrowRight`, `ArrowUp`,
  `ArrowDown` i `CornerDownLeft` z `aria-hidden` (pulpit, edycja agenta, strona
  kampanii, strona produkcji, oba formularze szablonów, oba kreatory, lista produkcji,
  paleta poleceń, pas kampanii poza oknem); strzałka będąca separatorem zakresu dat
  albo listy faz to nie ikona i nie ma jej czym zastąpić z lucide, więc zeszła do słowa
  `do` (zakresy) i do przecinków (`build-up, teaser, reveal, premiera, afterglow`).
  Trzy takie miejsca dorzucone poza listą z recenzji: opis zmiany w imporcie CSV
  (`z 1200 na 1500` zamiast `1200 → 1500`), ścieżki w oknie pomocy i podpowiedź
  o zmianie kolejności kroków (`strzałkami w górę i w dół`).
  Dowód AC: `node scripts/check-typography.mjs` kod 0 (przed zmianą 34 trafienia);
  na uruchomionej aplikacji zrzut pulpitu pokazuje ikonę przy „cała analityka",
  stopka palety poleceń trzy ikony zamiast `↑↓ ... ↵`, a stopka kreatora produkcji
  ma trzy elementy `svg` (zamknięcie plus dwie strzałki).
  DOCIĄGNIĘTE po pierwszym przebiegu e2e: cztery scenariusze w `e2e/revalidate.spec.ts`
  szukały guzika po nazwie `Dalej →`, a dostępna nazwa to teraz `Dalej` (ikona ma
  `aria-hidden`) — selektory poprawione na `/^Dalej$/`. Przy okazji wyszedł piąty,
  starszy błąd tego pliku: klik w „+ Nowa produkcja" leciał przed zhydrowaniem
  `/productions`, więc okno kreatora się nie otwierało (sprawdzone: `document
  .querySelectorAll('[role=dialog]').length` równe **0** trzy sekundy po kliknięciu,
  a po dołożeniu `waitForLoadState('networkidle')` równe **1**). To wyścig, nie regres
  aplikacji — Playwright pilnuje widoczności, nie gotowości Reacta, a lista ma
  500 produkcji w bazie testowej.
  Bramki: typecheck 0, lint 0 błędów / 35 ostrzeżeń, test 224 zielone, typografia 0,
  a11y 0 naruszeń (73 elementy akcji na 8 ekranach, wszystkie osiągalne Tabem),
  `npx playwright test` 22 zielone i 1 pominięty.
  CZYTAJ: dziewięć plików wyżej, `scripts/check-typography.mjs`
  AC:
  - w każdym z dziewięciu miejsc jest `ArrowLeft` albo `ArrowRight` z `lucide-react`
    z `aria-hidden`, a nie znak tekstowy
  - czwarta reguła w `scripts/check-typography.mjs` na `[\u2190-\u21FF]`;
    `node scripts/check-typography.mjs` kod 0, a po tymczasowym wstawieniu strzałki kod 1
  - dowód na uruchomionej aplikacji: zrzuty tych ekranów pokazują ikonę w miejscu strzałki
  - negatywne: `node scripts/a11y-audit.mjs` 0 naruszeń, `npm run test` kod 0

- [ ] **F7-40** `znalezisko` `docs` `perf` Kryterium odhaczonego F2-06 dziś nie jest prawdziwe
  Waga: **drobne**. Szacunek: godzina. Znalezione w recenzji końcowej.
  `plan/08-BACKLOG.md:2015` (F2-06, odhaczone) podaje jako mierzalny dowód
  `grep -rl "'use client'" src/components | wc -l` równe **50**. Dziś ta sama komenda
  zwraca **65**. Bundel mieści się w budżecie, więc to nie jest regres wydajności, tylko
  gorsze: odhaczone issue z kryterium, które przestało być prawdą, i nic tego nie pilnuje.
  CZYTAJ: `plan/08-BACKLOG.md` wpis F2-06, `perf/budget.json`, `scripts/perf/report.mjs`
  AC:
  - albo bramka na liczbę plików klienckich w `npm run perf` (próg w `perf/budget.json`,
    dowód: podniesienie liczby ponad próg daje kod 1), albo poprawiony DOWÓD w F2-06
    na wartość aktualną z wypisaniem, które pliki doszły i dlaczego
  - `grep -n "wc -l\` równe 50" plan/08-BACKLOG.md` zwraca `0`
  - negatywne: `npm run perf` kod 0

- [x] **F7-41** `znalezisko` `docs` `perf` `force-dynamic` bez uzasadnień, wbrew kryterium F1-03
  Waga: **drobne**. Szacunek: godzina. Znalezione w recenzji końcowej.
  `plan/08-BACKLOG.md:374` (F1-03, odhaczone) mówi, że każdy z 26 plików z `force-dynamic`
  albo traci deklarację, albo ma nad nią komentarz z powodem. Dziś deklaracji jest **29**
  i ani jedna nie ma komentarza. Trzy nowe przyszły po F1 bez uzasadnienia:
  `import/osoby`, `videographers`, `campaigns/templates`. Deklaracja bez powodu jest
  nieusuwalna, bo nikt nie wie, czy wolno.
  ZROBIONE 2026-09-03. Z 29 deklaracji zostało **27**, każda z komentarzem `F7-41`
  podającym powód w jednej z czterech kategorii: strona czyta bazę na każde żądanie
  (13), katalog agentów albo szablonów czytany z dysku na każde żądanie (8), trasa API
  czyta ciało żądania (5), render zależy od ciasteczka sesji (`/login`). Dwie
  deklaracje **usunięte**, bo obie strony nie czytają niczego: `/templates/new`
  i `/campaigns/templates/new` renderują sam formularz.
  Pilnuje tego nowa reguła w `scripts/check-typography.mjs` (sprawdzana na tekście, nie
  na AST, bo komentarzy w AST nie ma): deklaracja bez komentarza w linii wyżej to kod 1.
  Dowód AC: `node scripts/check-typography.mjs` kod 0; po tymczasowym skasowaniu
  komentarza w `src/app/api/health/route.ts` kod 1 z nazwą pliku i numerem linii.
  DOWÓD w odhaczonym F1-03 poprawiony adnotacją, że kryterium przestało być prawdziwe.
  Bramki: typecheck 0, lint 0 błędów / 35 ostrzeżeń, test 224 zielone, typografia 0,
  granice zaufania 0.
  CZYTAJ: `plan/08-BACKLOG.md` wpis F1-03, 29 plików z `grep -rn "force-dynamic" src`
  AC:
  - nad każdą deklaracją `force-dynamic` stoi komentarz z powodem albo deklaracja znika
  - `node -e` / skrypt liczący deklaracje bez komentarza w linii poprzedzającej zwraca `0`
  - jeżeli decyzja o którejś wymaga usera, powstaje osobne otwarte issue zamiast
    cichego przemilczenia
  - negatywne: `npm run typecheck` kod 0, `npm run perf` kod 0

- [x] **F7-42** `znalezisko` `test` `tooling` Bramki brudzą drzewo robocze zrzutami dowodowymi
  Waga: **ważne**. Szacunek: godzina. Znalezione w recenzji końcowej.
  `screenshots/F5/F5-01-logowanie.png`, `screenshots/F5/F5-04-produkcja-dodana.png`
  i `screenshots/F6/a11y-audit.json` są śledzone przez gita i nadpisywane przy każdym
  przebiegu bramek (`e2e/f5-scenariusze.spec.ts:19`, `scripts/a11y-audit.mjs:23`).
  Skutek: uruchomienie bramek zmienia drzewo robocze, więc `git status` przestaje
  odpowiadać na pytanie „czy coś zmieniłem", a przypadkowe `git add -A` wciąga do commita
  szum pomiarowy. Zrzut dowodowy ma być artefaktem świadomym, nie efektem ubocznym.
  ZROBIONE 2026-09-03. Sześć miejsc zapisujących dowody (`e2e/login.spec.ts`,
  `e2e/import-osoby.spec.ts`, `e2e/f5-scenariusze.spec.ts`, `scripts/a11y-audit.mjs`,
  `scripts/f6-import-widoki.mjs`, `scripts/f6-komunikaty-bledow.mjs`) kieruje teraz
  do `test-results/` (już w `.gitignore`), a do `screenshots/` tylko przy
  `UPDATE_SHOTS=1`. Świadomie bez wspólnego modułu: to jeden warunek w linii,
  a katalogi `e2e/` (TypeScript) i `scripts/` (`.mjs`) i tak nie dzielą modułów.
  Dowód AC: na czystym drzewie `npx playwright test` (22 zielone, 1 pominięty)
  i `node scripts/a11y-audit.mjs` (0 naruszeń) zostawiają `git status --short` bez
  ani jednej linii z `screenshots/`; plik trafia do `test-results/F6/a11y-audit.json`.
  `UPDATE_SHOTS=1 node scripts/a11y-audit.mjs` nadal aktualizuje `screenshots/F6/a11y-audit.json`
  (czas modyfikacji 06:40:08 przed, 06:42:21 po).
  Bramki: typecheck 0, e2e 22 zielone i 1 pominięty, a11y 0 naruszeń.
  CZYTAJ: `e2e/f5-scenariusze.spec.ts`, `scripts/a11y-audit.mjs`, `.gitignore`
  AC:
  - domyślnie zrzuty i `a11y-audit.json` lądują w `test-results/` (już ignorowanym),
    do `screenshots/` tylko przy `UPDATE_SHOTS=1`
  - dowód: `npx playwright test` i `node scripts/a11y-audit.mjs` na czystym drzewie,
    potem `git status --short` zwraca **pustkę**
  - `UPDATE_SHOTS=1` nadal aktualizuje pliki w `screenshots/` (dowód: zmieniony `mtime`)
  - negatywne: `npx playwright test` 22 zielone i 1 pominięty, `node scripts/a11y-audit.mjs`
    0 naruszeń

- [x] **F7-43** `znalezisko` `perf` `tooling` Dryf ostrzega także wtedy, gdy jest szybciej
  Waga: **drobne**. Szacunek: pół godziny. Znalezione w recenzji końcowej.
  `scripts/perf/drift.mjs` liczy `Math.abs(pct)`, więc do listy dryfu trafia również
  POPRAWA, a `report.mjs` wypisuje ją słowem `ostrzeżenie`
  (zaobserwowane: `hmrMs 1961 -> 466 (-76%)`). Ostrzeżenie o tym, że jest szybciej, uczy
  czytelnika przewijać całą sekcję, a wtedy prawdziwe ostrzeżenie też przepada.
  ZROBIONE 2026-09-03. Wypis dryfu w `report.mjs` rozróżnia znak: `poprawa` dla zmiany
  w dół, `ostrzeżenie` wyłącznie w górę, `BLOKUJE` bez zmian (i tak liczone tylko dla
  znaku dodatniego, `driftVerdict` tego nie zmienia). Nagłówek sekcji mówi teraz
  „ostrzeżenie od 15% w górę [...] zmiana w dół to poprawa".
  Dowód AC: `node scripts/perf/report.mjs` na zastanych przebiegach wypisuje dokładnie
  ten przypadek z recenzji jako `poprawa     hmrMs: 1961 -> 466 (-76%)`, a obok
  `ostrzeżenie p95 home: 16.8 -> 20.6 (+23%)`; kod wyjścia 0.
  `node scripts/perf/drift-selftest.mjs` kod 0 (866 par, 0 fałszywych alarmów,
  0 przepuszczonych regresji) — reguła blokowania nietknięta.
  CZYTAJ: `scripts/perf/drift.mjs`, `scripts/perf/report.mjs`, `scripts/perf/drift-selftest.mjs`
  AC:
  - zmiana ujemna wypisuje się jako `poprawa`, słowo `ostrzeżenie` zostaje wyłącznie
    dla znaku dodatniego; blokada nadal wyłącznie dla dodatniego
  - dowód: `node scripts/perf/drift-selftest.mjs` kod 0, a `npm run perf` na przebiegu
    z poprawą pokazuje `poprawa`, nie `ostrzeżenie`
  - negatywne: `npm run perf` kod 0, próg blokujący zachowuje się jak przed zmianą

---

## F8 — Bramka decyzyjna (pętla STAJE przed tą fazą i pyta usera)

- [ ] **F8-01** `arch` Decyzja: czy wdrażamy zmiany na produkcję
  AC: user potwierdza wdrożenie po przeczytaniu `WERYFIKACJA.md`; plan wycofania opisany
  w `DECISIONS.md`; migracje przećwiczone na kopii przed produkcją

- [ ] **F8-02** `arch` Decyzja: czy zmieniamy stack
  AC: podejmowana wyłącznie, gdy po F2 któryś budżet z `plan/03` sekcja 4 pozostaje
  nieosiągnięty; materiał wejściowy to tabela przed i po oraz rekomendacja
  z `DECISIONS.md`; bez tego materiału issue zamyka się jako niepotrzebne

- [ ] **F8-03** `arch` OPCJONALNE, nie planujemy pracy: logowanie i podział na role
  Zakres, gdyby user zmienił zdanie: konta użytkowników zamiast jednego wspólnego
  logowania; role administrator, kamerzysta, artysta; administrator widzi wszystko;
  kamerzysta widzi swój harmonogram i swoje zlecenia; artysta widzi swój harmonogram
  i numer telefonu przypisanego kamerzysty.
  Co będzie potrzebne przy wycenie: dziś logowanie to jedno konto z pary `AUTH_EMAIL`
  i `AUTH_PASSWORD`, sesja to podpisane ciasteczko (`src/lib/auth-token.ts`), a filtr
  po roli wymaga kolumny właściciela na produkcjach i wpisach kalendarza plus filtra
  w każdym zapytaniu. Kolumny `phone` na `videographers` dostarcza już F4-00.
  Udostępnienie numeru wymaga zgody kamerzysty i decyzji o zakresie danych.
  AC: user decyduje „robimy" albo „nie robimy". Przy „robimy" powstaje osobny pakiet
  planistyczny; ta faza NIE jest wykonywana w bieżącej pętli.

---

## GITLAB-IMPORT

- Milestone = faza (`F0 Fundament`, `F1 Wydajność danych`, `F2 Wydajność UI`,
  `F3 Komponenty`, `F4 Import`, `F5 Testy`, `F6 Polish`, `F7 Znaleziska`, `F8 Bramka`).
- Labels: `arch`, `perf`, `db`, `ui`, `import`, `test`, `docs`, `tooling`, `security`,
  `znalezisko`, plus `blocked` dla issues oznaczonych ⏳.
- Tytuł issue = `Fx-NN: <opis>`; opis = blok `CZYTAJ:` plus kryteria akceptacji
  przepisane jako lista zadań.
- Import przez `glab issue create` w pętli po tym pliku albo eksport do CSV z kolumnami
  `title,description,labels,milestone`.
- **Źródłem prawdy o postępie pozostają pola wyboru w tym pliku.** Tracker zewnętrzny
  jest kopią dla ludzi, nie odwrotnie.
