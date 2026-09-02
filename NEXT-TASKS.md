# NEXT-TASKS — przekazanie do kolejnego workera

Stan na 2026-09-02, po zamknięciu **całej fazy F2** (F2-01 do F2-06).
Definition of Done F2 sprawdzone punkt po punkcie: `DECISIONS.md`, sekcja
„F2 — raport fazy". Wszystkie punkty spełnione.

## Następne issue

**F3-01** `ui` Inwentaryzacja i uzupełnienie wzorca guzika.
CZYTAJ: `plan/05-ui-system.md` sekcje 1, 2, 3 i 4. Kolejność w
`plan/08-BACKLOG.md` jest prawem.

Bramka z F0 (`docs/ARCHITEKTURA.md` potwierdzony przez usera) nadal otwarta
i nadal nie blokuje niczego poza wdrożeniem.

## Co zastajesz po F2

**Główny cel fazy osiągnięty.** JS pierwszego ładowania `/calendar`: **292,0 kB
po gzip wobec progu 301,6 kB** (start: 355,5 kB). `npm run perf` kończy się
**kodem 0** — pierwszy raz od F0. Wcześniejsza instrukcja „perf kończy się
kodem 1 i to jest stan oczekiwany" jest już nieaktualna: od teraz kod 1 znaczy
regresję.

Skąd wzięło się 63 kB: `src/lib/production-periods.ts` importował zoda dla
`periodsSchema`, a ten plik czyta gant, więc cała biblioteka (61,4 kB po gzip)
siedziała w bundlu klienckim. Schematy wyprowadzone do
`src/lib/production-periods-schema.ts` — **nie importuj go z komponentu
klienckiego**, bo zod wróci do bundla. Usunięcie ośmiu dyrektyw `'use client'`
dołożyło tylko 1,7 kB.

Kształt legacy ganta (`buildLegacyShape`, `customSteps`, `stepOrder`) **nie
istnieje**. Gant i widok tabeli czytają `steps[]` wprost:
- sekwencja kroków kategorii: `resolveStepSequence(steps, category)`
  w `src/lib/category-sequence.ts`,
- status i indeks dat: `deriveProductionStage`, `recordedStageDates`
  w `src/lib/production-steps.ts`.

Pole `stepDates` zostało w typie `GanttRow` jako indeks dat liczony z `steps[]`
przy każdym renderze — nie jest drugim źródłem prawdy, ale testy przypinające
z F2-01 adresują przez nie `resolveStageDate`, więc jego usunięcie łamałoby
zakaz zmiany treści tych testów.

`npm run dev` to teraz **webpack bez flagi pamięci**, `npm run dev:alt` to
turbopack. Flaga `--max-old-space-size=4096` usunięta: szczytowy RSS bez niej
to 1556 MB przy progu 2500.

## Pułapki, na które wdepnąłem w F2

1. **Próg szumu porównania zrzutów z F2-01 (1050 pikseli) jest zaniżony.**
   Cztery zrzuty tego samego, niezmienionego kodu `/calendar?view=week` różnią
   się między sobą o 1155 do 1680 pikseli z 7 823 808 (antyaliasing
   przerywanych prowadnic). Jedna liczba powyżej 1100 nie jest dowodem
   regresji — rozstrzygaj powtórką, dwa zrzuty potrafią wyjść identyczne (0).
   Sprawdzaj też, CO się różni: wycinek obrazu obok siebie mówi więcej niż
   licznik.
2. **Tryb deweloperski na turbopacku renderuje `/calendar` inaczej niż
   produkcja** — w pasach T1/T2/T3 znika siatka dni. Zrzut produkcyjny wobec
   dev-webpacka: 6 306 pikseli różnicy, wobec dev-turbopacka: 82 921. To jest
   issue **F7-14** i to jest powód, dla którego `dev` został na webpacku mimo
   trzynastokrotnie szybszego HMR turbopacka.
3. **`npm run perf` nie mierzył rozmiaru bundla, tylko czytał go z
   `perf/baseline.json`** (liczba z F0-05). Naprawione w F2-06: `report.mjs`
   bierze rozmiar z najnowszego przebiegu `page-*`. Gdyby liczba w raporcie
   przestała się ruszać po zmianie kodu — sprawdź to miejsce najpierw.
4. **`measure-dev.mjs` rozpoznawał przebudowę po wolniejszej odpowiedzi.**
   Dla turbopacka próg nigdy nie padał i pomiar wywalał się błędem. Teraz
   harness podmienia w gancie napis widoczny w HTML-u (`Outreach + ustalenia`)
   i czeka na stronę z markerem. Gdy zmienisz ten napis w `gantt-view.tsx`,
   `npm run perf:dev` powie o tym wprost.
5. **Porównywanie całych odpowiedzi HTTP nie działa jako detektor zmiany** —
   dwa identyczne żądania do `/calendar` różnią się między sobą.
6. **`npm run perf:dev` przyjmuje nazwę skryptu npm**:
   `npm run perf:dev -- dev:alt`. Wynik ląduje w `perf/runs/dev-<bundler>-*.json`
   z polami `script`, `bundler`, `maxOldSpace`.
7. **`git stash push -- src scripts/nowy-plik.ts` wywala się**, gdy plik jest
   nieśledzony („Did you forget to 'git add'?"), i NIC nie chowa — a wygląda to
   jak udany stash. Przy porównaniu przed/po sprawdź, czy stash naprawdę
   zadziałał, inaczej zmierzysz dwa razy to samo.
8. Pułapki z poprzedniego przekazania nadal obowiązują: nie da się
   zaimportować `gantt-view.tsx` w vitest (łańcuch importów prowadzi do
   `src/lib/env.ts`); lista grandfather w `eslint.config.mjs` zjeżdża
   `complexity` do ostrzeżenia tylko dla wyliczonych ścieżek; `git stash -u`
   kasuje puste katalogi; kreator produkcji wymaga artysty także dla „Solo";
   kroki produkcji to `<button>` z `aria-label`, nie `checkbox`.

## Liczby, do których porównujesz

p95 z trzech przebiegów na zestawie L, serwer produkcyjny (mediana, ms):
home 17,6; calendar 60,3; calendar-table 31,7; productions 124,5;
production-detail 24,0; campaign-detail 31,0; analytics 26,4. Progi: 600 ms
dla home, productions i analytics, 900 ms dla reszty. Zapas jest duży.

Bundel `/calendar`: 292,0 kB po gzip, próg 301,6 kB, cel długoterminowy 350 kB
(już spełniony). Pomiar deterministyczny: trzy przebiegi dały 292 / 292 / 292.

Tryb deweloperski, mediany z trzech przebiegów: webpack 493 / 2777 / 135 /
2017 / 1556 (ready / firstCompile / warmP50 / hmr / peakRss), turbopack
468 / 1187 / 74 / 157 / 1469.

Interakcja „zmiana filtra kampanii → przemalowanie ganta": mediana 78 ms przy
progu 300 ms (`e2e/gantt-filter.spec.ts`, zapis w `perf/runs/gantt-filter-*.json`).

**Szum pomiarowy czasów sięga 40%.** Mediana z trzech przebiegów, zawsze.

## Jak uruchomić

```
docker start mc-pg
npm run dev                 # webpack, port 3000
npm run dev:alt             # turbopack, uwaga na F7-14
npm run perf:serve          # terminal 1: next build + next start na bazie pomiarowej
npm run perf                # terminal 2: measure-db + measure-page + report; oczekiwany kod 0
npm run perf:dev [skrypt]   # osobno, wymaga zimnego .next
npx playwright test         # 8 scenariuszy, wszystkie zielone
```

Pięć przypadków statusu produkcji do zrzutów porównawczych sieje
`npx tsx scripts/seed-gantt-cases.ts` (produkcje `F2-03 …`, idempotentne,
T-0 w drugim tygodniu domyślnego okna).

## Stan środowiska

- Baza: kontener Docker `mc-pg`, `postgres:17`, port hosta **5433**, user
  `postgres`, hasło `mc`. Bazy: `marketing` (robocza), `marketing_perf`
  (pomiarowa, zestaw L), `marketing_test`. Przed pracą: `docker start mc-pg`.
- Baza robocza niesie katalogi z `db:seed:catalog`, produkcje z e2e i pięć
  produkcji `F2-03 …`. Testy nie sprzątają po sobie i nie muszą.
- `psql` nie istnieje na hoście: `docker exec mc-pg psql -U postgres -d <baza>`.
  Liczbę zapytań na render da się zmierzyć przez `ALTER SYSTEM SET
  log_statement='all'` plus `docker logs mc-pg` (pamiętaj o `RESET` po pomiarze).
- Nie ma `magick` ani `compare` ani `PIL`. Do obrazków: `scripts/perf/pngdiff.mjs`.
- `.env.local` istnieje, poza gitem, niesie komplet zmiennych.
- `perf/runs/` jest w `.gitignore`; `perf/baseline.json` i `perf/budget.json` nie.

## Decyzje w toku

- `DATABASE_URL` do prawdziwej bazy nadal nie dostarczony.
- Hosting: decyzja „naprawiamy Vercela czy porzucamy" należy do usera.
- Plik `.xlsx` z osobami (F4-06) nadal nie dostarczony.
- `docs/ARCHITEKTURA.md` czeka na potwierdzenie przez usera (bramka DoD F0).
- Do rozważenia przez orkiestratora: F2-05 wybrał webpacka wbrew wynikowi
  pomiaru czasu. Gdyby priorytetem był czas przebudowy, a nie zgodność
  z produkcją, przełączenie to jedna linijka w `package.json`.

## Znaleziska w F7

**F7-01** do **F7-14**, żadne nie blokuje. Nowe w tej paczce: **F7-14**
(turbopack w trybie deweloperskim gubi siatkę dni w pasach T; waga ważne, bo
blokuje trzynastokrotnie szybszy HMR).

Commity fazy: `628bcac` (F2-01), `d4035dc` (F2-02), `4706d32` (F2-03),
`55a064e` (F2-04), `5e1043e` (F2-05), `a7174c0` (F2-06).
