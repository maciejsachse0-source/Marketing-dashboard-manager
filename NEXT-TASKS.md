# NEXT-TASKS — przekazanie do kolejnego workera

Stan na 2026-09-02, po paczce F1-01, F1-02, F1-03, F1-04. **Faza F1 jest zamknięta.**

## Następne issue

**F2-01** `test` Testy przypinające zachowanie ganta przed refaktorem.
CZYTAJ: `plan/06-testy.md` sekcje 2 i 3, `src/components/calendar/gantt-view.tsx`.
Uwaga: testy mają przejść **na kodzie sprzed refaktoru**, więc pisze się je
zanim ruszysz `gantt-view.tsx`. Pozostałe w fazie F2: `plan/08-BACKLOG.md`,
kolejność jest prawem.

Bramka z F0 (`docs/ARCHITEKTURA.md` potwierdzony przez usera) nadal otwarta
i nadal nie blokuje niczego poza wdrożeniem.

## Co zrobiła faza F1, w trzech zdaniach

Baza dostała 13 indeksów, oba Seq Scany zniknęły. Trzy strony przestały czekać
na zapytania szeregowo, pula połączeń przestała być zabetonowana na 1.
Cache Components zostały włączone, zmierzone i **cofnięte**, bo pomiar nie
potwierdził hipotezy — pełny przepis techniczny leży w `DECISIONS.md`, wpis
„F1-03", i wraca jako F7-11.

Commity: `56db452` (F1-01), `b6a9673` (F1-02), `60dee67` (F1-03), `b6d63af` (F1-04),
`c2b3b6d` (raport fazy).

## Liczby, do których porównujesz w F2

`perf/baseline.json` jest **nieaktualny dla stron** — pochodzi sprzed F1.
Aktualne punkty odniesienia są w `DECISIONS.md`, sekcja „F1 — raport fazy",
kolumna „po F1-02". Najkrócej, p95 w ms: home 12,3; calendar 63,8;
calendar-table 26,5; productions 128,1; production-detail 23,1;
campaign-detail 30,7; analytics 27,5. Baza: wszystko poniżej 1,5 ms, `seqScan` nie.
Bundel `/calendar`: 354,8 kB po gzip, próg 301,6 kB — **to jest jedyny przekroczony
próg i to jest robota fazy F2** (kroki P7 i P8).

**Szum pomiarowy jest większy, niż się wydaje.** Ten sam przebieg potrafi dać
`calendar` 59,8 i 81,6 ms, `productions` 132,5 i 165,5. Bierz medianę z trzech
przebiegów, inaczej „poprawa o 20%" będzie zwykłym rozrzutem.

## Jak uruchomić pomiar

```
docker start mc-pg
npm run perf:serve      # terminal 1: next build + next start na bazie pomiarowej
npm run perf            # terminal 2: measure-db + measure-page + report
```

`npm run perf` kończy się kodem **1** i to jest stan oczekiwany: jedyny przekroczony
próg to rozmiar bundla. Progi bazodanowe i czasy stron są spełnione z zapasem.

Zrzut ekranu: `node scripts/perf/shot.mjs <prefiks> /sciezka [/inna]` loguje się
i zapisuje pełnostronicowe PNG do `screenshots/`. Powstał w F1-02, przydaje się
do dowodów „przed i po".

## Stan środowiska

- Baza to kontener Docker `mc-pg`, `postgres:17`, port hosta **5433**, user `postgres`,
  hasło `mc`. Bazy: `marketing` (robocza), `marketing_perf` (pomiarowa, zestaw L),
  `marketing_test` (testowa). Przed pracą: `docker start mc-pg`.
- **Baza robocza nie jest już pusta.** W F1-04 poszedł na nią `npm run db:seed:catalog`
  (3 szablony produkcji, 2 szablony kampanii, 6 agentów), a scenariusze e2e dosypują
  osoby, produkcje i kampanie przy każdym przebiegu. Testy nie sprzątają po sobie
  i nie muszą — nazwy mają znacznik czasu.
- Migracja `0002` jest zastosowana na wszystkich trzech bazach.
- `.env.local` istnieje, poza gitem, niesie komplet zmiennych. Doszła opcjonalna
  `DB_POOL_MAX` (domyślnie 10, na Vercelu i tak wymuszamy 1).
- ESLint stoi na **9.39.5**, nie na 10.
- `psql` nie istnieje na hoście: `docker exec mc-pg psql -U postgres -d <baza>`.

## Pułapki, na które już wdepnąłem

1. **Nie mierz na zimno i nie ufaj jednemu przebiegowi.** Punkt wyżej o szumie.
2. **Formularz logowania jest server action.** `measure-page.mjs` i `measure-dev.mjs`
   czytają pola `$ACTION_*` z HTML-a `/login`. Gdy Next zmieni ten kształt, padną
   z komunikatem „w HTML /login nie ma pól $ACTION_*".
3. **`next build` w 16.2.4 nie drukuje kolumn `Size` ani `First Load JS`.**
   Rozmiar bundla liczy `measure-page.mjs` na wydanej stronie.
4. **Nawiasy kwadratowe w `eslint.config.mjs`** trzeba escapować.
5. **`perf/runs/` jest w `.gitignore`**, `perf/baseline.json` i `perf/budget.json` nie.
6. **Kreator produkcji wymaga przypisanego artysty także dla typu „Solo"**, mimo że
   opis mówi „Twój content". Scenariusz e2e musi najpierw dodać osobę. Kreator
   kampanii wymaga wypełnionego pola „Wizja / cel narracji" — bez niego krok 2
   nie przepuszcza dalej i nie widać żadnego komunikatu w konsoli.
7. **Kroki produkcji nie mają roli `checkbox`.** To `<button>` z `aria-label`
   „Odhacz krok: …", po kliknięciu „Cofnij krok: …". Tak je adresuj w testach.
8. **`e2e` uruchamia `npm run dev`, jeśli nic nie stoi na porcie 3000**, ale
   `reuseExistingServer: true`, więc gdy chcesz mierzyć zachowanie produkcyjne,
   podnieś `npx next start` wcześniej.

## Decyzje w toku

- `DATABASE_URL` do prawdziwej bazy nadal nie dostarczony.
- Hosting: decyzja „naprawiamy Vercela czy porzucamy" należy do usera.
- Plik `.xlsx` z osobami (F4-06) nadal nie dostarczony.
- `docs/ARCHITEKTURA.md` czeka na potwierdzenie przez usera (bramka DoD F0).

## Znaleziska w F7

**F7-01** do **F7-11**, żadne nie blokuje. Nowe w tej paczce:
**F7-10** (zestaw L nie zasiewa katalogów: `production_templates`,
`marketing_templates` i `agents` mają w bazie pomiarowej po zero wierszy, więc
krok P3 był niemierzalny) oraz **F7-11** (powrót do Cache Components na danych,
które istnieją; gotowy przepis techniczny w `DECISIONS.md`, wpis „F1-03",
razem z trzema pułapkami Next 16, które kosztowały najwięcej czasu).
