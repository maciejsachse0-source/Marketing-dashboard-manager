# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F5-01, F5-02, F5-03, F5-04**. Faza F5 zamknięta z jednym
wyjątkiem: **F5-04 zostaje otwarte jako `BLOCKED-ASK-USER`** — trzy kryteria z czterech
spełnione, brakuje decyzji usera o publicznym adresie. Wcześniej zamknięte: F0 do F3
oraz F4 poza **F4-06** (czeka na prawdziwy plik `.xlsx`, nie ruszać).

## Następne issue

**F6-01** `ui` Audyt dostępności. CZYTAJ: `plan/05-ui-system.md` sekcje 3 i 4,
`plan/04` sekcja 6. Potem F6-02 i F6-03 w kolejności z `plan/08-BACKLOG.md`.

## Co zastajesz po F5

**Testy: 193 zielone w 19 plikach** (było 130 w 12), przebieg 3,2 s. Nowe pliki testów
funkcji czystych: `src/lib/import/mapping.test.ts`, `src/lib/production-steps.test.ts`,
`src/lib/production-periods.test.ts`, `src/lib/campaign-milestone-state.test.ts`,
`src/lib/csv-mappers.test.ts`, `src/lib/auth-token.test.ts`,
`src/lib/production-work-folder.test.ts`. Dopisane do zastanych: `dates.test.ts`,
`import/parse.test.ts`. Lista plików `src/lib/` bez testów wraz z powodem („to nie jest
funkcja czysta") stoi w dowodzie F5-01 w backlogu — nie licz jej od nowa.

**Bramka dryfu w `npm run perf` blokuje, ale nie łapie szumu.** `perf/budget.json`
ma teraz `driftFailPct: 30` i `driftAbsFloorPct: 10`. Reguła siedzi w
`scripts/perf/drift.mjs`, raport tylko ją woła. Blokada wymaga JEDNOCZEŚNIE ≥30%
pogorszenia i pogorszenia większego niż 10% limitu budżetowego metryki, bo sam procent
zapala się na szumie: zmierzone 242% między kolejnymi przebiegami
(`p95 productions-list` 0,76 → 2,84 ms). Sprawdzenie reguły na całej historii:
`node scripts/perf/drift-selftest.mjs` (280 par, zero fałszywych alarmów, kod 0).
**Jeśli dodajesz metrykę do raportu, podaj jej limit do `drift()`** — bez limitu blokada
się nie zapali.

**E2E: 22 zielone** (było 20). Nowy `e2e/f5-scenariusze.spec.ts`: kalendarz
z przewijaniem i filtrem, dodanie produkcji przez kreator. Test produkcji **kasuje po
sobie** wiersz z `productions` (`afterAll` plus czyszczenie przed scenariuszem).
Zrzuty czterech scenariuszy: `screenshots/F5/F5-01` do `F5-04`.

**Środowisko podglądowe dla zespołu.** Osobna baza `marketing_preview`
(`PREVIEW_DATABASE_URL` w `.env.local`, wzór w `.env.example`), zestaw L z generatora
`scripts/perf/seed-large.ts`. Komendy: `npm run preview:setup` (migracje plus zasiew),
`npm run preview:serve` (build plus `next start -p 3001 -H 0.0.0.0`, skrypt
`scripts/preview.mjs`). Opis, tabela adresów i dwie drogi do publicznego adresu:
`docs/ARCHITEKTURA.md` sekcja 2.1. `WERYFIKACJA.md` stoi w korzeniu jako szkielet
z nagłówkami faz — wypełnia go recenzent po F7, nie Ty.

## Liczby, do których porównujesz

`npm run typecheck` kod 0. `npm run lint` kod 0, 108 ostrzeżeń, 0 błędów.
`npm run test` **193 zielone**. `node scripts/check-typography.mjs` kod 0.
`npx playwright test` **22 zielone**. `npm run perf` kod 0, bundel `/calendar`
**292,5 kB** przy progu 301,6 kB. `node scripts/perf/drift-selftest.mjs` kod 0.
`node scripts/perf/table-counts.mjs --preview`: 200/60/40/500/3000/5000/20/12000.
Szum czasowy do 40% (na szybkich metrykach nawet 242%), próg szumu zrzutów
1 155 do 1 680 pikseli z 7 823 808.

## Pułapki z tej paczki

1. **Po `http://` nikt się nie zaloguje w buildzie produkcyjnym.** `next start` biegnie
   z `NODE_ENV=production`, więc `createSession` ustawia ciasteczko z flagą `secure`
   i przeglądarka je wyrzuca. Objaw: formularz przyjmuje hasło, następna strona odbija
   na `/login?next=…`. Adres podglądowy musi być po https.
2. **Zrzuty `fullPage` z kalendarza są bezużyteczne** — pełna strona ma 16 854 px
   wysokości. Zrzuty F5 to widok okna 1280×720.
3. **Strona produkcji pokazuje nazwę artysty zamiast tytułu produkcji** (`displayTitle`
   w `src/app/productions/[id]/page.tsx`), a lista pokazuje tytuł tylko w nagłówku
   grupy. Szukanie produkcji po tytule w e2e nie zadziała — szukaj po odnośniku
   `/productions/<id>`. Zapisane jako **F7-24**.
4. **`vitest --reporter=json` liczy scenariusze, `grep -c 'it('` nie.** `it.each` daje
   wiele scenariuszy z jednego wywołania; kryteria z licznikami sprawdzaj reporterem.
5. **`seed-large.ts` nadpisuje `perf/fixtures-ids.json`.** Zasiew bazy podglądowej
   przepisał ten plik tą samą treścią (generator jest deterministyczny), ale jeśli
   kiedyś zmienisz ziarno albo liczby, pomiar wydajności pójdzie w las.
6. **Kolejność serwerów na porcie 3000.** `npm run perf` chce `npm run perf:serve`
   (baza pomiarowa), `npx playwright test` bierze stojący serwer przez
   `reuseExistingServer` — czyli po pomiarach ubij `next start`, zanim puścisz e2e,
   inaczej testy pisałyby do bazy pomiarowej.

## Jak uruchomić

```
docker start mc-pg
npm run dev                                  # webpack, port 3000
npx playwright test                          # 22 zielone, wymaga serwera na 3000
node scripts/check-typography.mjs            # bramka Z5, Z6, Z7
node scripts/perf/drift-selftest.mjs         # reguła dryfu na historii przebiegów
lsof -nP -iTCP:3000 -sTCP:LISTEN             # ZAWSZE przed perf:serve
npm run perf:serve                           # terminal 1 (ubij przed e2e)
npm run perf                                 # terminal 2, oczekiwany kod 0
npm run preview:setup && npm run preview:serve  # środowisko dla zespołu, port 3001
```

## Stan środowiska

Bez zmian poza jedną rzeczą: doszła baza **`marketing_preview`** w kontenerze `mc-pg`
(port 5433, obok `marketing`, `marketing_perf`, `marketing_test`) i zmienna
`PREVIEW_DATABASE_URL` w `.env.local`. `psql` tylko przez `docker exec`, brak
`magick`/`compare`/`PIL`, tryb deweloperski na webpacku, `exceljs` jedyną nową
zależnością produkcyjną przebudowy.

## Decyzje w toku

Bez zmian, plus jedna nowa i pilna: **publiczny adres środowiska podglądowego**
(`tailscale funnel` kontra hosting — szczegóły w `docs/ARCHITEKTURA.md` sekcja 2.1
i w dowodzie F5-04). Nadal czekają: `DATABASE_URL` do prawdziwej bazy, hosting
(Vercel, czyje konto), plik `.xlsx` z osobami (F4-06), potwierdzenie
`docs/ARCHITEKTURA.md` przez usera, czyszczenie historii gita z danych osobowych
(F4-07, powiązane F7-23).

## Znaleziska w F7

**F7-01** do **F7-24**, żadne nie blokuje. Nowe w tej paczce:
- **F7-24** - tytułu produkcji nie widać nigdzie na jej stronie ani na liście.

Commity paczki: `6297a37` (F5-01), `b22713e` (F5-02), `7353268` (F5-03),
`30c6be6` (F5-04).
