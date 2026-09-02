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

## 2026-09-02 — pomiar kontekstu workerów: naprawiony skrypt i właściwe okno

**Problem.** `~/.claude/agent-context.sh` zwracał `NO-TRANSCRIPT` w każdym wywołaniu
workera, więc cała faza F0 przeszła bez pomiaru kontekstu. Przyczyna: skrypt szukał
transkryptu po slugu katalogu roboczego (`-Users-slajs-Desktop-projekty-Marketing-dashboard-manager`),
a transkrypty subagentów leżą pod katalogiem projektu SESJI RODZICA
(`~/.claude/projects/-Users-slajs/<sesja>/subagents/agent-*.jsonl`). Orkiestrator siedzi
w innym katalogu niż repozytorium, które buduje worker, więc trafienia nigdy nie było.

**Naprawa.** Do skryptu dodany fallback: gdy szukanie po slugu nic nie zwróci, bierzemy
najnowszy `subagents/agent-*.jsonl` z całego drzewa projektów. Przy twardym zakazie
równoległości (jeden worker naraz) jest on jednoznaczny, a istniejący filtr
`STALE-TRANSCRIPT` (cisza > 120 s) odsiewa transkrypty martwe.

**Okno modelu = 1 000 000, nie 200 000.** Domyślna stała skryptu (200000) nie pasuje
do Opusa 5 w tym środowisku. Wyliczenie z sesji głównej: 120 664 tokenów przy 12%
raportowanych przez statusline daje okno ~1 005 000. Wniosek operacyjny: worker musi
wołać `bash ~/.claude/agent-context.sh 1000000`. Bez argumentu dostaje liczbę pięć razy
zawyżoną (worker paczki F0-00..F0-04 wyszedłby na 107% zamiast realnych ~21%).

---

## F0-05: rozmiar bundla mierzony na wydanej stronie, nie z logu builda

`plan/03-wydajnosc.md` sekcja 4 każe wziąć rozmiar JavaScriptu pierwszego ładowania
`/calendar` „z wyjścia `next build`". W Next 16.2.4 tego wyjścia nie ma: build na
Turbopacku drukuje samą listę tras, bez kolumn `Size` i `First Load JS`, a
`npx next build --help` nie ma flagi, która by je przywróciła.

**Decyzja.** Liczbę wyznacza `scripts/perf/measure-page.mjs`: pobiera `/calendar`
z uruchomionego serwera produkcyjnego, zbiera wszystkie skrypty ładowane z
`/_next/static` i sumuje ich rozmiar po gzip. To ta sama definicja, tylko mierzona
na działającej aplikacji zamiast czytana z logu, więc jest bliżej doktryny „weryfikuj
na uruchomionej aplikacji".

**Wynik startowy: 354.8 kB w 20 plikach**, czyli powyżej celu 350 kB. Zgodnie z regułą
z tej samej sekcji progiem egzekwowanym staje się wartość startowa minus 15%, czyli
**301.6 kB**; 350 kB zostaje celem długoterminowym. Oba progi siedzą w `perf/budget.json`.

## F0-05: pomiar HMR czeka na dowód przebudowy, a nie na pierwszą odpowiedź

Pierwsza wersja `measure-dev.mjs` mierzyła HMR tak: zapisz komentarz w
`gantt-view.tsx`, zrób `GET /calendar`, zmierz czas. Wynik: **54 ms**, czyli mniej
niż czas rozgrzanego wejścia. Powód: obserwator plików nie zdążył zauważyć zmiany
i serwer oddał starą, już skompilowaną wersję. Pomiar mierzył nic i wyglądał świetnie.

**Naprawa.** Po zapisie skrypt odpytuje stronę w pętli i uznaje za HMR dopiero
odpowiedź wyraźnie wolniejszą od rozgrzanej (próg: trzykrotność `warmP50Ms`, nie mniej
niż 150 ms). Gdy w 30 sekund taka nie przyjdzie, pomiar kończy się wyjątkiem, bo lepszy
brak liczby niż liczba bez pokrycia. Po naprawie: **2079 ms**, przy progu 3000 ms.

## F0-05: logowanie harnessu idzie przez formularz, nie przez podrobienie ciasteczka

Kryterium mówiło „POST /login parą AUTH_EMAIL i AUTH_PASSWORD". Formularz logowania
jest server action, więc samo `POST` z dwoma polami nie wystarcza: Next wymaga jeszcze
pól `$ACTION_REF_*`, `$ACTION_*` i `$ACTION_KEY`.

Rozważona alternatywa: podpisać ciasteczko w skrypcie tym samym HMAC-iem co
`src/lib/auth-token.ts`. Odrzucona, bo duplikowałaby logikę bezpieczeństwa w drugim
miejscu i pomiar przestałby przechodzić ścieżką użytkownika.

**Decyzja.** Skrypt czyta pola `$ACTION_*` z HTML formularza i odsyła je razem z parą
email plus hasło, czyli robi dokładnie to, co przeglądarka z wyłączonym JavaScriptem.
Koszt: gdy Next zmieni kształt progressive enhancement, skrypt padnie z jasnym
komunikatem „w HTML /login nie ma pól $ACTION_*", a nie po cichu.

## F0-07: dwa pliki `*.bak.db` usunięte z repozytorium

`data/marketing-crew.pre-drop.bak.db` i `data/marketing-crew.pre-flexible.bak.db` to
kopie bazy sprzed migracji na PostgreSQL (pozycja A12 w `plan/01-analiza-i-zasady.md`).
Silnika, który je czytał, w projekcie nie ma. Ich jedyny efekt to mylenie każdego, kto
otwiera `data/` i wnioskuje, że dane aplikacji leżą w pliku.

**Decyzja.** Usunięte z indeksu i z dysku (`git rm --cached` plus `rm`). Historia
gita nadal je zna, więc gdyby kiedyś okazały się potrzebne, wyciąga je
`git show <commit>:data/marketing-crew.pre-drop.bak.db`. Wzorzec w `.gitignore`
rozszerzony z konkretnej nazwy na `/data/*.db`, żeby żaden plik bazy nie wjechał
tam ponownie przez przypadek.

---

## Raport fazy F0

Osiem issues, F0-00 do F0-07, wszystkie odhaczone z dowodem przy każdym kryterium.

**Co stoi po fazie.** Środowisko: PostgreSQL 17.11 w kontenerze `mc-pg` na porcie 5433,
trzy bazy (robocza, pomiarowa, testowa), `.env.local` poza gitem. Przyrządy: pięć
skryptów w `scripts/perf/` plus `report.mjs` jako sędzia progów. Pomiar bazowy:
`perf/baseline.json`, commitowany, z polem `mode: "local-docker"`. Dokument kanoniczny:
`docs/ARCHITEKTURA.md`, dziewięć sekcji, każda z komendą weryfikującą.

**Liczby startowe, punkt odniesienia dla całej reszty przebudowy.**
Strony (tryb produkcyjny, zestaw L), p95: `home` 21.7 ms, `calendar` 64.3,
`calendar-table` 30.2, `productions` 126, `production-detail` 23.6,
`campaign-detail` 39.2, `analytics` 34.8. Wszystkie z ogromnym zapasem pod progami
z `plan/03` sekcja 4, co jest samo w sobie wnioskiem: wąskim gardłem nie jest czas
odpowiedzi serwera na tej skali.
Baza, p95: 1.82 / 1.04 / 0.83 / 1.47 ms, ale dwa zapytania idą przez Seq Scan
(`calendar_entries` po 3000 wierszach, `posts` po 5000).
Tryb deweloperski: start 619 ms, pierwsza kompilacja `/calendar` 2603 ms, kolejne
wejścia 49 ms, HMR 2079 ms, szczyt pamięci 1510 MB.
Bundel: 354.8 kB po gzip w 20 plikach.

**Co z tego wynika dla kolejnych faz.** Ból zgłoszony przez usera („najbardziej boli
lokalnie") nie ma pokrycia w liczbach trybu deweloperskiego: każdy z pięciu progów
z `plan/03` jest spełniony, a `peakRssMb` 1510 przy limicie heapu 4096 sugeruje, że
`--max-old-space-size=4096` w `package.json` jest zabobonem, nie potrzebą. Kandydaci
na prawdziwą przyczynę: rozmiar bundla (354.8 kB) i praca po stronie przeglądarki
w gancie, nie serwer. To jest hipoteza do obalenia w F2, nie ustalenie.
Dwa Seq Scany to najtańsza i najpewniejsza naprawa, idzie pierwsza jako F1-01.

**Czego faza nie domknęła.** Potwierdzenie hostingu przez usera. GitHub mówi, że
projekt był wdrażany na Vercel i że ostatnie wdrożenie produkcyjne z 2026-05-03
padło, ale stałej domeny, dostępów ani decyzji „naprawiamy czy porzucamy" nie da się
odczytać z API. To jedyny punkt Definition of Done fazy F0, który zostaje otwarty,
i jest to bramka do usera, nie zaległość workera.

**Znaleziska fazy.** F7-01 do F7-09. Trzy dopisane w tej paczce: F7-08 (lewy pasek
akcentu wbrew zasadzie Z8, znaleziony na zrzucie ekranu do F0-05) i F7-09
(`createCalendarEntry` bez wywołania z interfejsu, znaleziony przy pisaniu sekcji 6
dokumentu architektury). Blokujących nie ma.
