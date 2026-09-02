# NEXT-TASKS - przekazanie do kolejnego workera

Stan na 2026-09-03, po **F4-00, F4-01, F4-02, F4-03**. Fazy F0 do F3 zamknięte
wcześniej (opis w `DECISIONS.md`).

## Następne issue

**F4-04** `import` `ui` Ekran importu: kroki 1 do 4 (wybór pliku, mapowanie, suchy
przebieg). CZYTAJ: `plan/04-import-excel.md` sekcje 2, 6 i 7, `plan/05-ui-system.md`
sekcje 2 i 3. Potem **F4-05**, potem **F4-07**.

**F4-06** nadal `ZABLOKOWANE`: czeka na prawdziwy plik `.xlsx` od usera. Nie robić,
nie odhaczać. Fixture syntetyczny wystarcza całej reszcie fazy.

## Co zastajesz po F4-00 do F4-03

**Schemat osób wyrównany.** Migracja `drizzle/migrations/0003_confused_penance.sql`,
wyłącznie `ADD COLUMN ... text`, wszystko dopuszcza `null`:
`artists.location` oraz `videographers.handle`, `email`, `phone`, `location`, `status`.
Migracja przepuszczona przez trzy bazy: `marketing`, `marketing_perf`, `marketing_test`.
Stare `videographers.contact` NIE jest ruszone, przeniesienie danych to nowe issue
**F7-19**.

**`npm run pg:info` wypisuje teraz także kolumny** (sekcja `kolumny`), bo wcześniej
pokazywał tylko indeksy i liczby wierszy, więc kryterium F4-00 nie było sprawdzalne.

**Warstwa importu, cztery pliki w `src/lib/import/`:**
- `normalize.ts` - wiersz arkusza na osobę, reguły z `plan/04` sekcja 5.
  Wejście przechodzi przez Zod (`cellSchema`), więc komórka o dziwnym typie daje
  błąd wiersza, nie wyjątek. Zwraca `{kind: empty | ok | error}`.
- `dedup.ts` - `findDuplicate` (handle, email, nazwa plus lokalizacja, zawsze
  w obrębie jednej roli) i `planRow` (insert, update, skip). Duplikat prawdopodobny
  nigdy nie jest aktualizowany automatycznie. `buildChanges` bierze tylko pola
  niepuste w arkuszu i różne od bazy, więc pusta komórka nie kasuje danych.
- `mapping.ts` - aliasy nagłówków, `autoMap`, `mappingConflicts`, `toRawRow`.
  `status` nie jest proponowany dla roli twórcy.
- `parse.ts` - `checkFile` (rozszerzenie, 10 MB) sprawdzany PRZED otwarciem pliku,
  `parseWorkbook` na `exceljs`, limity 5000 wierszy i 60 kolumn per arkusz.

**Fixture:** `npx tsx scripts/make-fixture-xlsx.ts` tworzy `tests/fixtures/osoby.xlsx`,
2 arkusze, 1131 wierszy syntetycznych z błędami i duplikatami. Dane generowane
z licznika (`@atrapa_0001`, domena `przyklad.test`). Zero prawdziwych osób.
`scripts/import-people.ts` nadal ma prawdziwe dane, to jest F4-07 - nie kopiuj z niego.

**Pomiar importu:** `npx tsx scripts/perf/measure-import.ts`, trzy przebiegi,
mediana. Dziś 66 ms na 1010 wierszy przy progu 3000 ms.

## Liczby, do których porównujesz

`npm run perf` kod **0**, bundel `/calendar` **292,2 kB** przy progu 301,6 kB.
`npm run lint` kod 0, **108 ostrzeżeń**, 0 błędów. `npm run typecheck` kod 0.
`npm run test` **115 zielonych** (było 29). `node scripts/check-typography.mjs` kod 0.
`npx playwright test` 8 zielonych (przy `npm run dev` na porcie 3000, patrz F7-18).
Szum czasowy do 40%, próg szumu zrzutów 1 155 do 1 680 pikseli z 7 823 808.

## Pułapki z tej paczki

1. **Na porcie 3000 stał osierocony `next-server` z poprzedniej sesji.** `perf:serve`
   zbudował projekt i padł na `EADDRINUSE` dopiero po pełnym buildzie, czyli po kilku
   minutach. Przed `perf:serve` sprawdź `lsof -nP -iTCP:3000 -sTCP:LISTEN`.
2. **Nowy plik w `src/` łapie lint jako błąd, nie ostrzeżenie.** `normalizeRow` miało
   złożoność 15, `cellValue` 12. Naprawa u źródła: wydzielone `normalizeChecked`,
   `toPerson`, `objectCellValue`. Do listy grandfathera się nie dopisuje.
3. **`check-typography.mjs` patrzy też na nazwy testów.** Długi myślnik w `describe(...)`
   to trafienie Z7. W testach używaj krótkiego myślnika z odstępami.
4. **Testy z `exceljs` muszą mieć `// @vitest-environment node`** w pierwszej linii,
   bo domyślne środowisko projektu to jsdom.
5. **Sam brak modułu to słaby czerwony.** Po napisaniu testów przed kodem robiłem
   dodatkowo mutację gotowej implementacji i sprawdzałem, że pada właściwa liczba
   testów (6 z 29 i 6 z 13). Bez tego „czerwony" znaczy tylko tyle, że pliku nie ma.

## Jak uruchomić

```
docker start mc-pg
npm run dev                 # webpack, port 3000
npx tsx scripts/make-fixture-xlsx.ts        # fixture importu
npx tsx scripts/perf/measure-import.ts      # pomiar suchego przebiegu
node scripts/check-typography.mjs           # bramka Z5, Z6, Z7
lsof -nP -iTCP:3000 -sTCP:LISTEN            # ZAWSZE przed perf:serve
npm run perf:serve          # terminal 1
npm run perf                # terminal 2, oczekiwany kod 0
```

## Stan środowiska

Bez zmian poza jedną nową zależnością: **`exceljs` 4.4.0** (uzasadnienie w `DECISIONS.md`,
sekcja „F4 - import osób z arkusza"). Baza w kontenerze `mc-pg` (port 5433, bazy
`marketing`, `marketing_perf`, `marketing_test`), `psql` tylko przez `docker exec`,
brak `magick`/`compare`/`PIL`, `.env.local` poza gitem, tryb deweloperski na webpacku.

## Decyzje w toku

Bez zmian: `DATABASE_URL` do prawdziwej bazy, hosting (Vercel), plik `.xlsx`
z osobami (F4-06), potwierdzenie `docs/ARCHITEKTURA.md` przez usera.

## Znaleziska w F7

**F7-01** do **F7-19**, żadne nie blokuje. Nowe w tej paczce:
- **F7-19** - przeniesienie danych z `videographers.contact` do `handle` i `email`
  (36 niepustych `contact` na 60 kamerzystów w bazie pomiarowej).

Commity paczki: `e977ffa` (F4-00), `552f504` (F4-01), `4d8c25b` (F4-02), `9a77ab2` (F4-03).
