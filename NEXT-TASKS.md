# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F7-06, F7-07, F7-08, F7-09, F7-10**. Wcześniej zamknięte:
F0 do F6 w całości oraz F7-01 do F7-05. Poza F7 otwarte są tylko dwa issues czekające
na usera: **F4-06** (prawdziwy plik `.xlsx`) i publiczny adres w **F5-04**.
Nie ruszać żadnego z nich.

## Co zastajesz po tej paczce

**Złożoność spadła o 31%, nie o połowę, i tak to zapisałem.** Zastanych trafień reguły
`complexity` było **58** (nie 63 — pięć zniknęło razem z F7-01 do F7-05), jest **40**
w 29 plikach. Lista grandfather w `eslint.config.mjs` skurczona z 43 do 29 pozycji.
Naprawiłem te funkcje, w których „złożoność" była artefaktem metryki: łańcuchy
`x?.pole ?? ''` i `(a ?? 0) + (b ?? 0)` liczą się do złożoności cyklomatycznej, choć
niczego nie rozgałęziają. Zostały te, w których złożoność jest prawdziwa. Najwyższe:
**`ProductionStepRow` 46** (`src/components/productions/production-step-row.tsx:75`)
i **`CalendarPage` 43** (`src/app/calendar/page.tsx:75`). To komponenty po kilkaset
linii; ich podział zmienia strukturę renderu, więc potrzebuje własnego issue i własnego
dowodu wizualnego. Nie doklejaj tego do paczki sprzątającej.

**Jest `fieldText` w `src/lib/utils.ts`.** Trzy linie, zamienia `null`/`undefined`
z bazy na pusty string. Piszesz formularz, który przepisuje wiersz do stanu? Użyj tego
plus `const src: Partial<T> = initial ?? {}`, zamiast łańcucha `initial?.pole ?? ''`.
Ten wzorzec sam zdjął z listy pięć plików.

**Kolory pasm T1/T2/T3 mają jedno źródło: `FRAME_STYLE` w `src/lib/category-colors.ts`.**
Doszły tam pola `faint` i `glow`, wypadło `rail` (jego jedynym odbiorcą był zakazany
przez Z8 lewy pasek akcentu). Nie wpisuj `amber-500` ani `violet-500` wprost
w komponencie, czytaj z tej tabeli.

**Server actions z `src/server/actions/` NIE dają się zaimportować do skryptu `tsx`.**
Zmierzone: import rzuca `This module cannot be imported from a Client Component module`,
bo `requireSession()` ciągnie `src/lib/auth.ts`, a ten pakiet `server-only`. Działa
`db.insert(schema.calendarEntries)` i reszta bezpośredniego Drizzle. Persony agentów
i `CLAUDE.md` uczą tego pierwszego, czyli kłamią — zapisane jako **F7-30**.

**Zestaw L sieje wreszcie katalogi.** `production_templates` 5, `marketing_templates` 5,
`agents` 6. Do zestawu mierzonych stron doszły `/templates` i `/agents`.

## Liczby, do których porównujesz

`npm run typecheck` kod 0. `npm run lint` kod 0, **45 ostrzeżeń** (było 78), 0 błędów.
Rozbicie: `complexity` 40, `react-hooks/exhaustive-deps` 2,
`@next/next/no-img-element` 1, `import/no-anonymous-default-export` 1,
`@typescript-eslint/no-unused-vars` **0**.
`npm run test` **216 zielonych w 20 plikach**. `node scripts/check-typography.mjs`
kod 0. `node scripts/check-trust-boundaries.mjs` kod 0, **73 punkty wejścia**.
`npm run perf` kod 0, bundel `/calendar` **292,7 kB** przy progu 301,6 kB.
`npx playwright test` **22 zielone na budowaniu produkcyjnym** (na deweloperskim
21 + `gantt-filter.spec.ts` czerwony, to znane **F7-28**).

Uczciwy licznik ostrzeżeń, `grep` kłamie:
`npx eslint . -f json | jq '[.[].messages[]|select(.ruleId=="X")]|length'`.

## Stan zestawu L po F7-10

`npm run pg:info` na `marketing_perf`:

| tabela | wierszy |
|---|---|
| agents | **6** |
| marketing_templates | **5** |
| production_templates | **5** |
| artists | 200 |
| videographers | 60 |
| campaigns | 40 |
| productions | 500 |
| calendar_entries | 3000 |
| posts | 5000 |
| csv_uploads | 20 |
| csv_rows | 12000 |
| agent_runs | 0 |

**Czy P3 da się wreszcie zmierzyć: tak.** Trzy katalogi, które krok P3 miał wpiąć
w cache, mają wiersze, a obie strony, które je renderują, są w zestawie mierzonym
i mają zapisane „przed" w `perf/baseline.json`: `/templates` p50 8,1 ms i p95 9,3 ms,
`/agents` p50 5,2 ms i p95 5,8 ms (mediany z trzech przebiegów).
**Ostrzeżenie dla F7-11:** te liczby są jednocyfrowe. Kryterium F7-11 mówi o poprawie
o 10% p95 na dwóch ścieżkach, czyli o **0,9 ms na `/templates` i 0,6 ms na `/agents`** —
to jest poniżej szumu maszyny, który na tych stronach sięga kilkudziesięciu procent.
Zanim wdrożysz Cache Components, ustal metodę: albo mediana z wielu przebiegów i jasno
nazwany próg istotności, albo pomiar czegoś grubszego niż te dwie strony. Inaczej
F7-11 skończy się tak samo jak F1-03: hipoteza nie zostanie obalona uczciwie, tylko
utonie w szumie.

## Pułapki

1. **`npx playwright test` bierze serwer z portu 3000** (`reuseExistingServer: true`).
   Przed przebiegiem `npm run build` i `npx next start -p 3000`, inaczej
   `gantt-filter.spec.ts` pada na progu 300 ms (F7-28).
2. **Nie da się zaimportować server action do `tsx`** — patrz wyżej, F7-30.
   Do ad-hoc zapisów używaj `db` z `src/lib/db.ts` i wołaj skrypt tak:
   `set -a; . ./.env.local; set +a; npx tsx skrypt.ts`. Bez tego `src/lib/env.ts`
   wywala się na braku `DATABASE_URL`, bo `dotenv` w pliku `.ts` ładuje się po
   `require` modułów (CJS hoistuje importy).
3. **`git stash push -u` zabiera Twoje skrypty pomocnicze.** Używaj
   `git stash push -- src/ eslint.config.mjs`. Skrypt do zrzutów trzymaj w katalogu
   repozytorium, ale kasuj przed commitem — poza repem `npx tsx` nie znajdzie
   `playwright` ani `dotenv` (ESM nie honoruje `NODE_PATH`).
4. **Zrzuty do porównań rób w oknie 1280x720**, nie `fullPage`. Porównanie:
   `node scripts/perf/pngdiff.mjs a.png b.png`, próg szumu 1155 do 1680 pikseli
   z 7 823 808.
5. **`npx prettier --write` przeformatuje plik na cudzysłowy podwójne.** Repo nie ma
   konfiguracji prettiera i nie używa go w bramkach. Nie uruchamiaj go na źródłach.
6. **Do złożoności cyklomatycznej liczą się `?.` i `??`.**
7. **p95 na `/calendar` skacze między 70,7 a 94,6 ms** w kolejnych przebiegach przy
   p50 stabilnym 67,8 do 71,5 ms. Wnioski wydajnościowe opieraj na medianie p50
   z trzech przebiegów, nie na pojedynczym p95.
8. **`npm run perf:serve` robi `next build`**, więc trwa. Przed jego startem sprawdź
   `lsof -nP -iTCP:3000 -sTCP:LISTEN` i ubij to, co tam stoi.
9. **Zrzuty `screenshots/F5/*.png` zmieniają się przy każdym przebiegu e2e.** Przed
   commitem `git checkout screenshots/F5`.

## Znaleziska w F7

Zamknięte: **F7-01 do F7-10**. Otwarte: **F7-11 do F7-28** oraz dwa nowe z tej paczki:

- **F7-29** - trzy metryki czytane z CSV (`Total play time`, `Watch time (hours)`,
  `Impressions click-through rate (%)`) nie mają kolumn w tabeli `posts`, więc
  przepadają przy imporcie. Zmienne usunięte w F7-07, pytanie o kolumny zostało.
  Waga **drobne**.
- **F7-30** - `agents/schedule-manager.md`, `agents/campaign-strategist.md` i `CLAUDE.md`
  pokazują import server action do skryptu `tsx` jako działający. Nie działa, rzuca
  wyjątkiem. Waga **ważne**.

Żadne nie blokuje. **F7-11 jest odblokowane przez F7-10.**

## Jak uruchomić

```
docker start mc-pg
npm run dev                                  # webpack, port 3000
npm run build && npx next start -p 3000      # PRZED e2e
npx playwright test                          # 22 zielone na budowaniu produkcyjnym
node scripts/check-trust-boundaries.mjs
node scripts/check-typography.mjs
lsof -nP -iTCP:3000 -sTCP:LISTEN             # ZAWSZE przed perf:serve
npm run perf:serve                           # terminal 1 (ubij przed e2e)
npm run perf                                 # terminal 2, oczekiwany kod 0
npm run pg:info                              # liczby wierszy w bazie pomiarowej
set -a; . ./.env.local; set +a; npx tsx scripts/perf/seed-large.ts   # przesianie zestawu L
```

## Stan środowiska

Bez zmian: kontener `mc-pg` na porcie 5433 z bazami `marketing`, `marketing_perf`,
`marketing_test`, `marketing_preview`. `psql` tylko przez `docker exec`, brak
`magick`, `compare` i `PIL`, tryb deweloperski na webpacku.

## Decyzje w toku

Bez zmian: publiczny adres środowiska podglądowego (F5-04), `DATABASE_URL` do
prawdziwej bazy, hosting (Vercel, czyje konto), plik `.xlsx` z osobami (F4-06),
potwierdzenie `docs/ARCHITEKTURA.md` przez usera, czyszczenie historii gita z danych
osobowych (F4-07, powiązane F7-23). Nowe: czy `posts` ma dostać kolumny na czas
oglądania i CTR (F7-29).

Commity paczki: `5ae9013` (F7-06), `e176453` (F7-07), `4105572` (F7-08),
`9986221` (F7-09), `7c3c45a` (F7-10).
