# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F4-04, F4-05, F4-07**. Faza F4 zamknięta z jednym wyjątkiem:
**F4-06 zostaje ZABLOKOWANE**, czeka na prawdziwy plik `.xlsx` od usera. Nie robić,
nie odhaczać, nie wymyślać zastępczego arkusza. Fazy F0 do F3 zamknięte wcześniej.

## Następne issue

**F5-01** `test` Domknięcie zakresu minimalnego. CZYTAJ: `plan/06-testy.md` sekcja 3.
Potem reszta fazy F5 w kolejności z `plan/08-BACKLOG.md`.

## Co zastajesz po F4-04, F4-05 i F4-07

**Ekran `/import/osoby`, siedem kroków.** Wpięty w pasek boczny pod „Zespół".
Widok: `src/components/import/` (shell, dropzone, source, mapping, mapping-step,
preview, confirm, progress, summary, steps, hook zapisu, czytnik NDJSON).
Strona: `src/app/import/osoby/page.tsx`, ładuje osoby przez `src/lib/import/existing.ts`.

**Logika w `src/lib/import/`, nowe pliki tej paczki:**
- `dry-run.ts` - `dryRun(rows, mapping, role, existing, policy)`, funkcja czysta,
  oddaje liczniki, podgląd, listę błędów i plany wierszy. **Ten sam kod liczy podgląd
  w przeglądarce i plan zapisu na serwerze.** Nie dopisuj drugiej arytmetyki.
  Jest też `errorsToCsv` do pobrania błędów.
- `limits.ts` - `checkFile` i `IMPORT_LIMITS` wyjęte z `parse.ts`, bo strona sprawdza
  plik natychmiast, a `parse.ts` ciągnie `exceljs`, którego do bundla wpuścić nie wolno.
  `parse.ts` reeksportuje jedno i drugie, wołający ma jedno miejsce.
- `save.ts` - `savePlans(tx, role, plans, onBatch)`, wstawki paczkami po 100
  (`BATCH_SIZE`), aktualizacje po jednej. `onBatch(0, total)` leci przed pierwszym
  zapisem, żeby licznik nie pokazywał „0 z 0".
- `existing.ts` - osoby z bazy w kształcie dla wykrywania duplikatów.

**Dwie trasy API.** `POST /api/import/people` (multipart, Zod na nazwie i rozmiarze,
`checkFile`, dopiero potem `parseWorkbook`) oraz `POST /api/import/people/save`
(JSON, Zod na kształcie, plan liczony od zera na serwerze, zapis w jednym
`db.transaction`, odpowiedź to strumień NDJSON: linia po każdej zapisanej paczce,
na końcu `{"done":true,...}` albo `{"error":...}`).

**`scripts/import-people.ts` NIE ISTNIEJE.** Usunięty w F4-07. Dane osobowe zostają
w historii gita, czyszczenie historii to decyzja usera, opis w `docs/ARCHITEKTURA.md`
sekcja 9. Dwa prawdziwe handle nadal stoją w treści kryterium F4-07 w backlogu,
zapisane jako **F7-23**.

**Fixture ma teraz trzy arkusze:** „Twórcy", „Kamerzyści" i „Pusty" (sam nagłówek,
pod stan pusty ekranu). `npx tsx scripts/make-fixture-xlsx.ts`.

## Liczby, do których porównujesz

`npm run typecheck` kod 0. `npm run lint` kod 0, **108 ostrzeżeń**, 0 błędów.
`npm run test` **130 zielonych** (było 115). `node scripts/check-typography.mjs` kod 0.
`npx playwright test` **20 zielonych** (było 8). `npm run perf` kod 0, bundel
`/calendar` **292,5 kB** przy progu 301,6 kB.
Pomiary importu: parsowanie plus suchy przebieg 1010 wierszy **66 ms** (próg 3000),
zapis 1000 osób **56 ms** (próg 5000), wzrost RSS przy pliku 10,0 MB **50,5 MB**
(próg 300). Skrypty: `npx tsx scripts/perf/measure-import.ts`,
`npx tsx scripts/perf/measure-import-save.ts` (drugi wycofuje transakcję, nie
zostawia wierszy).
Szum czasowy do 40%, próg szumu zrzutów 1 155 do 1 680 pikseli z 7 823 808.

## Pułapki z tej paczki

1. **Zapis 975 wierszy trwa kilkadziesiąt milisekund.** Każda asercja e2e na przelotnym
   stanie widoku („pasek postępu widoczny") przegrywa wyścig raz na kilka przebiegów.
   Licznik paczek sprawdzamy na strumieniu, rysowanie w teście komponentu.
2. **`SelectValue` z Base UI pokazuje surową wartość, nie etykietę.** Bez
   `<SelectValue>{(v) => ETYKIETY[v]}</SelectValue>` w polu widać `artist` zamiast
   „Twórcy". Zastane pole w `agent-form.tsx` ma ten błąd do dziś, to **F7-20**.
3. **`Button` z `render={<Link/>}` wymaga `nativeButton={false}`**, inaczej Base UI
   krzyczy w konsoli i psuje semantykę. Taki element ma rolę guzika, nie linku, więc
   w teście szukaj go po `data-testid`, nie po `getByRole('link')`.
4. **E2E importu pisze do bazy roboczej `marketing`.** Sprząta po znaczniku `max(id)`,
   ale to łata (**F7-21**). Zastane `revalidate.spec.ts` i `stale-data.spec.ts` nie
   sprzątają w ogóle: każdy pełny przebieg dokłada pięć wierszy do `artists`.
5. **Drizzle wywraca transakcję przy `set({})`** komunikatem „No values to set".
   Duplikat pewny bez nowych wartości daje pusty zestaw zmian, `savePlans` liczy taki
   wiersz jako pominięty.
6. **Nowy plik w `src/` łapie lint jako błąd, nie ostrzeżenie.** `ImportShell` miał
   złożoność 14, naprawa przez wydzielenie kroków do osobnych komponentów, nie przez
   dopisanie się do listy grandfathera.

## Jak uruchomić

```
docker start mc-pg
npm run dev                                 # webpack, port 3000
npx tsx scripts/make-fixture-xlsx.ts        # fixture importu
npx tsx scripts/perf/measure-import.ts      # pomiar suchego przebiegu
npx tsx scripts/perf/measure-import-save.ts # pomiar zapisu i pamięci
node scripts/check-typography.mjs           # bramka Z5, Z6, Z7
lsof -nP -iTCP:3000 -sTCP:LISTEN            # ZAWSZE przed perf:serve
npm run perf:serve                          # terminal 1
npm run perf                                # terminal 2, oczekiwany kod 0
```

## Stan środowiska

Bez zmian: `exceljs` 4.4.0 jedyną nową zależnością fazy, baza w kontenerze `mc-pg`
(port 5433, bazy `marketing`, `marketing_perf`, `marketing_test`), `psql` tylko przez
`docker exec`, brak `magick`/`compare`/`PIL`, `.env.local` poza gitem, tryb
deweloperski na webpacku.

## Decyzje w toku

Bez zmian, plus jedna nowa: `DATABASE_URL` do prawdziwej bazy, hosting (Vercel),
plik `.xlsx` z osobami (F4-06), potwierdzenie `docs/ARCHITEKTURA.md` przez usera,
**czyszczenie historii gita z danych osobowych** (F4-07, opis w `docs/ARCHITEKTURA.md`
sekcja 9, powiązane F7-23).

## Znaleziska w F7

**F7-01** do **F7-23**, żadne nie blokuje. Nowe w tej paczce:
- **F7-20** - pole wyboru pokazuje surową wartość zamiast etykiety (`agent-form.tsx`).
- **F7-21** - testy e2e piszą do bazy roboczej, brak izolacji.
- **F7-22** - `AGENTS.md` wskazywał nieistniejący plik planu (wiersz importu poprawiony
  przy F4-07, kryterium sprawdza całą tabelę).
- **F7-23** - dwa prawdziwe handle z Instagrama zostały w treści kryterium F4-07.

Commity paczki: `4314295` (F4-04), `277e792` (F4-05), `202e9c7` (F4-07),
`b24aa3e` (stabilizacja licznika paczek w e2e).
