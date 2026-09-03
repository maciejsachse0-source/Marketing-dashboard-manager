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
  Dowody: `npx eslint . -f json | grep -c set-state-in-effect` zwraca `0`;
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
  Dowody: `npx eslint . -f json | grep -c 'react-hooks/purity'` zwraca `0`; reguła
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

- [ ] **F7-03** `znalezisko` `ui` `react-hooks/immutability` i `react-hooks/refs`
  Waga: **drobne**. Szacunek: 2 godziny.
  4 trafienia: mutacja wartości traktowanej przez Reacta jako niezmienna
  (`periods-slider.tsx`, `templates/template-form.tsx`) oraz czytanie refa w renderze
  (`campaigns/campaign-periods-editor.tsx`).
  AC:
  - `npx eslint . -f json | grep -cE 'react-hooks/(immutability|refs)'` zwraca `0`
  - te 3 pliki wypisane z listy grandfather

- [ ] **F7-04** `znalezisko` `ui` Dwa `<a href>` na trasy wewnętrzne zamiast `<Link>`
  Waga: **drobne**. Szacunek: 15 minut.
  `@next/next/no-html-link-for-pages`, 2 trafienia: `campaigns/apply-template-button.tsx`
  i `campaigns/campaign-wizard.tsx`. Surowy `<a>` na trasę wewnętrzną robi pełne
  przeładowanie strony zamiast nawigacji klientem, czyli traci cały cache routera.
  AC:
  - `npx eslint . -f json | grep -c 'no-html-link-for-pages'` zwraca `0`
  - kliknięcie obu linków w przeglądarce nie przeładowuje dokumentu (dowód: scenariusz
    e2e sprawdzający, że wartość ustawiona w `window` przed kliknięciem przeżywa nawigację)

- [ ] **F7-05** `znalezisko` `ui` Pięć niezaescapowanych apostrofów i cudzysłowów w JSX
  Waga: **drobne**. Szacunek: 15 minut.
  `react/no-unescaped-entities` w `campaigns/campaign-periods-editor.tsx`,
  `command-palette.tsx`, `templates/template-form.tsx`.
  AC:
  - `npx eslint . -f json | grep -c 'no-unescaped-entities'` zwraca `0`

- [ ] **F7-06** `znalezisko` `tooling` 63 funkcje ponad progiem złożoności 10
  Waga: **ważne**. Szacunek: rozłożone na F2 i F3, nie w jednym podejściu.
  Z11 chroni NOWY kod, więc zastane funkcje są świadomie zgrandfatherowane, ale
  lista ma się kurczyć. Najgorsze: `setStepDate` 18, `resolveCategorySequence` 18,
  `CampaignDetailPage` 18, `ProductionDetailPage` 18, `mapYouTubeRow` 17.
  AC:
  - po zakończeniu F3 liczba trafień reguły `complexity` spada o co najmniej połowę
    (dowód: `npx eslint . -f json | grep -c '\"complexity\"'` przed i po, obie liczby
    w raporcie fazy)
  - żadna funkcja dotknięta w F1 do F6 nie zostaje z złożonością wyższą niż zastana

- [ ] **F7-07** `znalezisko` `tooling` 17 nieużywanych zmiennych i importów
  Waga: **drobne**. Szacunek: 1 godzina.
  `@typescript-eslint/no-unused-vars`, 17 ostrzeżeń. Część to prawdopodobnie
  niedokończone refaktory (`totalPlay`, `watchHours`, `ctr` w `csv-mappers.ts`,
  `StepDateMode` w `production-steps.ts`, `stamp` w `campaigns.ts`) i każde z nich
  jest pytaniem, czy jakiejś metryki nie gubimy po cichu.
  AC:
  - `npx eslint . -f json | grep -c 'no-unused-vars'` zwraca `0`
  - dla każdej usuniętej zmiennej sprawdzone, czy nie miała być użyta; przypadki
    „miała być" opisane w `DECISIONS.md` zamiast po cichu skasowane

- [ ] **F7-08** `znalezisko` `ui` Lewy pasek akcentu, zakazany zasadą Z8
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

- [ ] **F7-09** `znalezisko` `arch` Server action `createCalendarEntry` bez wywołania z UI
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

- [ ] **F7-10** `znalezisko` `perf` Zestaw L nie zasiewa katalogów, więc krok P3 był niemierzalny
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

- [ ] **F7-11** `znalezisko` `perf` `arch` Cache Components: wrócić do P3 na danych, które istnieją
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

- [ ] **F7-12** `znalezisko` `ui` Martwy kod w gancie: dwie funkcje i dwa importy bez odbiorcy
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

- [ ] **F7-13** `znalezisko` `ui` Wypisać gant z listy grandfather w ESLint
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

- [ ] **F7-14** `znalezisko` `ui` `tooling` Turbopack w trybie deweloperskim gubi siatkę dni w pasach T
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

- [ ] **F7-15** `znalezisko` `ui` Mikro-etykieta sekcji powielona 90 razy w pięciu wariantach
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

- [ ] **F7-16** `znalezisko` `ui` Trzy komponenty z `ui/` nie mają ani jednego użycia
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

- [ ] **F7-17** `znalezisko` `ui` Długie myślniki w treściach z `data/`, poza zakresem Z7
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

- [ ] **F7-18** `znalezisko` `test` `tooling` `npx playwright test` po cichu bierze
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

- [ ] **F7-19** `znalezisko` `db` `import` Przeniesienie danych z `videographers.contact`
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

**DoD F7:** każde znalezisko ma issue; każde issue ma dyspozycję: zrobione, świadomie
odrzucone z powodem, albo przeniesione do trackera zewnętrznego z linkiem.


- [ ] **F7-20** `znalezisko` `ui` Pole wyboru pokazuje surową wartość zamiast etykiety
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

- [ ] **F7-21** `znalezisko` `test` `tooling` Testy e2e importu piszą do bazy roboczej
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

- [ ] **F7-22** `znalezisko` `docs` `AGENTS.md` wskazuje nieistniejący plik planu
  Znalezione przy F4-04. Wiersz „Import osób z arkusza" w `AGENTS.md` kieruje do
  `plan/04-import-osob.md`, a plik nazywa się `plan/04-import-excel.md`. Router, który
  wysyła w nieistniejące miejsce, kosztuje każdego agenta jedno zmarnowane szukanie.
  Waga: **drobne**. Szacunek: pięć minut.
  AC:
  - każda ścieżka wymieniona w tabeli `AGENTS.md` istnieje (dowód: pętla po ścieżkach
    z tabeli, `test -e` dla każdej, zero brakujących)
  - negatywne: treść wierszy tabeli poza ścieżkami nie zmienia się

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

- [ ] **F7-24** `znalezisko` `ui` Tytułu produkcji nie widać nigdzie na jej stronie
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

- [ ] **F7-25** `znalezisko` `ui` Odnośniki nawigacji poniżej 44 px obszaru dotyku
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

- [ ] **F7-26** `znalezisko` `tooling` `production-drawer.tsx` to martwy kod
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

- [ ] **F7-27** `znalezisko` `dane` Przesunięcie startu produkcji gubi się w polu, ale nie w danych
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
  Waga: **ważne**. Szacunek: pół dnia.
  AC:
  - po przesunięciu startu o `n` dni pole „Start produkcji" po przeładowaniu strony
    pokazuje datę większą o dokładnie `n` dni (dowód: scenariusz e2e dla n = 1, 2 i 3)
  - powtórzenie przesunięcia na tę samą datę nie zmienia już nic
    (dowód: `T-0` w tekście strony identyczne przed i po drugim zatwierdzeniu)
  - test jednostkowy odtwarzający dryf: `shiftProductionT1Start` wywołane dwa razy
    z tą samą datą docelową przesuwa `t0At` tylko raz
  - negatywne: `npm run test` kod 0, `npx playwright test` 22 zielone

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
