# NEXT-TASKS — przekazanie do kolejnego workera

Stan na 2026-09-02, po paczce F0-05, F0-06, F0-07. **Cała faza F0 jest zamknięta.**

## Uwaga zanim ruszysz: przed F1 stoi bramka

Definition of Done fazy F0 ma jeden punkt, którego worker nie domknie sam:
„`docs/ARCHITEKTURA.md` potwierdzony przez usera jako zgodny z jego wiedzą
o hostingu". Pytania do usera są wypisane w sekcji 2 tego dokumentu. Pozostałe
punkty DoD F0 są spełnione (szczegóły w raporcie fazy w `DECISIONS.md`).

To NIE blokuje F1: indeksy w bazie są niezależne od tego, gdzie stoi produkcja.
Blokują natomiast wszystko, co dotyka wdrożenia.

## Następne issue

**F1-01** `db` `perf` Indeksy na kolumnach filtrowanych i sortowanych (P1).
CZYTAJ: `plan/03-wydajnosc.md` sekcja 5 wiersz P1, `plan/01` zasada Z9.
Pozostałe w fazie F1: patrz `plan/08-BACKLOG.md`, kolejność jest prawem.

## Co już stoi i działa

Wszystkie osiem issues F0 odhaczone z dowodami, commit per issue. Ostatnie cztery:
`df91a7b` (F0-05), `6cd14df` (F0-06), `526aa52` (F0-07), `7342ef3` (raport fazy).

Komendy kończące się kodem 0: `npm run build`, `npm run dev`, `npm run typecheck`,
`npm run lint` (0 błędów, 205 ostrzeżeń, każde ma issue w F7), `npm run test`,
`npm run e2e`, `npm run pg:info`.

`npm run perf` kończy się kodem **1** i to jest stan oczekiwany, nie awaria:
raport wypisuje trzy przekroczone progi (dwa Seq Scany, rozmiar bundla). Po F1-01
mają zniknąć dwa pierwsze. `npm run perf` NIE jest częścią DoD fazy F0, ale JEST
częścią DoD F1 i każdej kolejnej.

## Jak uruchomić pomiar, bo kolejność ma znaczenie

```
docker start mc-pg
npm run perf:serve      # terminal 1: next build + next start na bazie pomiarowej
npm run perf            # terminal 2: measure-db + measure-page + report
```

Bez `perf:serve` w tle `measure-page.mjs` zmierzy albo serwer deweloperski (inne
liczby, bezwartościowe wobec budżetów), albo pustkę i skończy się kodem 1.
Pomiar trybu deweloperskiego stoi osobno, bo sam kasuje `.next` i sam podnosi dev:
`npm run perf:dev`, przy wyłączonych innych serwerach na porcie 3000.

## Liczby bazowe, do których porównujesz „przed i po"

`perf/baseline.json`, commit `f337f1f`, `mode: "local-docker"`.
Strony p95 (ms): home 21.7, calendar 64.3, calendar-table 30.2, productions 126,
production-detail 23.6, campaign-detail 39.2, analytics 34.8.
Baza p95 (ms): calendar-window 1.82 (**Seq Scan**), productions-list 1.04,
campaign-detail 0.83, posts-analytics 1.47 (**Seq Scan**).
Dev: ready 619, firstCompile 2603, warmP50 49, hmr 2079, peakRss 1510 MB.
Bundel `/calendar`: 354.8 kB po gzip, próg egzekwowany 301.6 kB, cel 350 kB.

## Stan środowiska

- **Baza to kontener Docker, nie hosting.** `mc-pg`, `postgres:17`, port hosta
  **5433**, user `postgres`, hasło `mc`. Bazy: `marketing` (robocza, **pusta**),
  `marketing_perf` (pomiarowa, zestaw L), `marketing_test` (testowa).
  Przed pracą: `docker start mc-pg`.
- Baza robocza jest pusta i to jest normalne: powstała od zera w F0-01. Strony
  na niej wyglądają na puste, a `/productions/1` zwraca 404. Do oglądania aplikacji
  z danymi używaj `npm run perf:serve`, bo on wpina serwer w bazę pomiarową.
- `.env.local` istnieje, jest poza gitem, niesie komplet zmiennych.
- ESLint stoi na **9.39.5**, nie na 10. Wersja 10 wysypuje `eslint-plugin-react`
  wbudowany w `eslint-config-next@16.2.4`. Nie podnoś bez sprawdzenia.
- `psql` nie istnieje na hoście. Do bazy albo przez `postgres-js`, albo przez
  `docker exec mc-pg psql -U postgres -d <baza>`.

## Pułapki, na które już wdepnąłem

1. **Nie mierz na zimno.** `measure-db.mjs` ma rozgrzewkę adaptacyjną,
   `measure-page.mjs` rozgrzewkę per URL (3 żądania). Bez tego pierwszy przebieg
   jest systematycznie wolniejszy i kryterium powtarzalności pada.
2. **Formularz logowania jest server action.** Samo `POST /login` z parą email
   plus hasło nie zadziała; Next wymaga jeszcze pól `$ACTION_REF_*`, `$ACTION_*`
   i `$ACTION_KEY`, które renderuje w HTML dla wersji bez JavaScriptu.
   `measure-page.mjs` i `measure-dev.mjs` czytają je z HTML-a. Gdy Next zmieni
   ten kształt, oba padną z komunikatem „w HTML /login nie ma pól $ACTION_*".
3. **Pomiar HMR łatwo sfałszować sobie samemu.** Pierwsze `GET` po zapisie pliku
   potrafi wrócić w 50 ms z wersji sprzed zmiany, bo obserwator plików jeszcze nie
   zauważył zapisu. `measure-dev.mjs` czeka na odpowiedź wyraźnie wolniejszą od
   rozgrzanej. Nie „upraszczaj" tego z powrotem.
4. **`next build` w 16.2.4 nie drukuje już kolumn `Size` ani `First Load JS`.**
   Rozmiar bundla liczy `measure-page.mjs` na wydanej stronie (suma gzip skryptów
   z `/_next/static` linkowanych przez `/calendar`). Powód: `DECISIONS.md`, F0-05.
5. **Nawiasy kwadratowe w `eslint.config.mjs`** trzeba escapować:
   `src/app/campaigns/\\[id\\]/page.tsx`, inaczej glob czyta je jako klasę znaków.
6. **Banner `dotenv` leci na stdout.** Wszystkie skrypty wołają `config({ quiet: true })`.
7. **`perf/runs/` jest w `.gitignore`**, `perf/baseline.json` i `perf/budget.json` nie.
   Raport dryfu porównuje z ostatnim plikiem w `runs/`, więc po `git clean` pierwszy
   przebieg nie ma z czym porównywać i dryfu nie pokaże. To nie jest błąd.

## Decyzje w toku

- `DATABASE_URL` do prawdziwej bazy nadal nie dostarczony. Gdy przyjdzie, baseline
  trzeba przemierzyć i zapisać z `mode` innym niż `local-docker`, bo obecne liczby
  nie zawierają czasu przelotu do bazy zdalnej.
- Hosting: GitHub potwierdza 29 wdrożeń na Vercel, ostatnie produkcyjne z 2026-05-03
  ma stan `failure`. Decyzja „naprawiamy czy porzucamy" należy do usera.
- Plik `.xlsx` z osobami (F4-06) nadal nie dostarczony, poza ścieżką krytyczną.

## Znaleziska w F7

**F7-01** do **F7-09**, żadne nie blokuje.
Nowe w tej paczce: **F7-08** (lewy pasek akcentu wbrew zasadzie Z8, w
`gantt-view.tsx:1586` i `help-dialog.tsx:362`; uwaga na fałszywe trafienia,
`gantt-view.tsx:1410` i `:1434` to linie drzewa i zostają) oraz **F7-09**
(`createCalendarEntry`, `updateCalendarEntry` i `deleteCalendarEntry` nie mają
żadnego wywołania z interfejsu, wpis kalendarza dodaje się dziś tylko skryptem).
