# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F7-21, F7-22, F7-24, F7-25, F7-26**. Wcześniej zamknięte:
F0 do F6 w całości oraz F7-01 do F7-20. Poza F7 otwarte są tylko dwa issues czekające
na usera: **F4-06** (prawdziwy plik `.xlsx`) i publiczny adres w **F5-04**.
Nie ruszać żadnego z nich. **F7-23 stoi nietknięty** — czeka na decyzję usera
o czyszczeniu historii gita.

## Co zastajesz po tej paczce

**Testy e2e nie dotykają już bazy roboczej** (F7-21). To najważniejsza zmiana.
`playwright.config.ts` uruchamia `scripts/e2e-serve.mjs`, a ten: podmienia
`DATABASE_URL` na `TEST_DATABASE_URL` (odmawia, gdy równy roboczej, pomiarowej albo
podglądowej), migruje schemat, zasiewa **zestaw L** (`scripts/perf/seed-large.ts`, sam
robi `truncate`, więc czyszczenie jest PRZED przebiegiem) plus prawdziwy katalog
(`drizzle/seed-catalog.ts`, bo kreator kampanii szuka szablonu po nazwie z katalogu),
i dopiero potem stawia `next dev`. Dowód: `marketing` ma `152|97|29` (artyści,
produkcje, kampanie) przed pełnym przebiegiem i po nim.

Wynika z tego kilka rzeczy praktycznych:
- **Ubij własny `npm run dev` przed `npx playwright test`.** Serwer na porcie 3000
  stojący na bazie roboczej zostanie odrzucony przez `e2e/global-setup.ts`
  z komunikatem, jaka baza siedzi na porcie.
- Każdy przebieg trwa ok. **1,5 min** (wcześniej 25 s), bo zasiew i kompilacja
  idą na zimno.
- Scenariusze, które zaglądają do bazy, robią to przez `e2e/db.ts` (`connectTestDb`),
  nie przez `process.env.DATABASE_URL`.
- `import-osoby.spec.ts` przywraca stan przez `truncate table artists restart identity
  cascade`. To wolno TYLKO dlatego, że baza jest wyłącznie testowa, i zakłada, że
  `f5-scenariusze.spec.ts` (potrzebuje zasianych artystów) biegnie wcześniej —
  kolejność alfabetyczna plików to dziś zapewnia.
- Na zimnym serwerze pierwsze kliknięcie potrafi trafić w stronę przed hydracją.
  `f5-scenariusze.spec.ts` ma na to `expect(...).toPass()` wokół otwarcia kreatora.
  Jeśli zobaczysz podobny miganie-flake w innym scenariuszu, to ta sama przyczyna.

**Tytuł produkcji jest widoczny** (F7-24). W `H1` strony `/productions/<id>` stoi
`production.title`, nazwa artysty poszła do wiersza pod tytułem. `ProductionCard`
straciło przełącznik `showHeader` i rysuje tytuł na każdej karcie listy. Tytuły były
w bazie zapisane i niepuste (`504|504` w zestawie L, `97|97` na roboczej) — problemem
było wyłącznie wyświetlanie.

**Halo dotyku ma własną stałą** — `HALO_DOTYK` w `src/lib/utils.ts`. Każdy nowy
odnośnik nawigacyjny ma ją dostać. Wiersze ganta są świadomym wyjątkiem oznaczonym
`data-dense` (halo 44 px przy wierszu 20-24 px zachodziłoby na sąsiada i przechwytywało
jego kliknięcia); `scripts/a11y-audit.mjs` te elementy pomija.

**`production-drawer.tsx` i `getProductionByEntryId` nie istnieją** (F7-26).
Punktów wejścia 73, nie 74.

## Liczby, do których porównujesz

`npm run typecheck` kod 0. `npm run lint` kod 0, **36 ostrzeżeń** (było 37; jedno
zniknęło razem z martwą szufladą), 0 błędów. `npm run test` **223 zielone w 20 plikach**.
`node scripts/check-typography.mjs` kod 0. `node scripts/check-trust-boundaries.mjs`
kod 0, **73** punkty wejścia. `npm run perf` kod 0, bundel `/calendar` **293,3 kB**
przy progu 301,6 kB. `npx playwright test` **22 zielone w 1,5 min**.
`node scripts/a11y-audit.mjs` **0 naruszeń**.

Uczciwy licznik ostrzeżeń, `grep` kłamie:
`npx eslint . -f json | jq '[.[].messages[]|.ruleId]|group_by(.)|map({r:.[0],n:length})'`.

## Znaleziska w F7

Zamknięte: **F7-01 do F7-22** oraz **F7-24, F7-25, F7-26**.
Otwarte: **F7-23** (czeka na decyzję usera), **F7-27 do F7-32**.
Nowych znalezisk ta paczka nie wniosła.

## Pułapki

1. **Ubij `npm run dev` przed `npx playwright test`** (patrz wyżej). Ubij też
   `npm run perf:serve`.
2. **Nie da się zaimportować server action do `tsx`** (F7-30). Do ad-hoc zapisów
   `set -a; . ./.env.local; set +a; npx tsx skrypt.ts`.
3. **`git stash push -u` zabiera Twoje skrypty pomocnicze.** Używaj `git stash push -- src/`.
4. **Zrzuty do porównań rób w oknie 1280x720**, nie `fullPage`.
   Porównanie: `node scripts/perf/pngdiff.mjs a.png b.png`. Dwa przebiegi na tym samym
   kodzie dają **0** różnych pikseli.
5. **`npx prettier --write` przeformatuje plik na cudzysłowy podwójne.** Nie uruchamiaj.
6. **Do złożoności cyklomatycznej liczą się `?.` i `??`.** Skrypty w `scripts/` też.
7. **`npm run perf:dev` kasuje `.next`.** Kolejność: perf:dev, potem `npm run perf:serve`.
8. **`npm run perf:serve` robi `next build`** (ok. 90 s). Przed startem sprawdź
   `lsof -nP -iTCP:3000 -sTCP:LISTEN`.
9. **Własne utility CSS musi trafić do `extendTailwindMerge`** (`src/lib/utils.ts`).
   **A `@utility` z zagnieżdżonym `@media (pointer: coarse)` Tailwind v4 w ogóle nie
   wygenerował** — klasa siedziała w DOM, a `::after` miało `content: none`. Halo
   dotyku stoi więc na zwykłych klasach wariantowych, nie na własnym utility (F7-25).
10. **Zrzuty `screenshots/F5/*.png` zmieniają się przy każdym przebiegu e2e.**
    Przed commitem `git checkout screenshots/F5`. Od F7-21 pochodzą z bazy testowej
    (zestaw L), więc nie ma na nich żadnych prawdziwych danych.
11. **`perf/baseline.json` jest jedynym zapisem stanu „przed"** dla siedmiu starszych stron.
12. **Skrypty pomocnicze trzymaj w katalogu repozytorium** i kasuj przed commitem.
13. **`dotenv` nie nadpisuje kluczy już obecnych w `process.env`** — dlatego
    `DATABASE_URL=... npx tsx skrypt.ts` działa mimo `config({ path: '.env.local' })`.

## Jak uruchomić

```
docker start mc-pg
npm run dev                                  # turbopack, port 3000, baza robocza
pkill -f "next dev" && npx playwright test   # 22 zielone, własna baza testowa
node scripts/check-trust-boundaries.mjs
node scripts/check-typography.mjs
node scripts/a11y-audit.mjs                  # wymaga serwera na 3000
lsof -nP -iTCP:3000 -sTCP:LISTEN             # ZAWSZE przed perf:serve
npm run perf:serve                           # terminal 1 (ubij przed e2e)
npm run perf                                 # terminal 2, oczekiwany kod 0
npm run pg:info                              # liczby wierszy w bazie pomiarowej
```

## Stan środowiska

Kontener `mc-pg` na porcie 5433 z bazami `marketing`, `marketing_perf`,
`marketing_test`, `marketing_preview`. `psql` tylko przez `docker exec`, brak
`magick`, `compare` i `PIL`. `marketing_test` jest teraz w całości własnością e2e —
zawartość po ostatnim przebiegu to zestaw L z artystami z importu. `marketing_perf`
celowo nietknięta, bo na niej stoi punkt odniesienia pomiarów.

## Decyzje w toku

Bez zmian: publiczny adres środowiska podglądowego (F5-04), `DATABASE_URL` do
prawdziwej bazy, hosting, plik `.xlsx` z osobami (F4-06), potwierdzenie
`docs/ARCHITEKTURA.md` przez usera, czyszczenie historii gita z danych osobowych
(F4-07, powiązane F7-23), kolumny na czas oglądania i CTR w `posts` (F7-29).
