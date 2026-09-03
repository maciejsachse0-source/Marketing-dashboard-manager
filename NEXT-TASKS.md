# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F7-16, F7-17, F7-18, F7-19, F7-20**. Wcześniej zamknięte:
F0 do F6 w całości oraz F7-01 do F7-15. Poza F7 otwarte są tylko dwa issues czekające
na usera: **F4-06** (prawdziwy plik `.xlsx`) i publiczny adres w **F5-04**.
Nie ruszać żadnego z nich.

## Co zastajesz po tej paczce

**`src/components/ui/card.tsx` już nie istnieje** (F7-16). Znalezisko mówiło o trzech
martwych komponentach; `badge.tsx` i `table.tsx` dostały odbiorców w F4 (ekrany importu),
więc martwy był jeden. Wariant „migrujemy jedenaście ręcznych kart na `Card`" odpadł
liczbowo: `Card` rysuje `ring-1 ring-foreground/10`, zastane karty `border border-border`,
a pierścień leży na zewnątrz pudełka — każda karta przesunęłaby się o piksel na krawędź.

**Katalog agentów i szablonów NIE mieszka już w `data/*.json`** (F7-17). To najważniejsza
rzecz z tej paczki. Źródłem prawdy dla ekranu są tabele `agents`, `production_templates`
i `marketing_templates`; pliki JSON to materiał do ponownego zasiewu
(`drizzle/seed-catalog.ts`). Poprawka tekstu wyłącznie w pliku **nie zmienia niczego
na ekranie**. Jeśli ruszasz treść katalogu, ruszasz oba miejsca.

**Z7 obowiązuje teraz także w `data/**/*.json`** — poza kluczem `systemPrompt`
(idzie do modelu, ma zostać bajt w bajt) i poza katalogami `_backup*`.
`scripts/check-typography.mjs` to egzekwuje, `plan/01` ma zapisany zakres.

**`npx playwright test` nie ruszy na cudzym serwerze** (F7-18). `e2e/global-setup.ts`
pyta `/api/health` o nazwę bazy i porównuje z `DATABASE_URL` runnera; przy niezgodności
przerywa z komunikatem, co stoi na porcie. Koszt: jedno żądanie, **28 ms**. Nadpisanie
oczekiwania: `E2E_EXPECTED_DB`. Pułapka 1 z poprzedniego przekazania jest tym załatwiona,
ale pułapka „ubij perf:serve przed e2e" zostaje — teraz dostajesz o niej komunikat
zamiast dwóch czerwonych testów.

**`check-trust-boundaries.mjs` przestał żądać schematu Zod od handlera bez parametru.**
Ta sama reguła, którą miał od początku dla akcji serwerowych: brak argumentów to brak
wejścia. Punktów wejścia **74**, bez schematu mimo argumentów **0**.

**`scripts/split-videographer-contact.ts` gotowy, ale nie odpalony na prawdziwych
danych** (F7-19), bo ich nie ma: baza robocza `marketing` ma **zero** kamerzystów.
Liczba 36 z treści znaleziska pochodzi z baz syntetycznych. Skrypt sprawdzony na kopii
`marketing_perf` z siedmioma dosypanymi wierszami: 43 wiersze dały **email 36, handle 2,
phone 2, konflikt 1, nierozpoznane 2**; po zapisie `contact` niepusty nadal 43
(odwracalność), po osobnym `--clear-contact` zostają 3 (dwa nierozpoznane, jeden
konflikt). Reguła rozpoznawania to `contactField` w `src/lib/import/normalize.ts`,
z testami.

**Nie odpalaj `--clear-contact` na prawdziwej bazie, dopóki żyje F7-32.** Interfejs
kamerzystów i karta produkcji czytają wyłącznie `contact`; wyczyszczenie kolumny
opróżni karty, choć dane będą w bazie obok.

**Zwinięte pola wyboru na formularzu agenta pokazują etykiety** (F7-20).
`grep -rn 'SelectValue />' src/components` zwraca `0`. Base UI renderuje domyślnie
surowy `value` — pamiętaj o formatterze przy każdym nowym `Select`.

## Liczby, do których porównujesz

`npm run typecheck` kod 0. `npm run lint` kod 0, **37 ostrzeżeń** (bez zmiany), 0 błędów.
Rozbicie: `complexity` 33, `react-hooks/exhaustive-deps` 2, `@next/next/no-img-element` 1,
`import/no-anonymous-default-export` 1.
`npm run test` **223 zielone w 20 plikach** (było 219; cztery nowe na `contactField`).
`node scripts/check-typography.mjs` kod 0. `node scripts/check-trust-boundaries.mjs`
kod 0, **74** punkty wejścia. `npm run perf` kod 0, bundel `/calendar` **293,2 kB**
przy progu 301,6 kB. `npx playwright test` **22 zielone w 24,9 s** na `next start`.

Uczciwy licznik ostrzeżeń, `grep` kłamie:
`npx eslint . -f json | jq '[.[].messages[]|.ruleId]|group_by(.)|map({r:.[0],n:length})'`.

## Znaleziska w F7

Zamknięte: **F7-01 do F7-20**. Otwarte: **F7-21 do F7-32**. Nowe z tej paczki:

- **F7-32** - ekran kamerzystów (`videographers-shell.tsx`, `videographer-dialog.tsx`)
  oraz `productions/[id]/page.tsx` i `productions-list.tsx` czytają wyłącznie stare
  `contact`; `videographers-shell.tsx` trzyma przy tym własną kopię reguły
  (`contact.includes('@')`) obok `contactField`. Waga **ważne**, bo blokuje domknięcie
  F7-19 (czyszczenie `contact`).

Żadne nie blokuje pracy.

## Pułapki

1. **`npx playwright test` bierze serwer z portu 3000** (`reuseExistingServer: true`) —
   ale od F7-18 najpierw sprawdza bazę i przerywa z komunikatem.
2. **e2e MUSI biec na `npx next start`, nie na `npm run perf:serve`.**
3. **Nie da się zaimportować server action do `tsx`** (F7-30). Do ad-hoc zapisów
   `set -a; . ./.env.local; set +a; npx tsx skrypt.ts`.
4. **`git stash push -u` zabiera Twoje skrypty pomocnicze.** Używaj `git stash push -- src/`.
5. **Zrzuty do porównań rób w oknie 1280x720**, nie `fullPage`.
   Porównanie: `node scripts/perf/pngdiff.mjs a.png b.png`. Dwa przebiegi na tym samym
   kodzie dają **0** różnych pikseli, więc próg 1155 jest zawyżony i każdy niezerowy
   wynik trzeba obejrzeć. Wyjątek: `/productions` ma 64 piksele szumu z danych.
6. **`npx prettier --write` przeformatuje plik na cudzysłowy podwójne.** Nie uruchamiaj.
7. **Do złożoności cyklomatycznej liczą się `?.` i `??`.** Skrypt jednorazowy też ją
   łapie: `main()` z pętlą i pięcioma gałęziami wchodzi na 18 i to jest **błąd**, nie
   ostrzeżenie. Wynoś klasyfikację do czystej funkcji.
8. **`npm run perf:dev` kasuje `.next`.** Kolejność: perf:dev, potem `npm run perf:serve`.
9. **`npm run perf:serve` robi `next build`** (u mnie ok. 90 s). Przed startem sprawdź
   `lsof -nP -iTCP:3000 -sTCP:LISTEN`.
10. **Własne utility CSS musi trafić do `extendTailwindMerge`** (`src/lib/utils.ts`).
11. **Zrzuty `screenshots/F5/*.png` zmieniają się przy każdym przebiegu e2e.**
    Przed commitem `git checkout screenshots/F5`.
12. **`perf/baseline.json` jest jedynym zapisem stanu „przed"** dla siedmiu starszych stron.
13. **Skrypty pomocnicze trzymaj w katalogu repozytorium** (poza nim `npx tsx` nie znajdzie
    `playwright`) i kasuj przed commitem.
14. **`dotenv` nie nadpisuje kluczy już obecnych w `process.env`** — dlatego
    `DATABASE_URL=... npx tsx skrypt.ts` działa mimo `config({ path: '.env.local' })`
    w skrypcie. Tak testowałem migrację na kopii bazy.

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

Kontener `mc-pg` na porcie 5433 z bazami `marketing`, `marketing_perf`,
`marketing_test`, `marketing_preview`. `psql` tylko przez `docker exec`, brak
`magick`, `compare` i `PIL`. W `marketing_preview` kamerzyści mają już wypełniony
`email` z F7-19 (36 wierszy, `contact` nietknięty). `marketing_perf` celowo nietknięta,
bo na niej stoi punkt odniesienia pomiarów.

## Decyzje w toku

Bez zmian: publiczny adres środowiska podglądowego (F5-04), `DATABASE_URL` do
prawdziwej bazy, hosting, plik `.xlsx` z osobami (F4-06), potwierdzenie
`docs/ARCHITEKTURA.md` przez usera, czyszczenie historii gita z danych osobowych
(F4-07, powiązane F7-23), kolumny na czas oglądania i CTR w `posts` (F7-29).
