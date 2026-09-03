# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F6-01, F6-02, F6-03**. **Faza F6 zamknięta w całości.**
To była ostatnia faza budowlana. Wcześniej zamknięte: F0 do F3, F4 poza **F4-06**
(czeka na prawdziwy plik `.xlsx`, nie ruszać), F5 poza jednym kryterium **F5-04**
(publiczny adres środowiska podglądowego, `BLOCKED-ASK-USER`, nie wystawiać niczego
publicznie bez decyzji usera).

## Następne kroki

Kolejny w kolejce jest **przegląd**: recenzent sprawdza wyrywkowo kryteria akceptacji
na uruchomionej aplikacji i wypełnia `WERYFIKACJA.md`. Potem **F8-01**, bramka decyzyjna
(user mówi „wdrażamy" albo „nie wdrażamy"). Faza **F7-ZNALEZISKA** ma 25 otwartych
issues, żadne nie blokuje; wykonuje się je dopiero po decyzji usera o kolejności.

## Co zastajesz po F6

**Dostępność ma bramkę, nie jednorazowy pomiar.** `node scripts/a11y-audit.mjs`
(serwer na porcie 3000, logowanie parą z `.env.local`) przechodzi tabulatorem
`/calendar`, `/productions/list` i `/import/osoby`, sprawdza obwódkę ogniskowania,
nazwy guzików bez tekstu i obszar dotyku. Kod 1 przy pierwszym naruszeniu, dziś
`RAZEM naruszeń: 0`. Surowe dane: `screenshots/F6/a11y-audit.json`.

**Halo 44 px działa tylko na `pointer: coarse`.** Baza `buttonVariants` ma
`pointer-coarse:after:min-h-11 min-w-11`. Na myszy halo jest wyłączone celowo, bo
w gancie zabierałoby kliknięcia sąsiadom. **Pomiar wymaga kontekstu Playwrighta
z `hasTouch: true` i `isMobile: true`** — CDP `Emulation.setEmulatedMedia` z cechą
`pointer` nie działa, `matchMedia` dalej zwraca `false`.

**Granice zaufania: 73 punkty wejścia, każdy z argumentami ma schemat Zod.**
Lista generuje się komendą `node scripts/check-trust-boundaries.mjs` (kod 1, gdy
którykolwiek punkt wejścia bierze argumenty bez schematu). Prymitywy w
`src/server/actions/schemas.ts`: `idSchema`, `opaqueIdSchema`, `slugSchema`,
`labelSchema`, `descriptionSchema`, `isoDateSchema`, `markModeSchema`,
`moveDirectionSchema`, `uploadedFileSchema(maxBytes)`, `postMetricsSchema`,
`productionFilterSchema`. **Dopisujesz akcję serwerową? Dopisz jej schemat**, inaczej
bramka zapali się na czerwono.

**`tests/fixtures/osoby.xlsx` nie jest już w gicie.** Wzorzec `/tests/fixtures/*.xlsx`
siedzi w `.gitignore`, a `e2e/import-osoby.spec.ts` odtwarza fixture w `test.beforeAll`
generatorem `scripts/make-fixture-xlsx.ts`. Po świeżym klonie pierwszy przebieg e2e
sam go zrobi.

**`docs/ARCHITEKTURA.md` jest domknięty i ma załącznik.** Dziesięć twierdzeń
dokumentu stoi w tabeli razem z komendą i wynikiem. Pięć zdań okazało się fałszywych
i zostało poprawionych (indeksy, rozmiar bazy roboczej, kod wyjścia `perf`, numery
linii, lista długów). Zmieniasz kod z tych obszarów? Popraw dokument w tym samym
commicie.

## Liczby, do których porównujesz

`npm run typecheck` kod 0. `npm run lint` kod 0, **108 ostrzeżeń, 0 błędów**.
`npm run test` **216 zielonych w 20 plikach** (było 193 w 19; doszedł
`src/server/actions/schemas.test.ts`). `node scripts/check-typography.mjs` kod 0.
`npx playwright test` **22 zielone**. `npm run perf` kod 0, bundel `/calendar`
**292,6 kB** przy progu 301,6 kB. `node scripts/perf/drift-selftest.mjs` kod 0.
`node scripts/a11y-audit.mjs` kod 0. `node scripts/check-trust-boundaries.mjs` kod 0,
73 punkty wejścia. `git ls-files | grep -E '\.env|\.xlsx|\.db$' | grep -v
'^\.env\.example$' | wc -l` zwraca 0.

## Pułapki z tej paczki

1. **CDP nie udaje `pointer: coarse`.** `Emulation.setEmulatedMedia` z cechą `pointer`
   przechodzi bez błędu i nic nie zmienia. Działa `browser.newContext({ hasTouch: true,
   isMobile: true })`.
2. **Kryterium F6-02 z licznikiem `git ls-files` zwracało 1, nie 0**, i tym jednym
   plikiem był syntetyczny fixture importu. Naprawione przez wypisanie go z gita, a nie
   przez naciągnięcie kryterium.
3. **Halo `::after` na guziku przechwytuje kliknięcia sąsiadów.** Dlatego jest za
   `pointer-coarse:`. Gdyby ktoś chciał je włączyć wszędzie, najpierw niech puści
   `npx playwright test` — gant ma guziki 16 px stojące co kilka pikseli.
4. **Numery linii w dokumentacji starzeją się w dwa dni.** Pięć twierdzeń
   `docs/ARCHITEKTURA.md` było fałszywych po fazach F1 i F2. Każda liczba w dokumencie
   ma obok komendę, która ją odtwarza — trzymaj się tego.
5. **Kolejność serwerów na porcie 3000 bez zmian.** `npm run perf` chce
   `npm run perf:serve`, `npx playwright test` bierze stojący serwer przez
   `reuseExistingServer`. Po pomiarach ubij `next start`, zanim puścisz e2e.

## Jak uruchomić

```
docker start mc-pg
npm run dev                                  # webpack, port 3000
node scripts/a11y-audit.mjs                  # bramka dostępności, wymaga serwera na 3000
node scripts/check-trust-boundaries.mjs      # lista punktów wejścia i schematów
node scripts/check-typography.mjs            # bramka Z5, Z6, Z7
npx playwright test                          # 22 zielone, wymaga serwera na 3000
node scripts/perf/drift-selftest.mjs         # reguła dryfu na historii przebiegów
lsof -nP -iTCP:3000 -sTCP:LISTEN             # ZAWSZE przed perf:serve
npm run perf:serve                           # terminal 1 (ubij przed e2e)
npm run perf                                 # terminal 2, oczekiwany kod 0
```

## Stan środowiska

Bez zmian: kontener `mc-pg` na porcie 5433 z bazami `marketing`, `marketing_perf`,
`marketing_test`, `marketing_preview`. `psql` tylko przez `docker exec`, brak
`magick`, `compare` i `PIL`, tryb deweloperski na webpacku, `exceljs` jedyną nową
zależnością produkcyjną całej przebudowy.

## Decyzje w toku

Bez zmian: publiczny adres środowiska podglądowego (F5-04), `DATABASE_URL` do
prawdziwej bazy, hosting (Vercel, czyje konto), plik `.xlsx` z osobami (F4-06),
potwierdzenie `docs/ARCHITEKTURA.md` przez usera, czyszczenie historii gita z danych
osobowych (F4-07, powiązane F7-23).

## Znaleziska w F7

**F7-01** do **F7-25**, żadne nie blokuje. Nowe w tej paczce:
- **F7-25** - odnośniki nawigacji w pasku bocznym są poniżej 44 px obszaru dotyku,
  bo są zwykłymi `<a>`, a halo dostały tylko guziki.

Commity paczki: `bfc6e2c` (F6-01), `8c8bc13` (F6-02), `6429bb2` (F6-03).
