# DECISIONS — dziennik decyzji i obalonych hipotez

Format wpisu:

```
## <data> · <issue> · <tytuł decyzji>
Kontekst: co było do rozstrzygnięcia.
Rozważane: warianty, po jednym zdaniu.
Decyzja: co wybrano.
Dowód: liczby, komenda, plik. Dla decyzji wydajnościowych obowiązkowo przed i po.
Konsekwencja: co się zmienia w kodzie i co trzeba pamiętać później.
```

Obalona hipoteza wydajnościowa (zmiana, która nie poprawiła metryki o 10%) jest
normalnym wpisem, nie porażką. Zapisz ją, żeby nikt nie próbował drugi raz.

---

*(brak wpisów)*

## 2026-09-02 · F0-01 · Baza lokalna: kontener Docker zamiast bazy zdalnej
Kontekst: w chwili startu F0-01 w repozytorium nie było `.env.local`, więc `DATABASE_URL`
nie istniał. Wyzwalacz wariantu zapasowego z F0-01 zadziałał dosłownie.
Rozważane: (a) czekać na URL od usera i zatrzymać całą fazę F0; (b) postawić Postgresa
w Dockerze i trzy bazy w jednej instancji, zgodnie z zapisanym wariantem zapasowym.
Decyzja: (b). Kontener `mc-pg`, obraz `postgres:17`, port hosta 5433, hasło `mc`.
Trzy bazy w tej instancji: `marketing` (robocza), `marketing_perf` (pomiarowa),
`marketing_test` (testowa).
Dowód: `docker info` kod 0; `select 1` odpowiada na wszystkich trzech URL-ach;
`drizzle/migrate.ts` kod 0 na każdej z trzech baz; po migracji każda ma 12 tabel
w schemacie `public` (`select count(*) from information_schema.tables where table_schema='public'`).
Konsekwencja: pomiary z F0-03 i F0-05 powstają na lokalnym Postgresie 17 na dysku SSD
Maca, nie na hostingu produkcyjnym. Liczby są porównywalne między sobą (baseline i po
zmianie mierzone tak samo), ale NIE są prognozą czasów produkcyjnych, bo tam dochodzi
RTT do bazy zdalnej. Gdy user dostarczy prawdziwy `DATABASE_URL`, baseline trzeba
przemierzyć od nowa i zapisać z innym polem `mode`. Kontener trzeba wstać przed każdą
sesją pracy: `docker start mc-pg`.

## 2026-09-02 · F0-04 · Rozgrzewka harnessu bazodanowego: adaptacyjna zamiast stałej
Kontekst: kryterium F0-04 wymaga, żeby dwa przebiegi `measure-db.mjs` pod rząd różniły
się na p50 o mniej niż 10% dla każdego z 4 zapytań. Pierwsza wersja, dosłownie wg
`plan/03` sekcja 1.2 (rozgrzewka 2x, pomiar 7x), dawała rozjazd do 11,8%, a po
zwiększeniu próbek do 25 nadal do 42%.
Rozważane: (a) uznać, że przy zapytaniach rzędu 0,5 ms procent jest bez sensu i poluzować
kryterium; (b) znaleźć źródło rozjazdu i je usunąć.
Decyzja: (b). Pomiar rozkładu (200 próbek w trzech rundach w jednym procesie) pokazał,
że rozkład jest wąski (min 0,48, p50 0,53, p95 0,59 ms), ale PIERWSZA runda jest
systematycznie wolniejsza: p50 0,66 wobec 0,53 ms. Cztery kolejne przebiegi procesu
potwierdziły to samo na poziomie procesu: p50 przebiegu 1 to 1,86 / 0,96 / 0,63 ms,
a przebiegów 2 do 4 to 1,48 / 0,72 / 0,55 ms. Para 1 vs 2 rozjeżdżała się o 33%,
para 2 vs 3 o 1,9%. Zimne było więc środowisko (JIT node, cache serwera), nie zapytanie.
Rozgrzewka rozgrzewa teraz DOPÓKI czas rundy przestanie spadać (próg 2%, bezpiecznik
40 rund) zamiast wykonywać stałe 2 przejścia.
Dowód: po restarcie kontenera `mc-pg`, czyli przy naprawdę zimnym cache serwera,
trzy przebiegi pod rząd dają max różnicę p50 7,9% (1 vs 2) i 5,4% (2 vs 3), obie
poniżej progu 10%.
Konsekwencja: świadome odstępstwo od litery `plan/03` sekcja 1.2 (tam: rozgrzewka 2x,
pomiar 7x; tu: rozgrzewka adaptacyjna, pomiar 25x). Cel kryterium, czyli powtarzalność,
jest spełniony, a alternatywą było utrwalenie wiedzy plemiennej „pierwszy przebieg się
wyrzuca", która zawsze w końcu ginie. Liczby z zestawu L na lokalnym Postgresie 17
w Dockerze są o dwa rzędy wielkości niższe od budżetu p95 < 120 ms, więc budżet
zapytań nie jest dziś wiążący i stanie się nim dopiero na bazie zdalnej.

## 2026-09-02 · F0-04 · `seqScan` liczony po rozmiarze tabeli, nie po wierszach skanu
Kontekst: `plan/03` sekcja 1.2 każe zapalać flagę przy Seq Scan „na tabeli > 1000 wierszy".
Pierwsza wersja czytała `Actual Rows` z węzła planu, czyli liczbę wierszy PO filtrze.
Decyzja: flaga patrzy na rozmiar tabeli z `count(*)`, nie na wynik skanu.
Dowód: `calendar-window` filtruje 3 000 wpisów kalendarza do 118. Wersja po `Actual Rows`
raportowała `seqScan: false`, mimo że planer przeczesał całe 3 000 wierszy, czyli dokładnie
to, co ma usunąć indeks z F1-01. Po poprawce zapytanie raportuje `seqScan: true`
(`calendar_entries:3000`), tak samo `posts-analytics` (`posts:5000`).
Konsekwencja: stan wyjściowy przed F1-01 to 2 z 4 zapytań krytycznych z Seq Scan.
Kryterium F1-01 „seqScan równe false dla wszystkich 4" ma teraz sensowny punkt startu.
