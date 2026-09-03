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

## F2-05 — bundler deweloperski: pomiar wygrywa turbopack, decyzja zostaje przy webpacku

Trzy przebiegi na wariant, `npm run perf:dev` na zimnym `.next`, mediany:

| metryka | webpack | turbopack | kto lepszy |
|---|---|---|---|
| `readyMs` | 493 | 468 | remis |
| `firstCompileMs` | 2777 | 1187 | turbopack, 2,3x |
| `warmP50Ms` | 135 | 74 | turbopack, 1,8x |
| `hmrMs` | 2017 | 157 | turbopack, 13x |
| `peakRssMb` | 1555 | 1521 | remis |

Czysto czasowo nie ma o czym dyskutować: turbopack wygrywa wszystko, co się liczy,
a `hmrMs` to dokładnie ten ból, który user zgłosił jako główny.

**A jednak `dev` zostaje na webpacku.** Do kryterium F2-05 dołożyłem sprawdzenie,
którego w nim nie było: czy tryb deweloperski pokazuje to samo, co produkcja. Nie
pokazuje. Zrzut `/calendar?view=week` z `next build` + `next start` różni się od
zrzutu z dev-webpacka o **6 306** pikseli z 7 823 808, a od zrzutu z dev-turbopacka
o **82 921**. Różnica jest widoczna gołym okiem po powiększeniu: wewnątrz kolorowych
pasów T1/T2/T3 znikają pionowe kreski siatki dni. Bundler deweloperski, który rysuje
główny ekran inaczej niż produkcja, kosztuje więcej niż dwie sekundy przebudowy —
każda poprawka wyglądu robiona w takim trybie jest robiona na fałszywym obrazku.

Dlatego: `dev` = webpack, `dev:alt` = turbopack, przyczyna różnicy jako issue
**F7-14**. Po zamknięciu F7-14 przełączenie to jedna linijka w `package.json`
i powtórzenie pomiaru — liczby są już zebrane.

**Flaga `--max-old-space-size=4096` usunięta z obu skryptów.** Szczytowy RSS całego
drzewa procesów deweloperskich bez flagi: webpack 1513 / 1679 / 1556 MB, turbopack
1347 / 1471 / 1469 MB, przy progu 2500 MB. Z flagą webpack dawał 1437-1750 MB, czyli
flaga niczego nie oszczędzała ani nie kosztowała, tylko podnosiła sufit sterty, do
którego proces i tak nie dochodzi. Był to zabobon, teraz go nie ma.

**Poprawka w `scripts/perf/measure-dev.mjs`, bez której pomiar był niewykonalny.**
`hmrMs` rozpoznawał przebudowę po pierwszej odpowiedzi trzy razy wolniejszej od
rozgrzanej. Dla turbopacka próg (222 ms) nigdy nie padał, bo przebudowa jest szybsza
niż rozrzut zwykłego żądania, i skrypt kończył się błędem „nie zaobserwowano
przebudowy". Porównywanie całych odpowiedzi też odpada: dwa identyczne żądania
do `/calendar` różnią się między sobą (identyfikatory Reacta). Harness podmienia więc
w gancie napis, który trafia do HTML-a, i czeka na stronę z markerem. To jedyny
sygnał znaczący dokładnie „serwer oddaje już przekompilowany moduł" i znaczący
to samo dla obu bundlerów.

## F2 — raport fazy

Cel fazy był jeden i mierzalny: zbić JS pierwszego ładowania `/calendar` poniżej
egzekwowanego progu 301,6 kB po gzip. **Zbity: 355,5 kB → 292,0 kB.** `npm run perf`
kończy się kodem 0, po raz pierwszy od F0.

| kryterium DoD F2 | wynik |
|---|---|
| `npm run typecheck` | kod 0 |
| `npm run lint` | kod 0 (201 ostrzeżeń, 0 błędów) |
| `npm run test` | kod 0, 20 testów w 3 plikach |
| `npm run perf` | kod 0, wszystkie progi trzymają |
| zrzut głównego efektu fazy | `screenshots/F2/` — `przed-F2-03-*`, `po-F2-03-*`, `po-F2-04-*`, `po-F2-05-*`, `po-F2-06-*`, `prod-check-week.png` |
| raport fazy w `DECISIONS.md` | ten wpis |
| zero znalezisk bez issue w F7 | jedno nowe znalezisko, ma issue: **F7-14** |
| budżety stron z `plan/03` sekcja 4 | spełnione, tabela niżej |

p95 z trzech przebiegów `measure-page.mjs` na zestawie L, serwer produkcyjny
(mediana, ms), wobec progów z `perf/budget.json`:

| strona | p95 mediana | próg |
|---|---|---|
| home | 17,6 | 600 |
| calendar | 60,3 | 900 |
| calendar-table | 31,7 | 900 |
| productions | 124,5 | 600 |
| production-detail | 24,0 | 900 |
| campaign-detail | 31,0 | 900 |
| analytics | 26,4 | 600 |

Żaden budżet nie jest przekroczony, więc nie ma czego przenosić na bramkę F8.

**Co naprawdę kosztowało rozmiar.** Nie liczba komponentów klienckich, jak zakładał
krok P8, tylko jeden import: `src/lib/production-periods.ts` ciągnął zoda dla
`periodsSchema`, a ten plik czyta gant. Sześćdziesiąt jeden z sześćdziesięciu trzech
zaoszczędzonych kilobajtów to ta jedna linijka. Usunięcie ośmiu dyrektyw
`'use client'` dołożyło 1,7 kB. Wniosek na przyszłość: zanim policzysz komponenty
klienckie, sprawdź, co one importują — biblioteka walidacji w gałęzi klienckiej waży
więcej niż wszystkie komponenty razem.

**Czego faza nie dała.** Memoizacja ganta (F2-04) nie poprawiła żadnego zmierzonego
czasu; powód opisany wyżej we wpisie F2-04. Turbopack, trzynaście razy szybszy w HMR,
nie stał się domyślnym trybem deweloperskim, bo renderuje `/calendar` inaczej niż
produkcja (F2-05, issue F7-14). Oba wnioski są zmierzone, nie wydedukowane.


## F3-01 — stan pracy guzika i `prefers-reduced-motion`

**Stan `loading` dobudowany, ale bez obietnicy stałej szerokości.** Tabela zdarzeń
w `plan/05` sekcja 4 żądała „szerokość niezmieniona". Zbudowanie tego wprost wymaga
albo ukrycia tekstu i wstawienia wirującej ikony na jego miejsce (łamie „tekst
zachowany" z tego samego wiersza), albo zmierzenia guzika w JavaScripcie i przypięcia
`min-width` (efekt uboczny: guzik przestaje reagować na zmianę treści). Wybrane
rozwiązanie: wirująca ikona wjeżdża przed tekst, guzik dostaje `disabled` i
`aria-busy="true"`, szerokość rośnie o ikonę i odstęp. Wiersz tabeli poprawiony na to,
co faktycznie robi kod. Kto potrzebuje stałej szerokości, trzyma ją wypełnieniem
zewnętrznym wokół guzika, nie w guziku.

**`prefers-reduced-motion` był już zrobiony, tylko nie wiedzieliśmy o tym.**
`src/app/globals.css` niesie regułę `@media (prefers-reduced-motion: reduce)` z
`transition-duration: 1ms !important` dla `*`, więc guzik nie potrzebował własnej
obsługi przejść. Brakowało jednego: ta sama reguła ustawia `animation-duration: 1ms`,
co zamieniłoby wirującą ikonę w migotanie zamiast ją zatrzymać. Stąd
`motion-reduce:animate-none` na ikonie. Zmierzone w przeglądarce (Playwright,
`reducedMotion: 'reduce'`): przejście guzika 0,001 s, `animation-name` ikony `none`.
Bez preferencji: 0,15 s i `spin / 1s`.

**Czego F3-01 nie dodał i dlaczego.** Lista braków z `plan/05` sekcja 1 była w pięciu
punktach na sześć nietrafiona; szczegóły w przepisanej sekcji 1. Nie powstał żaden nowy
plik w `src/components/ui/`, bo żaden brakujący wzorzec nie wystąpił w dwóch miejscach.
Dwa realne znaleziska poszły do backlogu jako F7-15 (mikro-etykieta sekcji, 90 kopii)
i F7-16 (`card`, `badge` i `table` bez ani jednego użycia).

## F3 — dlaczego migracja guzika nie jest zamianą jednego słowa

Klasa bazowa `<Button>` niesie własną geometrię i typografię, więc podmiana
`<button>` na `<Button>` bez dopisania klas **zmienia wygląd**, choć w kodzie
wygląda na zmianę kosmetyczną. W tej fazie każdy taki przypadek wyszedł dopiero
na zrzucie ekranu; z samego kodu nie widać żadnego z nich. Pierwsze podejście do
kalendarza dawało 33 505 różniących się pikseli, ostatecznie zeszło do 1 848.

Pełna tabela pułapek z lekarstwami: `plan/05-ui-system.md` sekcja 6. W skrócie:
wymuszony rozmiar ikony (`size-4`), przezroczysta obwódka plus `bg-clip-padding`,
domyślne wypełnienie poziome w kontenerze `grid`, `h-8`/`text-sm`/`font-medium`/
`justify-center` i wreszcie `disabled:opacity-50` z `hover:bg-muted`.

Dwie rzeczy, których nie da się wyczytać z klas:

1. **`display: block` skraca wiersz o 4 px.** Guzik liniowy tworzy wiersz tekstu
   z miejscem na wydłużenia dolne; blokowy nie. Siedem takich guzików na stronie
   szczegółu produkcji dało 28 px różnicy wysokości strony. Guzik, który był
   `inline-block`, ma zostać `inline-block`.
2. **Reszta różnicy pikseli to faza `animate-pulse`.** Kropka w aktywnym znaczniku
   pulsuje; dwa zrzuty z różnych wersji kodu łapią ją w innym momencie. Geometria
   zmierzona w przeglądarce jest identyczna (guzik 29,4 px, kropka 8,4 px), różni się
   wyłącznie jasność. Skupiska po 82 do 85 pikseli na znacznik są tym, nie regresją;
   licznik rośnie z liczbą produkcji w bazie, więc po każdym przebiegu `npx playwright
   test` (który dosiewa dane) trzeba wziąć nowy zrzut odniesienia.

## F3 — raport fazy (2026-09-02)

**Co faza miała zrobić:** wyzerować surowe `<button>`, zamknąć regułę lintu na guzik,
ustawić kanon typografii i ikon oraz rozbić trzy przerośnięte pliki.

**Stan po fazie, liczby zmierzone, nie przepisane z planu:**

- `grep -r '<button' src/ | wc -l` = **0** (start fazy: 89), `<Button>` = 146.
  Reguła `no-restricted-syntax` w `eslint.config.mjs` jest błędem z pustą listą wyjątków.
- `node scripts/check-typography.mjs` = **0 trafień** (przed F3-06: 234, czyli 5 emoji,
  70 wyśrodkowanych kropek, 159 długich myślników w literałach i tekstach JSX).
- `grep -rn 'border-l-' src/ | wc -l` = 4, wszystkie funkcjonalne, ozdobny lewy pasek
  akcentu z kafelka „Wskazówka" usunięty.
- Trzy pliki rozbite: `template-form.tsx` 1250 → 552, `campaign-template-form.tsx`
  792 → 580, `timeline.tsx` 735 → 228. Jedenaście nowych plików, największy 202 linie.
- `npm run typecheck` kod 0, `npm run lint` kod 0 (108 ostrzeżeń, na starcie fazy 111,
  zero błędów, ani jednego dopisku do listy grandfathera), `npm run test` 29 zielonych
  (na starcie 21), `npx playwright test` 8 zielonych, `npm run perf` kod 0
  (bundel `/calendar` 292,2 kB przy progu 301,6 kB).

**Decyzja: długi myślnik zamieniamy na krótki z odstępami, nie na przecinek.**
Zasada Z7 dopuszcza trzy zamienniki (przecinek, dwukropek, krótki myślnik z odstępami).
Dla 159 wystąpień jedyny zamiennik, który nigdzie nie zmienia sensu zdania ani nie
wymaga czytania każdego zdania z osobna, to krótki myślnik: „Krok 1 - Szablon" znaczy
dokładnie to samo co „Krok 1 — Szablon", a „Krok 1, Szablon" już nie. Wyśrodkowana
kropka poszła na przecinek, bo tam zawsze rozdziela dwie równorzędne informacje.

**Decyzja: sprawdzanie typografii przez parser, nie przez grep.** Zasada Z7 wyłącza
komentarze w kodzie, a grep nie odróżnia komentarza od literału i podaje o kilkadziesiąt
trafień za dużo. `scripts/check-typography.mjs` chodzi po drzewie TypeScriptu i patrzy
wyłącznie na węzły tekstowe. Ten sam parser posłużył do zamiany, więc żadna nazwa klasy
ani komentarz nie zostały ruszone. Skrypt zostaje w repo jako bramka do ponownego użycia.

**Decyzja: nowy kod nie wchodzi na listę grandfathera lintu.** Wyjęcie kodu z wielkich
plików do nowych zamienia ostrzeżenia w błędy, bo nowe ścieżki nie są objęte wyjątkiem.
Za każdym razem naprawialiśmy przyczynę, nie dopisywali pliku do listy: uchwyt
`pointermove` w suwaku okresów dostał czystą funkcję `patchForDrag`, `StepRow` oddał
panel ustawień do `StepDetails`, `ProductionRow` oddał lewą komórkę do
`ProductionRowLabel` i pasek postępu do `StepsProgress`. Przy okazji zmierzone:
do złożoności cyklomatycznej liczy się także `?.` i `??`, więc komponent, który tylko
czyta opcjonalne pola, potrafi przekroczyć próg bez ani jednego `if`.

**Obalona hipoteza: „e2e pada, więc coś zepsuliśmy".** Po F3-08 `npx playwright test`
pokazał 2 czerwone. Przyczyną nie był kod, tylko `reuseExistingServer: true`
w `playwright.config.ts`: na porcie 3000 stał wtedy serwer produkcyjny z `npm run perf:serve`,
czyli baza `marketing_perf` bez szablonów kampanii, których szuka test. Po ubiciu go
i podniesieniu `npm run dev` wszystkie 8 testów jest zielonych. Pułapka opisana jako
issue **F7-18**, bo cisza przy podmianie bazy pod testami to błąd narzędzia, nie
jednorazowa pomyłka.

**Świadomie nierozbite:** `campaign-template-form.tsx` zostaje na 580 liniach.
Wydzielenie sekcji kamieni milowych wymagałoby przepchnięcia dziesięciu uchwytów przez
granicę komponentu, czyli więcej kodu niż zostaje w środku. Kryterium mówi o NOWYCH
plikach i to jest spełnione; plik zastany wolno zostawić, byle nie rósł.

## F4 — import osób z arkusza

**Decyzja: `exceljs` jako jedyna nowa zależność fazy (Z16).** Żadna z obecnych paczek
nie czyta `.xlsx`: `papaparse` obsługuje CSV, a `.xlsx` to spakowany ZIP z XML-em,
którego nie parsuje się ręcznie ani jedną linijką. Alternatywa `xlsx` (SheetJS) odpada,
bo wydanie na npm jest zamrożone i miało otwarte podatności na prototype pollution.
`exceljs` 4.4.0 czyta z bufora w pamięci, czyli plik nie musi lądować na dysku, co jest
zgodne z anty-specem z `plan/04` sekcja 7 (arkusz nie trafia do repozytorium ani do `data/`).
Waga: parser żyje wyłącznie po stronie serwera, więc nie dotyka bundla stron.

**Decyzja: limity wejścia sprawdzane przed otwarciem pliku.** `checkFile` patrzy na
rozszerzenie i rozmiar, zanim `parseWorkbook` w ogóle poda dane do `exceljs`. Plik
odrzucony nigdy nie jest czytany, więc limit 10 MB jest realną ochroną pamięci,
a nie komunikatem wyświetlanym po fakcie. Limit wierszy i kolumn można sprawdzić
dopiero po otwarciu skoroszytu i tak też jest zrobione, per arkusz.

**Decyzja: fixture generowany skryptem, nie plikiem wrzuconym do repo.**
`scripts/make-fixture-xlsx.ts` buduje `tests/fixtures/osoby.xlsx` deterministycznie
z licznika: imiona z krótkiej listy, nazwiska typu „Przykładowa", handle `@atrapa_0001`,
domena `przyklad.test`. Dzięki temu widać w kodzie, że w pliku nie ma ani jednej
prawdziwej osoby, a fixture da się odtworzyć po każdej zmianie kształtu arkusza.

## F4 — raport fazy (2026-09-03)

**Co powstało.** Ekran `/import/osoby` prowadzi przez siedem kroków z `plan/04` sekcja 2:
plik, arkusz i rola, mapowanie kolumn, suchy przebieg, zatwierdzenie, zapis, podsumowanie.
Logika jest w `src/lib/import/` (normalizacja, duplikaty, mapowanie, parser, suchy przebieg,
zapis), widok w `src/components/import/`, granice zaufania w dwóch trasach API.

**Decyzja: suchy przebieg to jedna funkcja czysta, używana po obu stronach.**
`dryRun` w `src/lib/import/dry-run.ts` dostaje wiersze, mapowanie, stan bazy i politykę,
oddaje plan bez jednego zapisu. Przeglądarka liczy nim podgląd, serwer liczy nim to,
co faktycznie zapisze. Gdyby podgląd miał własną arytmetykę, prędzej czy później
pokazałby inne liczby niż zapis, a to jest dokładnie ten rodzaj błędu, którego nikt
nie zgłasza, bo wygląda jak literówka w podsumowaniu.

**Decyzja: zapis idzie strumieniem NDJSON, nie server action.** Tabela zdarzeń wymaga
paska postępu z licznikiem faktycznie zapisanych paczek, a anty-spec zabrania paska,
który udaje postęp. Jedno wywołanie server action nie ma jak wypuścić niczego przed
końcem, więc zapis siedzi w trasie `POST /api/import/people/save`, która zwraca
`ReadableStream`: linia po każdej zapisanej paczce, na końcu linia z podsumowaniem albo
z błędem. Cała pętla mieści się w jednym `db.transaction`, więc strumień pokazuje postęp
wewnątrz transakcji, a nie serię niezależnych zapisów.

**Decyzja: `checkFile` i limity mieszkają osobno od parsera.** `parse.ts` ciągnie
`exceljs`, którego do bundla przeglądarki wpuścić nie wolno, a strefa zrzutu musi
odrzucić zły plik natychmiast, bez okrążenia po serwerze. Stąd `src/lib/import/limits.ts`
bez żadnej zależności; `parse.ts` reeksportuje te same funkcje, żeby wołający miał
jedno miejsce.

**Decyzja: testy zapisu chodzą po prawdziwym Postgresie.** `src/lib/import/save.test.ts`
łączy się z `TEST_DATABASE_URL`. Wycofania transakcji nie da się udowodnić na atrapie:
test psuje wiersz 120 ze 150 i sprawdza, że po wyjątku w bazie nie ma również tych 100
z pierwszej paczki. Na zaślepce ten test przechodziłby zawsze i nie znaczyłby nic.

**Naprawione w trakcie, bo to był błąd tej fazy.** Duplikat pewny, w którym arkusz nie
wnosi żadnej nowej wartości, dostawał plan `update` z pustym zestawem zmian, a
`set({})` wywracał całą transakcję komunikatem „No values to set". Powtórny import tego
samego arkusza z polityką aktualizacji padał w całości. Taki wiersz liczy się teraz jako
pominięty (`savePlans`, test „aktualizacja bez zmian jest pomijana").

**Pomiary.** Parsowanie plus suchy przebieg 1010 wierszy: mediana **66 ms** przy progu
3000 ms. Zapis 1000 nowych osób: mediana **56 ms** przy progu 5000 ms. Wzrost RSS przy
pliku 10,0 MB (5000 wierszy): **50,5 MB** przy progu 300 MB. Pomiar zapisu wycofuje
transakcję, więc nie zostawia w bazie ani jednego wiersza
(`npx tsx scripts/perf/measure-import-save.ts`).

**F4-06 świadomie odłożone.** Dopasowanie do prawdziwego arkusza czeka na plik `.xlsx`
od usera. Nie było go, więc issue zostaje niezaznaczone. Zastępczego „prawdziwego"
arkusza nie wymyślono: fixture syntetyczny (`scripts/make-fixture-xlsx.ts`, 3 arkusze,
1131 wierszy z błędami i duplikatami) pokrywa całą resztę fazy, ale nie zastąpi
sprawdzenia, jak naprawdę nazywają się kolumny w arkuszu usera.

**Dane osobowe.** `scripts/import-people.ts` usunięty (F4-07). Dane zostają w historii
gita i wyjmie je stamtąd każdy, kto sklonuje repozytorium; czyszczenie historii to
decyzja usera, opisana w `docs/ARCHITEKTURA.md` sekcja 9. Dwa prawdziwe handle nadal
stoją w kryterium akceptacji F4-07 w `plan/08-BACKLOG.md`, jako znalezisko **F7-23**.

**Pułapka, którą zostawiam następnemu.** Zapis 975 wierszy trwa kilkadziesiąt milisekund,
więc każda asercja e2e na przelotnym stanie widoku („pasek postępu jest widoczny")
przegrywa wyścig raz na kilka przebiegów. Licznik paczek sprawdzamy więc na strumieniu
(linie `{"batch":n,"of":10}`), a samo rysowanie w teście komponentu. Zrzut kroku 6
udało się zrobić dopiero na przebiegu aktualizacyjnym, gdzie 975 osobnych `UPDATE`
daje okno rzędu sekundy. Przy okazji: zastane `e2e/revalidate.spec.ts` i
`e2e/stale-data.spec.ts` dokładają do bazy roboczej pięć wierszy przy każdym pełnym
przebiegu i nigdy ich nie kasują (F7-21).

**Znaleziska fazy:** F7-20 (pole wyboru pokazuje surową wartość zamiast etykiety, kod
zastany), F7-21 (e2e importu pisze do bazy roboczej, brak izolacji), F7-22 (`AGENTS.md`
wskazywał nieistniejący plik planu), F7-23 (prawdziwe handle w kryterium F4-07).

## F5 — testy, dryf, środowisko dla zespołu (2026-09-03)

**Bramka dryfu ma drugi warunek, bezwzględny.** `plan/06` sekcja 4 mówi: powyżej 15%
ostrzeżenie, powyżej 30% błąd blokujący. Sam procent nie działa na tych danych.
Zmierzone na 280 parach kolejnych przebiegów z `perf/runs`: największe odchylenie między
przebiegami to 242% (`p95 productions-list` 0,76 → 2,84 ms), na stronach 77%
(`p95 home` 17,6 → 31,2 ms). Bramka na samym procencie zapalałaby się na szumie i
zostałaby wyłączona w tydzień. Blokada wymaga więc jednocześnie ≥30% ORAZ pogorszenia
większego niż 10% limitu budżetowego danej metryki (`driftAbsFloorPct`). Sprawdzone
skryptem `scripts/perf/drift-selftest.mjs`: zero fałszywych alarmów na historii, każda
regresja podchodząca pod limit blokuje. Ostrzeżenie od 15% zostało bez zmian, więc szum
nadal widać w raporcie — po prostu nie zatrzymuje pracy.

**Środowisko podglądowe stoi lokalnie, publiczny adres czeka na usera.** Postawione:
osobna baza `marketing_preview` z zestawem L, `scripts/preview.mjs` (migracje, zasiew,
serwer na porcie 3001, nasłuch na 0.0.0.0), `npm run preview:setup` i
`npm run preview:serve`. Zmierzone przy okazji: **po zwykłym `http://` nikt się nie
zaloguje**, bo `next start` biegnie z `NODE_ENV=production`, a ciasteczko sesji ma wtedy
flagę `secure`. Przejście sprawdzone po https przez `tailscale serve` na tailnecie tej
maszyny i po sprawdzeniu wyłączone — tailnet wymaga od zespołu instalacji klienta, czyli
łamie warunek „bez stawiania czegokolwiek u siebie". Publiczny adres to decyzja usera:
`tailscale funnel` (nic nie kosztuje, ale wystawia aplikację publicznie i zajmuje port
443 zajęty dziś przez vibe-kanban) albo hosting, który wymaga wypchnięcia repozytorium
poza tę maszynę — a w historii gita nadal siedzą prawdziwe dane osobowe (F4-07).

**Zrzuty scenariuszy e2e nie są `fullPage`.** Pełna strona `/calendar` w zestawie
roboczym ma 16 854 px wysokości; na takim zrzucie nie widać niczego. Zrzuty F5 to widok
okna 1280×720.

## F6 — raport fazy (2026-09-03)

**F6-01, dostępność.** Audyt zrobiony na uruchomionej aplikacji, nie z kodu: nowy
`scripts/a11y-audit.mjs` loguje się parą z `.env.local`, wchodzi na `/calendar`,
`/productions/list` i `/import/osoby`, przechodzi je tabulatorem i mierzy. Wynik:
przejście Tabem osiąga **każdy** widoczny element akcji (1544 z 1544, 88 z 88,
24 z 24), zero elementów bez obwódki ogniskowania, zero guzików bez tekstu i bez
nazwy. Skrypt kończy się kodem 1 przy pierwszym naruszeniu, więc jest bramką,
nie jednorazowym pomiarem.

**Obszar dotyku 44 px tylko na wskaźniku gruboziarnistym, i to jest decyzja.**
Rozmiary `xs` (24 px), `sm` (28 px), `icon-xs` (24 px) i `icon-sm` (28 px) są mniejsze
niż zalecane 44 px. Halo dokłada pseudoelement `::after` z `min-h-11 min-w-11`
w bazie `buttonVariants`, ale pod wariantem `pointer-coarse:`. Powód: halo jest
przezroczystym prostokątem, który przechwytuje kliknięcia dla swojego guzika, a gant
ma paski, w których guziki 16 px stoją co kilka pikseli. Na myszy takie halo
zabierałoby kliknięcia sąsiadom — czyli naprawa dostępności na ekranie dotykowym
psułaby precyzję na ekranie z myszą. `pointer: coarse` rozdziela te dwa światy.
Pomiar: 1400 / 308 / 3 guziki poniżej 44 px przed zmianą, 0 / 0 / 0 po.

**Pułapka pomiaru: CDP nie umie udawać `pointer: coarse`.**
`Emulation.setEmulatedMedia` z cechą `pointer` przechodzi bez błędu, a `matchMedia`
w stronie dalej zwraca `false` — sprawdzone. Działa dopiero kontekst Playwrighta
z `hasTouch: true` i `isMobile: true`. Audyt robi więc drugą kartę wyłącznie do
pomiaru obszaru dotyku.

**Nawigacja została poza halo, świadomie.** Pozycje paska bocznego to zwykłe `<a>`
(215 x 36 px, podpozycje 178 x 31 px, odnośniki agentów 215 x 24 px), a kryterium
F6-01 mówi o rozmiarach guzika. Zapisane jako **F7-25**, nie naprawione po cichu.

**F6-02, granice zaufania.** Zasada Z13 była spełniona w kształcie „duże wejścia mają
schemat, argumenty proste nie mają". 40 akcji serwerowych brało `productionId`,
`stepId`, `slug` albo `mode` prosto z przeglądarki bez żadnego sprawdzenia; typ
TypeScriptu nie jest walidacją, bo po drugiej stronie server action stoi HTTP.
Dołożone prymitywy w `schemas.ts` i po jednej linii parsowania na argument — 73 punkty
wejścia, zero bez schematu, sprawdzane komendą `node scripts/check-trust-boundaries.mjs`.

**`slugSchema` to nie kosmetyka.** Slug agenta i szablonu trafia do ścieżki pliku
w `data/agents/` i `data/templates/`. Wzorzec `^[a-z0-9][a-z0-9-]*$` wycina ukośnik
i kropkę, więc `../etc/passwd` odpada na granicy, a nie w warstwie plików.

**Fixture `.xlsx` wyjęty z gita.** `git ls-files | grep -E '\.env|\.xlsx|\.db$'`
zwracał `tests/fixtures/osoby.xlsx`. Plik jest syntetyczny, więc nie był wyciekiem,
ale Z14 mówi o arkuszach w repozytorium bez wyjątku, a generator jest deterministyczny.
Rozwiązanie: `git rm --cached`, wpis w `.gitignore`, odtwarzanie w `test.beforeAll`
w `e2e/import-osoby.spec.ts`. Sprawdzone przez skasowanie pliku i przebieg testów.

**Ostrzał na uruchomionej aplikacji.** Pięć granic ostrzelanych złym wejściem przez
`curl` z ciasteczkiem sesji: brak pliku, `dryRun=zle`, `category=../../etc`, CSV
podany jako xlsx, JSON z `role: "kot"` i `rows: "nie tablica"`. Wszystkie 400, żadne
500. Osiem żądań z popsutymi parametrami URL (`week=nie-data`, `view=<script>`,
`weeks=-99`, `mode=../../etc/passwd`, `sort=DROP TABLE`, `status=%00`, `/productions/abc`,
`/campaigns/-1`) daje pięć 200 i trzy 404, żadnego 500.

**F6-03, dokument architektury.** Pięć twierdzeń `docs/ARCHITEKTURA.md` okazało się
fałszywych przy sprawdzeniu komendą i zostało poprawionych: indeksy i Seq Scany
(sekcja 5, nieaktualne od F1-01), pusta baza robocza (sekcja 4), „`npm run perf`
kończy się kodem 1" i 205 ostrzeżeń ESLint (sekcja 8), numery linii w sekcjach 3 i 6,
lista długów w sekcji 9. To jest argument za tym, żeby każdą liczbę w dokumencie
trzymać razem z komendą, która ją odtwarza: pięć zdań zestarzało się w dwa dni pracy.
Dziesięć sprawdzeń stoi w załączniku dokumentu, razem z komendą i wynikiem przy każdym.


**F7-01, jeden hak zamiast jedenastu efektów.** Wszystkie trafienia
`react-hooks/set-state-in-effect` miały ten sam kształt: „gdy prop się zmienił, ustaw
stan". Zamiast jedenastu poprawek w miejscu wszedł jeden ośmiolinijkowy hak
`useResetOnChange` (`src/lib/use-reset-on-change.ts`) realizujący wzorzec
„dostosowania stanu w trakcie renderu" z dokumentacji Reacta. Efekt commituje
nieaktualny render i dopiero potem drugi z poprawnym stanem; render przerwany
w połowie powtarza się, zanim cokolwiek trafi na ekran. Jedno malowanie zamiast dwóch.
Zrzuty czterech ekranów przed i po są identyczne co do piksela, więc zmiana jest
niewidoczna dla użytkownika, a nie „prawie taka sama".

**F7-01, grandfather rozbity na listę per reguła.** Zastany blok w `eslint.config.mjs`
trzymał jedną listę 47 plików dla siedmiu reguł naraz. Wypisanie pliku z jednej reguły
zdejmowało z niego pozostałe sześć, więc domykanie znalezisk F7 pojedynczo było
niewykonalne bez rozluźnienia bramki gdzie indziej. Teraz każda reguła ma własną listę
plików i znika stąd w całości, gdy jej lista pustoszeje.

**F7-02, trzy z pięciu trafień `react-hooks/purity` to fałszywe alarmy.**
`src/app/campaigns/[id]/page.tsx`, `src/app/productions/[id]/page.tsx`
i `src/components/campaigns/campaigns-list.tsx` nie mają `'use client'` — to komponenty
serwerowe. Reguły `react-hooks/*` pilnują czystości renderu klienta, gdzie React może
powtórzyć render z zapamiętanych wartości i pokazać dwie różne liczby dla tych samych
danych. Render RSC to jedno wywołanie na żądanie, a zegar jest tam takim samym wejściem
jak odczyt z bazy kilka linii wyżej. Dlatego zamiast przepisywania kodu weszło lokalne
`eslint-disable-next-line` z uzasadnieniem przy każdej z trzech linii. Dwa pozostałe
trafienia (`gantt-narrative-row.tsx`, `production-drawer.tsx`) to prawdziwe komponenty
klienckie i dostały `useState(() => Date.now())`, czyli zegar odczytany raz przy
montowaniu.

**F7-02, pomiar `/calendar` przed i po.** Mediana z trzech przebiegów `npm run perf`
na tym samym budowaniu produkcyjnym: **przed 85,2 ms** (72,4 / 85,2 / 92,2),
**po 79,3 ms** (82,4 / 75,9 / 79,3). Bundel `/calendar` bez zmiany: 292,7 kB przy progu
301,6 kB w obu przebiegach. Różnica −7% mieści się w zmierzonym szumie 40%, czyli
zmiana jest wydajnościowo neutralna — czego się spodziewaliśmy, bo rozwijany panel
kampanii nie wchodzi do pierwszego ładowania strony.

**F7-03, mutacja `document.body` wyprowadzona na poziom modułu.** Blokada zaznaczania
tekstu na czas przeciągania uchwytu suwaka to mutacja elementu, którego React nie
renderuje. W ciele komponentu `react-hooks/immutability` czyta ją jako mutację wartości
spoza renderu i ma rację, bo statycznie nie da się tam odróżnić wywołania z uchwytu
zdarzenia od wywołania w renderze. Funkcja `lockTextSelection` na poziomie modułu
nazywa tę granicę wprost i obsługuje oba kierunki (blokada przy `pointerdown`,
zwolnienie przy `pointerup`), które wcześniej stały w dwóch różnych miejscach pliku.

**F7-03, licznik w trakcie renderu zamieniony na wyliczenie.** `template-form.tsx`
numerował kroki zmienną `runningOffset` nadpisywaną wewnątrz `map`, opakowaną w IIFE
tylko po to, żeby ta zmienna miała gdzie mieszkać. Nowy kod liczy pierwszy numer
kategorii wprost z `steps` i IIFE znika. Sprawdzone porównaniem tekstu strony przed
i po na czterech szablonach — bajt w bajt to samo.

**F7-04, licznik z kryteriów F7 liczy nie to, co miał liczyć.** Kryteria w F7-01 do
F7-05 mierzą postęp komendą `npx eslint . -f json | grep -c '<nazwa reguły>'`.
Formatter `json` dokłada do każdego pliku, który ma jakikolwiek komunikat, pole `source`
z całą treścią tego pliku. `eslint.config.mjs` ma własne ostrzeżenie
(`import/no-anonymous-default-export`) i wymienia nazwy reguł w komentarzach, a pliki
z F7-02 mają w kodzie `eslint-disable-next-line <nazwa reguły>`. Efekt: `grep` trafia
w komentarze i zwraca liczbę większą od zera przy zerowej liczbie komunikatów. Uczciwy
licznik: `npx eslint . -f json | jq '[.[].messages[] | select(.ruleId=="X")] | length'`.
Wyniki w F7 podawane są tym licznikiem, a rozbieżność opisana przy każdym issue.

**F7-04, dowód wymagał wywołania stanu pustego.** Oba `<a>` żyją w gałęzi „brak
szablonów kampanii", której przy dwóch szablonach w bazie roboczej nie da się zobaczyć.
Weryfikacja: `pg_dump --data-only -t marketing_templates` do pliku, `delete from
marketing_templates`, `template_slug = null` na kampanii 1, przebieg testu, przywrócenie
z kopii i sprawdzenie, że wróciły 2 wiersze i slug. Kontrola negatywna na kodzie sprzed
zmiany dała `BRAK` w obu miejscach, czyli test naprawdę odróżnia nawigację klientem od
przeładowania dokumentu, a nie przechodzi „przy okazji".

**F7-05, cudzysłowy zamknięte znakiem, nie prostym `"`.** Trzy miejsca miały parę
mieszaną: otwierający „ i zamykający prosty `"`. `&rdquo;` domyka je znakiem ”, czyli
tak, jak robi to już `campaigns-list.tsx` parą `&bdquo;` / `&rdquo;`. To jedyna
widoczna zmiana tej paczki: 762 piksele na `/campaigns/1` przy progu szumu 1 155,
a strona szablonu (apostrof zamieniony na `&apos;`, ten sam znak) ma 0 pikseli różnicy.

**F7-05, przebieg e2e ujawnił próg zależny od środowiska.** `npx playwright test` dał
`21 passed, 1 failed` — `gantt-filter.spec.ts` mierzy przemalowanie gantu i wymaga
mediany poniżej 300 ms. Na serwerze deweloperskim wychodzi 306, 309 i 313 ms, na
`next build` + `next start` 139, 116 i 117 ms. To nie jest regresja tej paczki: ten sam
test na commicie `68171c6` sprzed paczki daje na serwerze deweloperskim 316, 333 i
301 ms. `reuseExistingServer: true` sprawia, że wynik zależy od tego, co stoi na porcie
3000. Zapisane jako **F7-28**; przebieg zaliczający tę paczkę wykonany na budowaniu
produkcyjnym: **22 zielone**.
