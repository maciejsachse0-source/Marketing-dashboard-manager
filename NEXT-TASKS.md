# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F7-01, F7-02, F7-03, F7-04, F7-05**. Wszystkie pięć
z dyspozycją **ZROBIONE**. Wcześniej zamknięte: F0 do F6 w całości, poza dwoma
issues czekającymi na usera — **F4-06** (prawdziwy plik `.xlsx`) i publiczny adres
w **F5-04**. Nie ruszać żadnego z nich.

## Co zastajesz po tej paczce

**Blok grandfather w `eslint.config.mjs` ma już tylko jedną regułę.** Zastany blok
trzymał jedną listę 47 plików dla siedmiu reguł naraz, więc wypisanie pliku z jednej
reguły zdejmowało z niego pozostałe sześć. Teraz każda reguła ma własną listę i znika
stąd w całości, gdy lista pustoszeje. Zostało `complexity` z 43 plikami (**F7-06**).
Reguła: z tych list się WYPISUJEMY, nigdy do nich nie dopisujemy.

**Jest wspólny hak na synchronizację stanu z propem.** `src/lib/use-reset-on-change.ts`,
osiem linii, wzorzec „dostosowania stanu w trakcie renderu" z dokumentacji Reacta.
Zastąpił jedenaście `useEffect(() => setX(prop), [prop])`. Piszesz nowy komponent,
który resetuje stan przy zmianie propa? Użyj tego, nie efektu — efekt commituje
nieaktualny render i dopiero potem drugi z poprawnym stanem.

**Licznik z kryteriów F7 kłamie.** `npx eslint . -f json | grep -c '<reguła>'` liczy
też komentarze, bo formatter `json` dokłada do każdego pliku z komunikatem pole
`source` z całą treścią pliku. Uczciwy licznik:
`npx eslint . -f json | jq '[.[].messages[] | select(.ruleId=="X")] | length'`.
Dotyczy kryteriów w F7-01 do F7-05, opisane w `DECISIONS.md`.

**`Date.now()` w komponencie serwerowym to nie jest brud.** Trzy z pięciu trafień
`react-hooks/purity` były w RSC i mają tam lokalne `eslint-disable-next-line`
z uzasadnieniem. Reguły `react-hooks/*` pilnują renderu klienta; render RSC to jedno
wywołanie na żądanie. Nie usuwaj tych komentarzy „przy okazji sprzątania".

## Liczby, do których porównujesz

`npm run typecheck` kod 0. `npm run lint` kod 0, **78 ostrzeżeń** (było 108),
0 błędów. Rozbicie: `complexity` 58, `@typescript-eslint/no-unused-vars` 16,
`react/no-unescaped-entities` 0, `react-hooks/exhaustive-deps` 2, reszta po jednym.
`npm run test` **216 zielonych w 20 plikach**. `node scripts/check-typography.mjs`
kod 0. `node scripts/check-trust-boundaries.mjs` kod 0, 73 punkty wejścia.
`npm run perf` kod 0, bundel `/calendar` **292,8 kB** przy progu 301,6 kB
(było 292,6 — różnicę robi nowy hak i import `next/link`).
`npx playwright test` **22 zielone, ale tylko na budowaniu produkcyjnym** — patrz niżej.

## Pułapki z tej paczki

1. **`npx playwright test` na serwerze deweloperskim daje `21 passed, 1 failed`.**
   `gantt-filter.spec.ts` wymaga mediany poniżej 300 ms; webpack bez optymalizacji daje
   306 do 313 ms, `next build` + `next start` daje 116 do 139 ms. To nie jest regresja
   tej paczki — ten sam test na commicie `68171c6` sprzed paczki daje na serwerze
   deweloperskim 316, 333 i 301 ms. Zapisane jako **F7-28**. Przed przebiegiem e2e
   rób `npm run build` i `npx next start`.
2. **`git stash push -u` zabiera też Twoje skrypty pomocnicze** z katalogu repozytorium.
   Trzymaj je poza repem albo używaj `git stash push -- src/ eslint.config.mjs`.
3. **`npx prettier --write` w tym repozytorium przeformatuje plik na cudzysłowy
   podwójne.** Repo nie ma konfiguracji prettiera i nie używa go w bramkach. Nie
   uruchamiaj go na plikach źródłowych.
4. **Zrzuty `screenshots/F5/*.png` zmieniają się przy każdym przebiegu e2e.** Przed
   commitem `git checkout screenshots/`, inaczej wpadną do niego jako szum. (Powiązane
   z **F7-21**: `revalidate.spec.ts` i `stale-data.spec.ts` piszą do bazy roboczej.)
5. **`shiftProductionT1Start` kumuluje przesunięcia bez śladu w polu** — patrz
   **F7-27**. Jeśli będziesz to klikał ręcznie w bazie roboczej, licz dni, bo pole
   pokaże Ci starą datę.
6. **Zrzuty do porównań rób w oknie 1280x720**, a przy `fullPage` licz się z tym, że
   różnica 15 do 21 pikseli to wygładzanie czcionki, nie zmiana treści. Sprawdzaj
   wtedy `main.innerText` przez `diff`, a nie same piksele.

## Znaleziska w F7

**F7-01 do F7-05 zamknięte.** Otwarte: **F7-06** do **F7-25** oraz trzy nowe z tej
paczki:
- **F7-26** - `production-drawer.tsx` to martwy kod, żaden plik go nie importuje.
- **F7-27** - przesunięcie startu produkcji przesuwa całą oś, ale pole „Start produkcji"
  wraca do starej daty, bo `getFirstPeriodStart` zaokrągla `t0At` do poniedziałku.
  Powtórzone przesunięcie kumuluje dryf bez widocznego śladu. Waga **ważne**.
- **F7-28** - próg 300 ms w `gantt-filter.spec.ts` mierzy to, co akurat stoi na porcie
  3000. Waga **ważne**.

Żadne nie blokuje.

## Jak uruchomić

```
docker start mc-pg
npm run dev                                  # webpack, port 3000
npm run build && npx next start -p 3000      # PRZED e2e, inaczej gantt-filter pada
npx playwright test                          # 22 zielone na budowaniu produkcyjnym
node scripts/a11y-audit.mjs                  # bramka dostępności, wymaga serwera na 3000
node scripts/check-trust-boundaries.mjs
node scripts/check-typography.mjs
lsof -nP -iTCP:3000 -sTCP:LISTEN             # ZAWSZE przed perf:serve
npm run perf:serve                           # terminal 1 (ubij przed e2e)
npm run perf                                 # terminal 2, oczekiwany kod 0
```

## Stan środowiska

Bez zmian: kontener `mc-pg` na porcie 5433 z bazami `marketing`, `marketing_perf`,
`marketing_test`, `marketing_preview`. `psql` tylko przez `docker exec`, brak
`magick`, `compare` i `PIL`, tryb deweloperski na webpacku.

## Decyzje w toku

Bez zmian: publiczny adres środowiska podglądowego (F5-04), `DATABASE_URL` do
prawdziwej bazy, hosting (Vercel, czyje konto), plik `.xlsx` z osobami (F4-06),
potwierdzenie `docs/ARCHITEKTURA.md` przez usera, czyszczenie historii gita z danych
osobowych (F4-07, powiązane F7-23).

Commity paczki: `ff510c0` (F7-01), `498a6d5` (F7-02), `73c64bf` (F7-03),
`63d1464` (F7-04), `3da8b3e` (F7-05).
