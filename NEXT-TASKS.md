# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F7-27, F7-28, F7-29, F7-30, F7-31, F7-32**. To była ostatnia
paczka fazy F7. Wcześniej zamknięte: F0 do F6 w całości oraz F7-01 do F7-26.

## Co zostaje otwarte i dlaczego

Wyłącznie sprawy czekające na usera. Żadna nie jest robotą do wzięcia:

- **F7-23** — czyszczenie historii gita z dwóch prawdziwych handle z Instagrama.
  Czeka na decyzję usera, bo przepisanie historii jest jednokierunkowe.
- **F7-44** — wiersze arkusza bez imienia, znane wyłącznie z handle na Instagramie.
  Dwie drogi opisane w issue, rekomendacja: podstawiać handle jako nazwę.
- **F7-45** — kolumna statusu w arkuszu twórców nie ma odpowiednika w `artists`.
- **F7-29** — czy czas oglądania i CTR z arkuszy mają być widoczne na `/analytics`.
  Koszt obu wariantów opisany w `DECISIONS.md`. W `src/lib/csv-mappers.ts` stoi już
  komentarz mówiący wprost, których kolumn nie czytamy — samo znalezisko nie szkodzi.
- **F5-04** — publiczny adres środowiska podglądowego.
- **F8-01 do F8-03** — bramka decyzyjna, pętla ma tu stanąć i zapytać.

**DoD F7 spełnione:** każde znalezisko ma issue, każde issue ma dyspozycję.

## Co zastajesz po tej paczce

**Uchwyt „Start produkcji" jest dokładny co do dnia** (F7-27). `getFirstPeriodStart`
liczy się od DNIA `t0At`, nie od poniedziałku jego tygodnia, a `shiftProductionT1Start`
woła tę samą funkcję zamiast liczyć po swojemu. Wcześniej przesunięcie o 1..6 dni
zmieniało bazę, ale nie zmieniało pola, więc każde powtórzenie dokładało kolejną deltę
(zmierzone: cztery „nic nie robiące" edycje przesunęły produkcję o 8 dni). Pas ganta
zostaje tygodniowy — `getStepWeekRange` bez zmian, uchwyt jest jedynym miejscem
liczonym dziennie. Scenariusz `e2e/f7-27-start-produkcji.spec.ts` pilnuje n = 1, 2, 3
i powtórki; jego nazwa zaczyna się od `f7`, żeby biegł PRZED `import-osoby.spec.ts`,
który kaskadą kasuje produkcje.

**Pomiar ganta biegnie tylko na budowaniu produkcyjnym** (F7-28). `/api/health` oddaje
teraz `dev`, a `e2e/gantt-filter.spec.ts` robi `test.skip` na serwerze deweloperskim.
**Pełny `npx playwright test` daje więc `22 passed, 1 skipped`, nie 23 zielone.**
Żeby zmierzyć: `npm run perf:serve` w jednym terminalu i
`E2E_EXPECTED_DB=marketing_perf npx playwright test e2e/gantt-filter.spec.ts` w drugim.

**Przepisy dla agentów wreszcie działają** (F7-30). Server actions są nieosiągalne
z `tsx` — wszystkie cztery moduły plus `src/lib/files.ts`. Do tego `npx tsx -e` z
`await` na najwyższym poziomie **nigdy** nie działał (CJS). Wzorzec, który przechodzi,
stoi w `CLAUDE.md` i w każdej personie: heredoc do pliku `.ts`, `async function main()`,
walidacja schemą Zod z `src/server/actions/schemas.ts`, zapis przez `db.insert`.

**Kolory pasm T mają jedno źródło** (F7-31). `FRAME_STYLE` dostała pole `accentBorder`.

**Kamerzyści czytają własne kolumny** (F7-32). `handle`, `email`, `phone` z migracji
0003; `contact` to już tylko pole zapasowe, a jego kształt rozpoznaje `contactField`.
`--clear-contact` jest odtąd bezpieczne — F7-19 domknięte.

## Liczby, do których porównujesz

`npm run typecheck` kod 0. `npm run lint` kod 0, **36 ostrzeżeń**, 0 błędów.
`npm run test` **224 zielone w 20 plikach**. `node scripts/check-typography.mjs` kod 0.
`node scripts/check-trust-boundaries.mjs` kod 0, **73** punkty wejścia.
`npm run perf` kod 0, bundel `/calendar` **293,3 kB** przy progu 301,6 kB.
`npx playwright test` **22 zielone + 1 pominięty** w 1,6 min.
`node scripts/a11y-audit.mjs` **0 naruszeń**.

Uczciwy licznik ostrzeżeń, `grep` kłamie:
`npx eslint . -f json | jq '[.[].messages[]|.ruleId]|group_by(.)|map({r:.[0],n:length})'`.

## Pułapki

1. **Ubij `npm run dev` przed `npx playwright test`.** Ubij też `npm run perf:serve`.
2. **Server actions nie importują się do `tsx`** — patrz `CLAUDE.md`, sekcja o bazie.
3. **`npx tsx -e "...await..."` pada na CJS.** Pisz do pliku `.ts` z `async main()`.
   `.mts` nie pomaga: nie widzi nazwanych eksportów z modułów `.ts`.
4. **`git stash push -u` zabiera Twoje skrypty pomocnicze.** Używaj `git stash push -- src/`.
5. **Zrzuty do porównań rób w oknie 1280x720**, nie `fullPage`. Dwa przebiegi na tym
   samym kodzie dają **0** różnych pikseli, więc każdy niezerowy wynik jest realny.
6. **Do złożoności cyklomatycznej liczą się `?.` i `??`.** Ciąg `a ?? b ?? c` w JSX-ie
   potrafi wywalić bramkę lintu — wynoś do czystej funkcji od razu.
7. **`npm run perf:dev` kasuje `.next`.** Kolejność: perf:dev, potem `npm run perf:serve`.
8. **`npm run perf:serve` robi `next build`** (ok. 90 s, gotowy po ~150 s razem ze startem).
   Przed startem sprawdź `lsof -nP -iTCP:3000 -sTCP:LISTEN`.
9. **Własne utility CSS musi trafić do `extendTailwindMerge`** (`src/lib/utils.ts`).
   `@utility` z zagnieżdżonym `@media (pointer: coarse)` Tailwind v4 nie generuje wcale.
10. **Zrzuty `screenshots/F5/*.png` zmieniają się przy każdym przebiegu e2e.**
    Przed commitem `git checkout screenshots/F5`. To dane z bazy testowej.
11. **`npx prettier --write` przeformatuje plik na cudzysłowy podwójne.** Nie uruchamiaj.
12. **`dotenv` nie nadpisuje kluczy już obecnych w `process.env`.**

## Jak uruchomić

```
docker start mc-pg
npm run dev                                  # turbopack, port 3000, baza robocza
pkill -f "next dev" && npx playwright test   # 22 zielone + 1 pominięty, własna baza testowa
node scripts/check-trust-boundaries.mjs
node scripts/check-typography.mjs
node scripts/a11y-audit.mjs                  # wymaga serwera na 3000
lsof -nP -iTCP:3000 -sTCP:LISTEN             # ZAWSZE przed perf:serve
npm run perf:serve                           # terminal 1 (ubij przed e2e)
npm run perf                                 # terminal 2, oczekiwany kod 0
```

## Stan środowiska

Kontener `mc-pg` na porcie 5433 z bazami `marketing`, `marketing_perf`,
`marketing_test`, `marketing_preview`. `psql` tylko przez `docker exec`.
Baza robocza `marketing`: produkcja 80 ma `t0_at = 2026-09-14 10:00+00` (przywrócona
po odtwarzaniu F7-27), kamerzystów zero, wpisów kalendarza i kampanii bez śmieci
po weryfikacjach tej paczki. `marketing_perf` celowo nietknięta.
