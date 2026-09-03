# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F7-11, F7-12, F7-13, F7-14, F7-15**. Wcześniej zamknięte:
F0 do F6 w całości oraz F7-01 do F7-10. Poza F7 otwarte są tylko dwa issues czekające
na usera: **F4-06** (prawdziwy plik `.xlsx`) i publiczny adres w **F5-04**.
Nie ruszać żadnego z nich.

## Co zastajesz po tej paczce

**Cache Components odrzucone drugi raz i to jest zamknięte na dobre** (F7-11).
Nie „utonęło w szumie", tylko sufit zysku jest niższy niż próg kryterium: cały odczyt
katalogu `agents` z bazy to **0,412 ms przy p95 strony 8,5 ms, czyli 4,8 procent**.
Nawet cache o zerowym koszcie nie da wymaganych 10 procent. Wraca dopiero przy zdalnej
bazie albo katalogu większym o dwa rzędy wielkości. Przepis techniczny nadal leży
w `DECISIONS.md` pod „F1-03".

**`npm run dev` to teraz TURBOPACK, webpack przeniósł się pod `dev:alt`** (F7-14).
Objaw z F2-05 (znikająca siatka dni w pasach T) **nie występuje na dzisiejszym kodzie**:
zrzut samego pasa z dev-turbopacka wobec `next start` to 0 różnych pikseli. Podejrzany
z issue, modyfikator alfa Tailwinda, był niewinny — tło pasa to w obu bundlerach
`oklab(0.962 -0.0058 0.0587 / 0.55)`. Jedyna zmierzona różnica: lightningcss
w turbopacku przepisuje `--border` z `oklch` na równoważne `lab`. HMR **466 ms**
zamiast 1961 ms.

**Gant wypisany z listy grandfather w całości** (F7-13). Wszystkie pięć ścieżek
`src/components/calendar/gantt-*` zniknęło z `eslint.config.mjs`; żadna funkcja w tych
plikach nie przekracza złożoności 10. Trafień `complexity` **40 → 33**, ostrzeżeń lintu
**44 → 37**. Zegar zjechał propem: `todayMs` liczone w `src/app/calendar/page.tsx`
(komponent serwerowy, jedno `eslint-disable` z uzasadnieniem) i podawane `GanttView`,
więc `Date.now()` zniknęło z renderu klienta. Kaskada „kroki po kolei" była wpisana
dwa razy — jest raz, jako `cascadeOverrides` i `statusAfterCascade`
w `gantt-geometry.ts`, z testami.

**Mikro-etykieta sekcji ma kanon: sześć utility w `src/app/globals.css`** (F7-15) —
`label-micro`, `label-micro-wide`, `label-micro-wider`, `label-mini`, `label-mini-wide`,
`label-mini-wider`. Zastąpiły 90 ręcznie wpisanych łańcuchów w 37 plikach. Nie wpisuj
`text-[10px] uppercase tracking-[0.14em]` z ręki, weź klasę. Tabela w `plan/05`
sekcja 3b. **Nowe utility MUSI trafić do `extendTailwindMerge` w `src/lib/utils.ts`** —
patrz pułapka 10 niżej.

## Liczby, do których porównujesz

`npm run typecheck` kod 0. `npm run lint` kod 0, **37 ostrzeżeń** (było 44), 0 błędów.
Rozbicie: `complexity` **33**, `react-hooks/exhaustive-deps` 2,
`@next/next/no-img-element` 1, `import/no-anonymous-default-export` 1.
`npm run test` **219 zielonych w 20 plikach** (było 216; trzy nowe na kaskadzie kroków).
`node scripts/check-typography.mjs` kod 0. `node scripts/check-trust-boundaries.mjs`
kod 0, 73 punkty wejścia. `npm run perf` kod 0, bundel `/calendar` **293,2 kB**
przy progu 301,6 kB. `npx playwright test` **22 zielone** na `next start`.
Tryb deweloperski (turbopack): `readyMs` 475, `firstCompileMs` 1162, `warmP50Ms` 205,
`hmrMs` 466, `peakRssMb` 1602.

Uczciwy licznik ostrzeżeń, `grep` kłamie:
`npx eslint . -f json | jq '[.[].messages[]|select(.ruleId=="X")]|length'`.

## Największa zastana złożoność, gdyby ktoś chciał ją ruszyć

`ProductionStepRow` **46** (`src/components/productions/production-step-row.tsx:75`)
i `CalendarPage` **43** (`src/app/calendar/page.tsx:75`). To komponenty po kilkaset
linii; podział zmienia strukturę renderu, więc potrzebuje własnego issue i własnego
dowodu wizualnego. Wzorzec, który zadziałał w F7-13: wyjąć pochodne wyliczenia
(łańcuchy `?:` i `??`) na poziom modułu jako czyste funkcje, potem podzielić JSX
na podkomponenty. Dowód: zrzut przed i po plus porównanie długości odpowiedzi HTML.

## Znaleziska w F7

Zamknięte: **F7-01 do F7-15**. Otwarte: **F7-16 do F7-31**. Nowe z tej paczki:

- **F7-31** - `accentBorderFor` w `gantt-frames.tsx` ma wpisane wprost
  `border-amber-400` / `violet` / `emerald`, obok tabeli `FRAME_TONE` zbudowanej
  z `FRAME_STYLE`. Literały pochodzą z F2-02, F7-13 tylko je przeniosło.
  Naprawa wymaga dołożenia pola do `FRAME_STYLE`, bo odcienia 400 bez przezroczystości
  tam dziś nie ma. Waga **drobne**.

Żadne nie blokuje.

## Pułapki

1. **`npx playwright test` bierze serwer z portu 3000** (`reuseExistingServer: true`).
2. **e2e MUSI biec na `npx next start`, nie na `npm run perf:serve`.** Zmierzone:
   na serwerze perfowym (baza `marketing_perf`, 500 produkcji) padają dwa scenariusze
   tworzenia — `f5-scenariusze.spec.ts:88` i `revalidate.spec.ts:99`. To nie regresja,
   to inna baza. Na `next start` z bazą roboczą wszystkie 22 są zielone.
3. **Nie da się zaimportować server action do `tsx`** (F7-30). Do ad-hoc zapisów `db`
   z `src/lib/db.ts`, wołane tak:
   `set -a; . ./.env.local; set +a; npx tsx skrypt.ts`.
4. **`git stash push -u` zabiera Twoje skrypty pomocnicze.** Używaj
   `git stash push -- src/`. Skrypty pomocnicze trzymaj w katalogu repozytorium
   (poza nim `npx tsx` nie znajdzie `playwright`) i kasuj przed commitem.
5. **Zrzuty do porównań rób w oknie 1280x720**, nie `fullPage`. Porównanie:
   `node scripts/perf/pngdiff.mjs a.png b.png`. **Zmierzone: dwa przebiegi zrzutu na
   TYM SAMYM budowaniu dają 0 różnych pikseli**, a dwa budowania tego samego kodu
   też 0 — więc próg szumu 1155–1680 jest zawyżony, każdy niezerowy wynik warto
   obejrzeć. Wyjątek: `/productions` ma 64 piksele szumu z danych.
6. **`npx prettier --write` przeformatuje plik na cudzysłowy podwójne.** Nie uruchamiaj.
7. **Do złożoności cyklomatycznej liczą się `?.` i `??`.**
8. **`npm run perf:dev` kasuje `.next`**, więc po nim `npm run perf` pada na braku
   budowania. Kolejność: najpierw perf:dev, potem `npm run perf:serve`.
9. **`npm run perf:serve` robi `next build`.** Przed jego startem sprawdź
   `lsof -nP -iTCP:3000 -sTCP:LISTEN` i ubij to, co tam stoi.
10. **Własne utility CSS musi być zgłoszone do `tailwind-merge`.** Bez wpisu
   w `extendTailwindMerge` (`src/lib/utils.ts`) `cn()` nie widzi kolizji z `text-sm`
   z wariantu `Button` i zostawia obie klasy: rozmiar wygrywa Twój, ale wysokość
   wiersza zostaje po `text-sm`. Kosztowało 1 512 różnych pikseli na każdej stronie.
11. **Zrzuty `screenshots/F5/*.png` zmieniają się przy każdym przebiegu e2e.** Przed
   commitem `git checkout screenshots/F5`.
12. **`perf/baseline.json` jest jedynym zapisem stanu „przed"** dla siedmiu starszych
   stron. Nie nadpisuj go dla nich.

## Jak uruchomić

```
docker start mc-pg
npm run dev                                  # turbopack, port 3000
npm run dev:alt                              # webpack, gdy potrzebny
npm run build && npx next start -p 3000      # PRZED e2e
npx playwright test                          # 22 zielone
node scripts/check-trust-boundaries.mjs
node scripts/check-typography.mjs
lsof -nP -iTCP:3000 -sTCP:LISTEN             # ZAWSZE przed perf:serve
npm run perf:dev                             # kasuje .next, rób jako pierwsze
npm run perf:serve                           # terminal 1 (ubij przed e2e)
npm run perf                                 # terminal 2, oczekiwany kod 0
npm run pg:info                              # liczby wierszy w bazie pomiarowej
```

## Stan środowiska

Bez zmian: kontener `mc-pg` na porcie 5433 z bazami `marketing`, `marketing_perf`,
`marketing_test`, `marketing_preview`. `psql` tylko przez `docker exec`, brak
`magick`, `compare` i `PIL`.

## Decyzje w toku

Bez zmian: publiczny adres środowiska podglądowego (F5-04), `DATABASE_URL` do
prawdziwej bazy, hosting, plik `.xlsx` z osobami (F4-06), potwierdzenie
`docs/ARCHITEKTURA.md` przez usera, czyszczenie historii gita z danych osobowych
(F4-07, powiązane F7-23), kolumny na czas oglądania i CTR w `posts` (F7-29).
