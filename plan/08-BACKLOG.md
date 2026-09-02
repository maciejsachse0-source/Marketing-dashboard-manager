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

- [ ] **F0-03** `perf` `db` Zestaw L
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

- [ ] **F0-04** `perf` `tooling` Harness, część pierwsza: baza
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

- [ ] **F0-05** `perf` `tooling` ⚠ HARD Harness, część druga: strony, dev, raport, baseline
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

- [ ] **F0-06** `arch` `docs` Dokument architektury
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

- [ ] **F0-07** `docs` `tooling` Naprawa dokumentów, które kłamią, i porządki
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

**DoD F0:** `docs/ARCHITEKTURA.md` potwierdzony przez usera jako zgodny z jego wiedzą
o hostingu; `perf/baseline.json` commitowany; `typecheck`, `lint`, `test`, `e2e`, `perf`
uruchamialne.

---

## F1 — Wydajność warstwy danych i serwera (kroki P1 do P4)

- [ ] **F1-01** `db` `perf` Indeksy na kolumnach filtrowanych i sortowanych (P1)
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

- [ ] **F1-02** `perf` Zrównoleglenie zapytań i pula połączeń (P2)
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

- [ ] **F1-03** `perf` ⚠ HARD Cache zamiast bezwarunkowej dynamiki (P3)
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

- [ ] **F1-04** `perf` Zawężenie unieważniania ścieżek (P4)
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

- [ ] **F2-01** `test` Testy przypinające zachowanie ganta przed refaktorem
  CZYTAJ: `plan/06-testy.md` sekcje 2 i 3, `src/components/calendar/gantt-view.tsx`
  AC:
  - `src/components/calendar/__tests__/gantt-geometry.test.ts` z co najmniej
    6 scenariuszami z `plan/06` sekcja 3 wiersz „Oś czasu ganta"
  - wszystkie przechodzą NA KODZIE SPRZED refaktoru (dowód: wyjście przebiegu
    wklejone do raportu)
  - obejmują produkcję bez kotwicy T0 i okno kwartalne
  - negatywne: żaden test nie używa migawki całego drzewa komponentu

- [ ] **F2-02** `ui` Podział pliku ganta
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

- [ ] **F2-03** `perf` ⚠ HARD Kontrakt danych ganta: koniec kształtu legacy (P6)
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

- [ ] **F2-04** `perf` Memoizacja ganta (P5)
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

- [ ] **F2-05** `perf` `tooling` Decyzja o bundlerze deweloperskim (P7)
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

- [ ] **F2-06** `perf` `ui` Zejście z liczby komponentów klienckich (P8)
  CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P8
  AC:
  - `grep -rl "'use client'" src/components | wc -l` spada z `47` o co najmniej 8,
    wyłącznie tam, gdzie komponent nie używa stanu, efektu ani obsługi zdarzeń
  - rozmiar JS pierwszego ładowania `/calendar` po gzip poniżej progu z `perf/budget.json`
    (dowód: wyjście `next build` w raporcie)
  - negatywne: pełny zestaw e2e zielony, żaden interaktywny element nie przestaje działać

**DoD F2:** budżety stron z `plan/03` sekcja 4 spełnione albo przekroczenie opisane
w `DECISIONS.md` z rekomendacją na bramkę F8; zrzuty ganta przed i po.

---

## F3 — Jeden wzorzec zamiast N kopii

- [ ] **F3-01** `ui` Inwentaryzacja i uzupełnienie wzorca guzika
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

- [ ] **F3-02** `ui` Migracja guzików: kalendarz
  CZYTAJ: `plan/05-ui-system.md` sekcje 2, 3, 4 i 5
  AC:
  - `grep -r '<button' src/components/calendar | wc -l` zwraca `0`
  - każdy zmigrowany guzik ma wariant i rozmiar z katalogu w `plan/05` sekcja 3;
    guziki bez tekstu mają `aria-label`
  - wygląd niezmieniony: zrzuty przed i po dla widoku ganta i tabeli w `screenshots/F3/`
  - negatywne: testy z F2-01 i scenariusze e2e nadal zielone

- [ ] **F3-03** `ui` Migracja guzików: kampanie (20 sztuk)
  CZYTAJ: `plan/05-ui-system.md` sekcje 2, 3, 4 i 5
  AC:
  - `grep -r '<button' src/components/campaigns | wc -l` zwraca `0` (dziś 20)
  - warianty i `aria-label` jak w F3-02; zrzuty przed i po dla ekranu kampanii
  - negatywne: `grep -r '<div onClick\|<span onClick' src/components/campaigns | wc -l` zwraca `0`

- [ ] **F3-04** `ui` Migracja guzików: produkcje (32 sztuki)
  CZYTAJ: `plan/05-ui-system.md` sekcje 2, 3, 4 i 5
  AC:
  - `grep -r '<button' src/components/productions | wc -l` zwraca `0` (dziś 32)
  - warianty i `aria-label` jak w F3-02; zrzuty przed i po dla listy produkcji
    i szczegółu produkcji
  - negatywne: `grep -r '<div onClick\|<span onClick' src/components/productions | wc -l` zwraca `0`

- [ ] **F3-05** `ui` Migracja guzików: reszta i zamknięcie reguły lintu
  CZYTAJ: `plan/05-ui-system.md` sekcje 2 do 6, `plan/01` zasada Z3
  AC:
  - `grep -r '<button' src/ | wc -l` zwraca `0` (dziś 89; po F3-02, F3-03 i F3-04
    zostaje 26 sztuk w pozostałych katalogach)
  - reguła lintu z `plan/05` sekcja 6 przełączona z ostrzeżenia na błąd, lista wyjątków
    pusta; `npm run lint` kod 0
  - negatywne: `grep -r '<div onClick\|<span onClick' src/ | wc -l` zwraca `0`

- [ ] **F3-06** `ui` Kanon typografii i ikon
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

- [ ] **F3-07** `ui` `test` Rozbicie `template-form.tsx`
  CZYTAJ: `plan/01` zasada Z11, `plan/06-testy.md` sekcja 2
  AC:
  - test przypinający zachowanie formularza (zapis poprawny, zapis z błędem walidacji,
    anulowanie) napisany PRZED zmianą i zielony na kodzie sprzed niej
  - `src/components/templates/template-form.tsx` (1250 linii) rozbity tak, że żaden
    NOWY plik nie przekracza 300 linii
  - `npm run lint` z regułą `complexity: 10` przechodzi bez wyjątków w nowych plikach
  - negatywne: liczba żądań sieciowych przy zapisie formularza nie rośnie (dowód:
    zakładka sieci albo log serwera, wynik w raporcie)

- [ ] **F3-08** `ui` `test` Rozbicie `campaign-template-form.tsx` i `timeline.tsx`
  CZYTAJ: `plan/01` zasada Z11, `plan/06-testy.md` sekcja 2
  AC:
  - testy przypinające dla obu, zielone przed zmianą
  - oba pliki (792 i 737 linii) rozbite tak, że żaden NOWY plik nie przekracza 300 linii
  - `npm run lint` kod 0
  - negatywne: wygląd niezmieniony (zrzuty przed i po dla obu ekranów)

**DoD F3:** `grep -r '<button' src/ | wc -l` zwraca `0`; lint z regułą guzika jako błąd
przechodzi; zrzuty przed i po dla czterech ekranów.

---

## F4 — Import osób z arkusza Excel

- [ ] **F4-00** `db` Wyrównanie schematu osób
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

- [ ] **F4-01** `import` `test` Normalizacja osoby, test przed kodem
  CZYTAJ: `plan/04-import-excel.md` sekcje 4 i 5, `plan/06-testy.md` sekcja 2
  AC:
  - testy dla wszystkich reguł z `plan/04` sekcja 5 napisane PRZED implementacją
    i potwierdzone jako czerwone (dowód: wyjście z błędami w raporcie)
  - `src/lib/import/normalize.ts` implementuje normalizację, wszystkie testy zielone
  - co najmniej 12 scenariuszy: handle jako pełny URL, handle bez `@`, telefon
    w 4 zapisach, email z wielkimi literami, nazwa z polskimi znakami, wiersz pusty,
    wiersz z samą nazwą, `status` dla roli twórcy (pole ignorowane)
  - negatywne: pusta komórka zwraca `null`, nigdy pustego łańcucha (osobny test)

- [ ] **F4-02** `import` `test` Wykrywanie duplikatów
  CZYTAJ: `plan/04-import-excel.md` sekcja 5
  AC:
  - `src/lib/import/dedup.ts` rozpoznaje trzy poziomy w kolejności z `plan/04` sekcja 5;
    co najmniej 6 testów
  - aktualizacja nie kasuje istniejących wartości pustymi komórkami (test na wszystkich
    polach opcjonalnych)
  - duplikat prawdopodobny (nazwa plus lokalizacja) domyślnie NIE jest aktualizowany
  - negatywne: dwie osoby o tej samej nazwie i różnych lokalizacjach nie są duplikatem;
    porównanie nigdy nie przekracza granicy tabeli (twórca nie jest duplikatem kamerzysty)

- [ ] **F4-03** `import` Parser arkusza, fixture i mapowanie kolumn
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

- [ ] **F4-04** `import` `ui` Ekran importu: kroki 1 do 4 (wybór, mapowanie, suchy przebieg)
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

- [ ] **F4-05** `import` `security` Ekran importu: zapis transakcyjny i podsumowanie
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

- [ ] **F4-06** `import` ⏳ ZABLOKOWANE: czeka na plik `.xlsx` od usera — dopasowanie do prawdziwego arkusza
  CZYTAJ: `plan/04-import-excel.md` sekcje 1 i 4
  AC:
  - prawdziwy arkusz przechodzi suchy przebieg; raport podaje liczby: nowych,
    duplikatów, błędnych
  - aliasy kolumn uzupełnione o nazwy faktycznie występujące w pliku
  - `git status --porcelain | grep -c 'xlsx'` zwraca `0`; plik żyje w `.data-import/`
  - negatywne: żadne prawdziwe imię, handle ani telefon nie trafia do repozytorium,
    do testów ani do zrzutów ekranu

- [ ] **F4-07** `import` `security` Wycofanie skryptu z danymi na sztywno
  CZYTAJ: `scripts/import-people.ts`, `plan/01` zasada Z14
  AC:
  - `scripts/import-people.ts` usunięty, jego funkcję przejmuje ekran importu
  - `docs/ARCHITEKTURA.md` sekcja 9 odnotowuje, że dane osobowe były w kodzie i pozostają
    w historii gita, z rekomendacją dla usera (czyszczenie historii to jego decyzja)
  - negatywne: `grep -r '@noyasnee\|@akku.wav' src scripts | wc -l` zwraca `0`

**DoD F4:** pełny import fixture od pliku do bazy przechodzi jako scenariusz e2e; progi
z `plan/04` sekcja 8 spełnione; zrzuty wszystkich 7 kroków.

---

## F5 — Testy, dryf i środowisko dla zespołu

- [ ] **F5-01** `test` Domknięcie zakresu minimalnego
  CZYTAJ: `plan/06-testy.md` sekcja 3
  AC:
  - każdy obszar z tabeli w `plan/06` sekcja 3 ma co najmniej wskazaną liczbę scenariuszy
  - każda funkcja czysta w `src/lib/` ma test; lista plików bez testów w raporcie jest
    pusta albo każdy brak ma uzasadnienie „to nie jest funkcja czysta"
  - `npm run test` poniżej 60 sekund
  - negatywne: przebieg z losową kolejnością (`vitest --sequence.shuffle`) zielony,
    czyli żaden test nie zależy od danych innego

- [ ] **F5-02** `test` `perf` Bramka wydajnościowa i wykrywanie dryfu
  CZYTAJ: `plan/06-testy.md` sekcja 4, `plan/03` sekcja 4
  AC:
  - `report.mjs` kończy się kodem 1 przy przekroczeniu dowolnego progu z `budget.json`
    (dowód: uruchomienie z celowo zaniżonym progiem)
  - dryf względem OSTATNIEGO przebiegu w `perf/runs/` powyżej 15% daje ostrzeżenie,
    powyżej 30% kod wyjścia 1 (dowód: test na spreparowanym pliku przebiegu)
  - `npm run perf` opisane w `CLAUDE.md` i `AGENTS.md` jako obowiązkowe po zmianach
    w warstwie danych i w gancie
  - negatywne: uruchomienie na pustym `perf/runs/` kończy się kodem 1, nie sukcesem

- [ ] **F5-03** `test` Domknięcie scenariuszy end-to-end
  CZYTAJ: `plan/06-testy.md` sekcje 1 i 3
  AC:
  - 4 scenariusze z `plan/06` sekcja 3: logowanie (istnieje od F0-02), kalendarz
    z przewijaniem i filtrem, pełny import z fixture, dodanie produkcji; wszystkie zielone
  - każdy zostawia zrzut w `screenshots/F5/`
  - negatywne: scenariusze nie używają prawdziwych danych osobowych ani prawdziwych
    poświadczeń produkcyjnych

- [ ] **F5-04** `docs` Środowisko do klikania dla zespołu
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

**DoD F5:** wszystkie komendy jakości zielone; e2e zielone; adres środowiska przekazany
userowi.

---

## F6 — Polish: dostępność, bezpieczeństwo, domknięcie dokumentacji

- [ ] **F6-01** `ui` Audyt dostępności
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

- [ ] **F6-02** `security` Przegląd granic zaufania
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

- [ ] **F6-03** `docs` Domknięcie dokumentu architektury
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

- [ ] **F7-01** `znalezisko` `ui` Reguła `react-hooks/set-state-in-effect` w 10 komponentach
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

- [ ] **F7-02** `znalezisko` `perf` Reguła `react-hooks/purity` w 6 plikach, w tym w gancie
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

**DoD F7:** każde znalezisko ma issue; każde issue ma dyspozycję: zrobione, świadomie
odrzucone z powodem, albo przeniesione do trackera zewnętrznego z linkiem.

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
