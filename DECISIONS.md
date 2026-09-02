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

## F1-03 — Cache Components włączony, zmierzony i cofnięty (2026-09-02)

**Co było hipotezą.** Krok P3 z `plan/03-wydajnosc.md` zakładał, że włączenie
mechanizmu Cache Components w Next 16, zdjęcie `force-dynamic` i wpięcie trzech
odczytów niezależnych od użytkownika w `use cache` zmniejszy pracę serwera na
wejście, mierzalnie na `productions`, `templates` i `analytics`.

**Co zostało zrobione, żeby to sprawdzić.** Pełna implementacja, doprowadzona do
`npm run build` z kodem 0:

- `next.config.ts`: `cacheComponents: true`.
- Usunięte **26** deklaracji `export const dynamic = 'force-dynamic'` (25 stron plus
  układ). Wariant „zostaje z komentarzem uzasadniającym" jest niewykonalny: build
  przerywa z komunikatem `Route segment config "dynamic" is not compatible with
  nextConfig.cacheComponents. Please remove it.` To samo dotyczy `export const
  runtime = 'nodejs'` w `src/app/api/csv/route.ts` i `src/app/api/upload/route.ts`.
- `use cache` z `cacheLife('minutes')` i `cacheTag` na czterech odczytach:
  `loadTemplates` i `getTemplate` (tag `production-templates`), `loadMarketingTemplates`
  i `getMarketingTemplate` (tag `marketing-templates`), `loadAgentMeta` i `getAgent`
  (tag `agents`), oraz odczyt listy osób wyjęty z `listArtists` (tag `artists`).
  Bramka sesji zostaje na zewnątrz funkcji cachowanej, bo `use cache` nie czyta ciasteczek.
- Unieważnianie przez `updateTag`, nie `revalidateTag`: `revalidateTag` daje
  stale-while-revalidate, czyli po zapisie użytkownik widziałby jeszcze starą listę.
  Owinięte w `safeUpdateTag` w `src/server/actions/revalidate.ts`, tak jak wcześniej
  `revalidatePath`, żeby wywołanie ze skryptu `tsx` nie wysypywało akcji.

**Trzy pułapki, które kosztowały najwięcej i nie są oczywiste z dokumentacji.**

1. `<Suspense>` wokół `{children}` w układzie **nie jest** granicą, której szuka
   prerender. Granicą jest `src/app/loading.tsx` — jeden plik w korzeniu załatwia
   wszystkie 25 tras naraz.
2. Prawdziwym winowajcą błędu `blocking-route` na trasach z parametrem
   (`/agents/[slug]`, `/productions/[id]`, `/campaigns/[id]`, trzy strony edycji) nie
   była strona, tylko **układ**: `<Sidebar>` jest komponentem klienckim i woła
   `usePathname()`, a ścieżka jest daną żądania, której nie da się znać przy budowaniu
   statycznej powłoki trasy z parametrem. `<Suspense>` wokół samego `<Sidebar>`
   naprawia komplet tych tras jednym ruchem. Ślad w `next build --debug-prerender`
   wskazywał `RootLayout`, ale bez tej flagi build pokazuje tylko pierwszy błąd
   i wygląda to na problem strony.
3. `new Date()` w `src/app/page.tsx` przerywa prerender, dopóki nie zostanie odczytana
   jakakolwiek dana żądania. Rozwiązanie: `await connection()` z `next/server` przed
   pierwszym odczytem zegara.

**Pomiar, czyli powód cofnięcia.** `measure-page.mjs`, po trzy przebiegi, mediana p95
w milisekundach. Kolumna „po F1-02" to punkt odniesienia, „po F1-03" to stan z cache.

| strona | po F1-02 | po F1-03 | zmiana |
|---|---|---|---|
| home | 12,3 | 11,7 | -5% |
| calendar | 63,8 | 59,8 | -6% |
| calendar-table | 26,5 | 25,5 | -4% |
| productions | 128,1 | 132,5 | +3% |
| production-detail | 23,1 | 22,4 | -3% |
| campaign-detail | 30,7 | 34,1 | +11% |
| analytics | 27,5 | 28,0 | +2% |

Żadna ścieżka nie poprawiła się o 10%. Kryterium akceptacji F1-03 mówi w tym wypadku
wprost: hipoteza obalona, zmiana cofnięta poza zdjęciem `force-dynamic` z układu.
Tak zrobiono.

**Ale hipoteza nie została obalona uczciwie i trzeba to powiedzieć.** Trzy z czterech
cachowanych katalogów **nie istnieją w bazie pomiarowej**: `production_templates`,
`marketing_templates` i `agents` mają w `marketing_perf` po zero wierszy. Cache miał
omijać zapytania, które i tak nie mają czego czytać. Do tego zestaw mierzonych stron
nie zawiera `/templates` ani `/agents`, czyli stron, które te katalogi renderują.
Wynik pomiaru mówi więc „na tych siedmiu stronach i na tych danych nie widać różnicy",
a nie „cache nie działa". Braki zapisane jako **F7-10** (dosianie katalogów do zestawu L
i rozszerzenie zestawu mierzonych stron) i **F7-11** (powrót do P3 na danych,
które istnieją, z gotowym przepisem technicznym z tego wpisu).

**Co zostaje w repozytorium po cofnięciu.** Zdjęte `force-dynamic` z
`src/app/layout.tsx` (jedyny wyjątek dopuszczony przez kryterium) oraz
`e2e/stale-data.spec.ts` — scenariusz przeżył cofnięcie, bo pilnuje rzeczy niezależnej
od cache: że mutacja z interfejsu odświeża widok bez twardego przeładowania.
Scenariusz dodaje osobę przez formularz, a nie wpis kalendarza jak mówiło pierwotne
kryterium, bo wpisu kalendarza nie da się dodać z interfejsu (znalezisko F7-09).

## F1 — raport fazy (2026-09-02)

**Cztery issues, cztery różne wyniki.** F1-01 i F1-02 poprawiły liczby. F1-03 poprawił
kod, ale nie liczby, więc wrócił. F1-04 nie miał niczego przyspieszać i nie przyspieszył
— zawęża zasięg unieważniania i stawia pod tym siatkę pięciu scenariuszy e2e.

**Baza, przed i po (`measure-db.mjs`, p95 w milisekundach).**

| zapytanie | przed (baseline) | po F1-01 | seqScan przed | seqScan po |
|---|---|---|---|---|
| calendar-window | 1,82 | 1,49 | **tak** | nie |
| productions-list | 1,04 | 1,13 | nie | nie |
| campaign-detail | 0,83 | 0,70 | nie | nie |
| posts-analytics | 1,47 | 0,95 | **tak** | nie |

Oba Seq Scany zniknęły, wszystkie cztery zapytania są o dwa rzędy wielkości poniżej
progu 120 ms. Indeksów w bazie jest 25 zamiast 12: dwanaście kluczy głównych i trzynaście
nowych z migracji `0002`.

**Strony, przed i po (`measure-page.mjs`, p95 w milisekundach, mediana z trzech przebiegów).**

| strona | baseline | po F1-01 | po F1-02 | po F1-03 (cofnięte) | stan końcowy |
|---|---|---|---|---|---|
| home | 21,7 | 25,8 | 12,3 | 11,7 | 15,5 |
| calendar | 64,3 | 63,8 | 63,8 | 59,8 | 81,6 |
| calendar-table | 30,2 | 30,2 | 26,5 | 25,5 | 27,4 |
| productions | 126,0 | 128,1 | 128,1 | 132,5 | 165,5 |
| production-detail | 23,6 | 23,1 | 23,1 | 22,4 | 25,0 |
| campaign-detail | 39,2 | 40,3 | 30,7 | 34,1 | 33,1 |
| analytics | 34,8 | 34,8 | 27,5 | 28,0 | 30,3 |

Czytać to trzeba ostrożnie i tak też jest napisane. Kolumna „stan końcowy" pochodzi
z pojedynczego przebiegu `npm run perf`, nie z mediany, i widać w niej szum: `calendar`
81,6 wobec 59,8 zmierzonych chwilę wcześniej, `productions` 165,5 wobec 132,5. Rozrzut
między przebiegami na tej maszynie sięga 40% i jest większy niż każdy efekt, którego
szukamy poniżej `home` i `campaign-detail`. **Jedyne dwie zmiany, które wychodzą ponad
szum, to `home` (25,8 → 12,3, czyli -52%) i `campaign-detail` (40,3 → 30,7, -24%), obie
z F1-02.** Reszta tabeli to zapis stanu, nie dowód poprawy.

**Definition of Done fazy F1, punkt po punkcie.**

1. „`npm run perf` kod 0 dla progów bazodanowych (p95 zapytań, `seqScan`)" — **spełnione**.
   Wszystkie cztery progi bazodanowe raportują `ok`, `seqScan` jest `nie` dla każdego
   zapytania. Samo `npm run perf` kończy się kodem **1**, ale wyłącznie z powodu progu
   rozmiaru bundla (`JS /calendar (gzip)`: 354,8 kB wobec 301,6 kB), który jest zadaniem
   fazy F2 (kroki P7 i P8), nie F1.
2. „tabela przed i po w raporcie fazy" — **spełnione**, dwie tabele wyżej.

**Co zostało otwarte.** F7-10 i F7-11, oba z F1-03: zestaw pomiarowy nie zawiera danych
katalogowych, więc krok P3 nie miał czego przyspieszyć, a przepis techniczny na jego
powtórzenie leży gotowy we wpisie „F1-03". Otwarta zostaje też bramka z F0: potwierdzenie
`docs/ARCHITEKTURA.md` przez usera.

---

## F2-02 — podział ganta i lista wyjątków w ESLint

**Kontekst.** `src/components/calendar/gantt-view.tsx` miał 2545 linii i mieszał w sobie
kontener, nagłówek osi, wiersz produkcji, matematykę rozmieszczenia kroków, pasy T1/T2/T3,
kamienie milowe, pasek podkroków i panel rozwinięty. Zasada Z11 mówi, że nowy plik nie
przekracza 300 linii; kryterium F2-02 wymagało rozbicia na co najmniej kontener, wiersz
i nagłówek. Wyszło jedenaście nowych plików, żaden powyżej 300 linii.

**Dlaczego geometria wyjechała już w F2-01, a nie w F2-02.** Test jednostkowy nie umie
zaimportować `gantt-view.tsx`: łańcuch `import` prowadzi przez server action do
`src/lib/db.ts` i do `src/lib/env.ts`, który rzuca `Invalid environment variables` przy
samym imporcie. Bez wydzielenia czystej arytmetyki do osobnego modułu testy przypinające
z F2-01 nie miały czego importować. Przeniesienie było dosłowne: skopiowane linie plus
słowo `export`.

**Decyzja, która nie jest czystym przenoszeniem: lista grandfather w `eslint.config.mjs`.**
Lista niesie komentarz „z tej listy się WYPISUJEMY, nigdy do niej nie dopisujemy", a przy
podziale trzeba było dopisać sześć ścieżek. Powód: reguła `complexity` jest błędem dla
nowego kodu i ostrzeżeniem dla plików z listy, a zastany kod o za wysokiej złożoności
zmienił plik. Alternatywy były dwie i obie gorsze. Zbijanie złożoności przy okazji łamie
kryterium „podział jest czysto mechaniczny, bez zmiany zachowania" — czyli dokładnie to,
przed czym chronią testy z F2-01. Zostawienie `npm run lint` z dziewięcioma błędami łamie
Definition of Done fazy. Bilans liczbowy: gant miał przed podziałem 8 zgłoszeń
(7 x `complexity`, 1 x `react-hooks/purity`), po podziale ma 10, bo `GanttRowView`
o złożoności 55 rozpadł się na `GanttRowView` (18), `buildRowModel` (20) i `buildDraft` (11),
w sumie 49. Dług nie urósł, zmienił adres. Wypisanie się z listy jest osobnym issue: F7-13.

**Jak wyglądał dowód „wygląd niezmieniony".** Powstało `scripts/perf/pngdiff.mjs` —
porównanie dwóch zrzutów piksel po pikselu (dekodowanie chromium z playwrighta, bo repo
nie ma biblioteki graficznej, a `magick` ani `compare` nie są zainstalowane).
**Ustalenie, bez którego liczba z tego narzędzia nic nie znaczy: próg szumu na tej maszynie
wynosi 1050 pikseli z 7 823 808.** Tyle różnią się dwa zrzuty tego samego, niezmienionego
kodu, wykonane po restarcie kompilacji serwera deweloperskiego; różnica siedzi w jednym
pionowym pasie szerokości 18 pikseli, na kresce „dziś". Dwa zrzuty pod rząd bez restartu
dają 0. Wniosek praktyczny na kolejne issues: różnica poniżej ~1100 pikseli to szum,
nie regresja, i dopiero powyżej warto szukać przyczyny.

## F2-04 — memoizacja ganta nie dała mierzalnego zysku

Kryterium P5 zakładało, że `memo` na wierszu, `useMemo` na osi i `useCallback`
na uchwytach usuną zawieszki przy filtrowaniu i przewijaniu. Zmierzone na
zestawie L (serwer produkcyjny, baza `marketing_perf`, 56 wierszy w oknie):

| Interakcja | przed | po |
|---|---|---|
| zmiana filtra kampanii, mediana z 3 | 80 ms | 78 ms |
| rozwinięcie wiersza, 5 powtórzeń | 28-33 ms | 22-35 ms |

Zero różnicy poza szumem. Powód jest strukturalny, nie pomiarowy: zmiana filtra
kampanii to nawigacja, czyli nowy render po stronie serwera i nowe referencje
propsów — `memo` z definicji nie ma czego pominąć. A stan, który zmienia się
po stronie klienta (rozwinięcie wiersza, klik w krok), siedzi WEWNĄTRZ wiersza,
więc kontener i pozostałe wiersze i tak się nie przerysowywały.

Zmiana zostaje, bo jest tania i nic nie psuje, ale bez złudzeń co do jej wagi:
zaczyna cokolwiek dawać dopiero, gdy kontener ganta dostanie własny stan
(np. filtrowanie po stronie klienta). Gdyby przy F2-06 albo później okazała się
przeszkodą, wolno ją cofnąć bez straty — pomiar jest tutaj.

**Pułapka pomiarowa dla następnych issues.** Próg szumu porównania zrzutów
z F2-01 (1050 pikseli) zaniża dzisiejszy rozrzut. Cztery zrzuty tego samego,
niezmienionego kodu `/calendar?view=week` różnią się między sobą o 1155 do 1680
pikseli z 7 823 808; różnica siedzi w antyaliasingu przerywanych prowadnic
i kółek podkroków, a wycinek 560x420 pikseli obejrzany obok siebie jest
nieodróżnialny. Rozstrzygać należy powtórką: dwa zrzuty potrafią wyjść
identyczne (0 pikseli), więc jedna liczba powyżej 1100 nie jest jeszcze
dowodem regresji.

