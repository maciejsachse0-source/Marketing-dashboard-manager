# NEXT-TASKS — przekazanie do kolejnego workera

Stan na 2026-09-02, po paczce F2-01 i F2-02. Faza F2 jest **w połowie**:
zostały F2-03, F2-04, F2-05, F2-06.

## Następne issue

**F2-03** `perf` ⚠ HARD Kontrakt danych ganta: koniec kształtu legacy (P6).
CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P6, `src/app/calendar/page.tsx`,
komentarz przy `productions.steps` w `drizzle/schema.ts`, pliki powstałe w F2-02.
Kolejność w `plan/08-BACKLOG.md` jest prawem.

Bramka z F0 (`docs/ARCHITEKTURA.md` potwierdzony przez usera) nadal otwarta
i nadal nie blokuje niczego poza wdrożeniem.

## Co zastajesz po F2-01 i F2-02

`src/components/calendar/gantt-view.tsx` miał 2545 linii i był jednym plikiem.
Teraz ma 187 i jest samym kontenerem. Mapa, żebyś nie szukał:

| Plik | Linie | Co w nim jest |
|---|---|---|
| `gantt-view.tsx` | 187 | kontener: legenda, nagłówek, pasek kampanii, pętla po wierszach |
| `gantt-header.tsx` | 174 | nagłówek osi: pasma miesięcy, tygodni i dni |
| `gantt-row.tsx` | 250 | wiersz produkcji: stan optymistyczny i złożenie warstw |
| `gantt-row-rail.tsx` | 141 | lewa szyna wiersza: awatar, nazwa, następny krok |
| `gantt-row-bands.tsx` | 206 | pasy T1/T2/T3, siatka dni, skróty do folderów, pinezki dat |
| `gantt-row-guides.tsx` | 106 | prowadnice w kształcie grabi pod kamieniami milowymi |
| `gantt-row-placement.ts` | 174 | **czysta** matematyka: rozmieszczenie kroków w pasmach (`buildDraft`) |
| `gantt-row-model.ts` | 192 | **czysta** matematyka: pasma, kamienie milowe, kroki, pinezki (`buildRowModel`) |
| `gantt-geometry.ts` | 193 | **czysta** arytmetyka osi + typ `GanttRow` |
| `gantt-stages.ts` | 170 | słownik `STAGE_CATEGORIES`, `STAGE_INDEX`, domyślne przesunięcia |
| `gantt-milestones.tsx` | 255 | pasek kamieni milowych + logika klikania fazy |
| `gantt-milestone-labels.tsx` | 113 | podpisy pod kamieniami |
| `gantt-substep-bar.tsx` | 294 | numerowany pasek podkroków + typ `SubStepInfo` |
| `gantt-expanded.tsx` | 256 | panel rozwinięty wiersza |
| `gantt-next-step.tsx` | 102 | karta „następny krok" |
| `gantt-legend.tsx` | 66 | legenda i nagłówki sekcji |
| `gantt-frames.tsx` | 48 | tabele kolorów pasm |

`gantt-geometry.ts` re-eksportuje wszystko z `gantt-stages.ts`, więc dla komponentów
`./gantt-geometry` pozostaje jedynym wejściem do matematyki ganta.

**Testy przypinające**: `src/components/calendar/__tests__/gantt-geometry.test.ts`,
14 testów w 6 grupach. Sprawdzają: pozycję kroku w oknie, krok przed oknem i za oknem,
granicę ostatniego dnia, źródło daty kamienia milowego (zapisana, pochodna, T-0,
domyślna), pasma w oknie tygodnia i kwartału, stan kategorii. Zero migawek drzewa.

## Kształt danych ganta, czyli o co chodzi w F2-03

Typ `GanttRow` mieszka teraz w `src/components/calendar/gantt-geometry.ts` (nie
w `gantt-view.tsx`, choć `gantt-view.tsx` go re-eksportuje, żeby nie ruszać importów
w `src/app/calendar/page.tsx`). Niesie **równolegle dwa kształty tych samych danych**:

- kształt legacy: `stepDates`, `customSteps`, `stepOrder` — syntezowany w
  `buildLegacyShape` w `src/app/calendar/page.tsx`,
- kształt docelowy: `steps: ProductionStep[]` — czyta go dziś tylko `gantt-expanded.tsx`.

Kto czyta legacy po podziale, czyli co realnie ruszasz w F2-03:
`gantt-row-placement.ts` (`row.customSteps`, `row.stepOrder`, `resolveCategorySequence`),
`gantt-geometry.ts` (`resolveStageDate` czyta `row.stepDates`), `gantt-expanded.tsx`.

**Pułapka licznika w kryterium.** Kryterium F2-03 mówi „`grep -r
'buildLegacyShape\|customSteps\|stepOrder' src/ | wc -l` zwraca 0 (dziś 27)". Dziś
zwraca **29**, bo dwa trafienia dołożył plik testowy z F2-01 (`makeRow` wypełnia
`customSteps: null` i `stepOrder: null`, bo typ `GanttRow` tego dziś wymaga).
Gdy skasujesz te pola z typu, fixture przestanie się kompilować. To **nie jest**
złamanie zasady „testy z F2-01 zielone bez modyfikacji ich treści": `makeRow` to
atrapa danych, nie asercja, a usunięcie z niej pól, które przestały istnieć,
niczego nie przypina inaczej. Żadna asercja nie wolno się ruszyć. Napisz to
w dowodzie i nie kombinuj z rzutowaniem typu.

Pozostałe trafienia poza gantem: `src/server/actions/production-steps.ts`,
`src/lib/production-steps.ts`, `src/lib/production-templates-types.ts` — sprawdź,
czy to ten sam dług, czy osobna sprawa; kryterium dopuszcza zostawienie trafienia
z komentarzem `ponytail:` i osobnym issue w F7.

## Jak dowodzić „wygląd niezmieniony"

Powstało `node scripts/perf/pngdiff.mjs <a.png> <b.png>` — porównanie dwóch zrzutów
piksel po pikselu. **Próg szumu na tej maszynie to 1050 pikseli z 7 823 808.** Tyle
różnią się dwa zrzuty tego samego, niezmienionego kodu po restarcie kompilacji
serwera deweloperskiego. Dwa zrzuty pod rząd bez restartu dają 0. Wynik poniżej
około 1100 to szum, nie regresja.

Zrzuty odniesienia dla fazy leżą w `screenshots/F2/`:
`przed-calendar-week.png`, `przed-calendar-quarter.png` (stan sprzed F2-01),
`po-F2-01-*`, `po-F2-02-*`. Nowe robisz tak:

```
node scripts/perf/shot.mjs F2/po-F2-03 '/calendar?view=week' '/calendar?view=quarter'
```

Nazwa pliku wyjdzie ze znakiem zapytania w środku; zmień ją na `-week` / `-quarter`,
inaczej cytowanie w kolejnych komendach będzie uciążliwe.

Kryterium F2-03 chce pięciu przypadków statusu (nowa, w połowie, z krokami własnymi,
ukończona, bez kroków). Baza robocza ma dziś kilkanaście produkcji generowanych przez
scenariusze e2e, prawie wszystkie w stanie „mail wysłany". Przygotuj sobie te pięć
przypadków skryptem `tsx` przed zrobieniem zrzutu „przed".

## Liczby, do których porównujesz

`perf/baseline.json` jest **nieaktualny dla stron** — pochodzi sprzed F1. Aktualne
punkty odniesienia: `DECISIONS.md`, sekcja „F1 — raport fazy", kolumna „po F1-02".
Najkrócej, p95 w ms: home 12,3; calendar 63,8; calendar-table 26,5; productions 128,1;
production-detail 23,1; campaign-detail 30,7; analytics 27,5.

Bundel `/calendar`: **354,8 kB po gzip, próg 301,6 kB** — to nadal jedyny przekroczony
próg i nadal robota tej fazy (kroki P7 i P8, czyli F2-05 i F2-06). F2-01 ani F2-02 nie
miały go ruszyć i nie ruszyły: podział pliku nie zmienia tego, co ląduje w paczce.

**Szum pomiarowy.** Rozrzut między przebiegami sięga 40%. Bierz medianę z trzech
przebiegów, inaczej „poprawa o 20%" będzie zwykłym rozrzutem.

## Jak uruchomić

```
docker start mc-pg
npm run dev             # webpack, port 3000
npm run perf:serve      # terminal 1: next build + next start na bazie pomiarowej
npm run perf            # terminal 2: measure-db + measure-page + report
```

`npm run perf` kończy się kodem **1** i to jest stan oczekiwany: jedyny przekroczony
próg to rozmiar bundla.

## Stan środowiska

- Baza to kontener Docker `mc-pg`, `postgres:17`, port hosta **5433**, user `postgres`,
  hasło `mc`. Bazy: `marketing` (robocza), `marketing_perf` (pomiarowa, zestaw L),
  `marketing_test` (testowa). Przed pracą: `docker start mc-pg`.
- Baza robocza nie jest pusta: katalogi z `npm run db:seed:catalog` plus osoby,
  produkcje i kampanie dosypywane przez scenariusze e2e przy każdym przebiegu.
  Testy nie sprzątają po sobie i nie muszą — nazwy mają znacznik czasu.
- Migracja `0002` zastosowana na wszystkich trzech bazach.
- `.env.local` istnieje, poza gitem, niesie komplet zmiennych.
- ESLint stoi na **9.39.5**. `npm run lint`: 0 błędów, 205 ostrzeżeń.
- `psql` nie istnieje na hoście: `docker exec mc-pg psql -U postgres -d <baza>`.
- Nie ma `magick` ani `compare` ani `PIL`. Do obrazków służy `scripts/perf/pngdiff.mjs`.

## Pułapki, na które już wdepnąłem

1. **Nie da się zaimportować `gantt-view.tsx` w vitest.** Łańcuch importów prowadzi
   przez server action do `src/lib/db.ts` i `src/lib/env.ts`, który rzuca
   `Invalid environment variables` przy samym imporcie. Dlatego czysta arytmetyka
   ganta mieszka w osobnych modułach `.ts` bez Reacta. Trzymaj to tak.
2. **Lista grandfather w `eslint.config.mjs`** zjeżdża `complexity` i kilka reguł
   `react-hooks` na `warn` dla wyliczonych ścieżek. Nowy plik z funkcją o złożoności
   powyżej 10 zrobi z `npm run lint` błąd, nie ostrzeżenie. Sześć ścieżek ganta
   dopisałem tam w F2-02 z komentarzem i bilansem; wypisanie się to F7-13.
   **Nie dopisuj do tej listy kolejnych ścieżek bez wpisu w `DECISIONS.md`.**
3. **`git stash -u` kasuje puste katalogi.** Straciłem tak raz katalog `__tests__`
   razem ze świeżym plikiem testu. Rób `git stash` dopiero po commicie.
4. **Nie mierz na zimno i nie ufaj jednemu przebiegowi.** Mediana z trzech.
5. **Formularz logowania jest server action.** `measure-page.mjs` i `measure-dev.mjs`
   czytają pola `$ACTION_*` z HTML-a `/login`. Gdy Next zmieni ten kształt, padną
   z komunikatem „w HTML /login nie ma pól $ACTION_*".
6. **`next build` w 16.2.4 nie drukuje kolumn `Size` ani `First Load JS`.**
   Rozmiar bundla liczy `measure-page.mjs` na wydanej stronie.
7. **Nawiasy kwadratowe w `eslint.config.mjs`** trzeba escapować.
8. **`perf/runs/` jest w `.gitignore`**, `perf/baseline.json` i `perf/budget.json` nie.
9. **Kreator produkcji wymaga przypisanego artysty także dla typu „Solo"**, mimo że
   opis mówi „Twój content". Kreator kampanii wymaga pola „Wizja / cel narracji" —
   bez niego krok 2 nie przepuszcza dalej i nie widać żadnego komunikatu w konsoli.
10. **Kroki produkcji nie mają roli `checkbox`.** To `<button>` z `aria-label`
    „Odhacz krok: …", po kliknięciu „Cofnij krok: …". Tak je adresuj w testach.
11. **`e2e` uruchamia `npm run dev`, jeśli nic nie stoi na porcie 3000**, ale
    `reuseExistingServer: true`, więc gdy chcesz mierzyć zachowanie produkcyjne,
    podnieś `npx next start` wcześniej.

## Decyzje w toku

- `DATABASE_URL` do prawdziwej bazy nadal nie dostarczony.
- Hosting: decyzja „naprawiamy Vercela czy porzucamy" należy do usera.
- Plik `.xlsx` z osobami (F4-06) nadal nie dostarczony.
- `docs/ARCHITEKTURA.md` czeka na potwierdzenie przez usera (bramka DoD F0).

## Znaleziska w F7

**F7-01** do **F7-13**, żadne nie blokuje. Nowe w tej paczce:
**F7-12** (martwy kod w gancie: `deriveEditingIso`, `subStageState` i dwa importy
bez odbiorcy — świadomie nietknięte, bo F2-02 wymagał podziału czysto mechanicznego)
oraz **F7-13** (wypisanie sześciu plików ganta z listy grandfather w ESLint).

Commity: `628bcac` (F2-01), `d4035dc` (F2-02).
