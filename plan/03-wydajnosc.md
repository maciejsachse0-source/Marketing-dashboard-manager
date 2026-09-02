# 03 — Wydajność: harness pomiarowy, zestaw L, budżety, kolejność napraw

System przekrojowy. Powstaje PRZED jakąkolwiek optymalizacją, bo bez niego zasada Z1
jest niewykonalna.

## 1. Harness pomiarowy — pliki i kontrakty

```
scripts/perf/
  seed-large.ts      # generuje zestaw L do bazy wskazanej przez PERF_DATABASE_URL
  table-counts.mjs   # COUNT(*) per tabela → stdout JSON
  measure-db.mjs     # czasy zapytań krytycznych
  measure-page.mjs   # czasy odpowiedzi stron
  measure-dev.mjs    # czas startu dev servera i czas pierwszej kompilacji strony
  report.mjs         # sprawdza progi z perf/budget.json i dryf wzgledem ostatniego
                     # przebiegu w perf/runs/; kod wyjscia 0 albo 1
perf/
  baseline.json      # pomiar przed zmianami, commitowany
  budget.json        # progi z sekcji 4, commitowane
  runs/<data>.json   # kolejne pomiary, commitowane
```

Uruchomienie: `npm run perf` = `measure-db` + `measure-page` + `report`.
`npm run perf:dev` = `measure-dev` (osobno, bo wymaga zimnego startu).

### 1.1 `measure-page.mjs` — algorytm

```
WEJŚCIE: BASE_URL (domyślnie http://localhost:3000), lista URL-i (sekcja 3)
LOGOWANIE (obowiązkowe): proxy w src/proxy.ts przekierowuje KAŻDĄ ścieżkę poza /login
         na /login. Skrypt sam pozyskuje sesję: POST /login z AUTH_EMAIL i AUTH_PASSWORD
         z .env.local, zapamiętuje ciasteczko z nagłówka Set-Cookie i wysyła je
         w każdym kolejnym żądaniu. Brak ciasteczka = wszystkie pomiary to przekierowania
         307, czyli pomiar bezwartościowy.
DLA KAŻDEGO url:
  rozgrzewka: 3 żądania, wyniki odrzucone   # pierwsze trafienie kompiluje stronę
  pomiar:     11 żądań sekwencyjnie
  zapisz: p50 i p95 z 11 próbek, rozmiar odpowiedzi w bajtach, kod HTTP
WYJŚCIE: { [url]: { p50Ms, p95Ms, bytes, status } }
BŁĄD: status != 200 → wynik null + kod wyjścia 1 (pomiar nieważny)
```

Liczba 11 próbek: mediana z nieparzystej liczby, koszt pomiaru poniżej minuty na URL.
Rozgrzewka 3 żądania: w dev pierwsze wejście na stronę kompiluje ją i daje wynik
oderwany od rzeczywistości.

### 1.2 `measure-db.mjs` — algorytm

```
WEJŚCIE: PERF_DATABASE_URL
ZAPYTANIA KRYTYCZNE (nazwa → SQL):
  calendar-window   produkcje + wpisy kalendarza w oknie 21 dni
  productions-list  lista produkcji z joinem artysty i kamerzysty, sort po dacie
  campaign-detail   kampania + jej produkcje + kamienie milowe
  posts-analytics   posty z metrykami za ostatnie 90 dni, agregacja per platforma
DLA KAŻDEGO:
  rozgrzewka 2×, pomiar 7×, zapis p50 i p95
  dodatkowo: EXPLAIN (ANALYZE, BUFFERS) pierwszego przebiegu przez klienta postgres-js
             (nie przez psql, którego na tej maszynie nie ma) → pole `plan`
  flaga `seqScan: true` gdy plan zawiera "Seq Scan" na tabeli > 1000 wierszy
WYJŚCIE: { [nazwa]: { p50Ms, p95Ms, rows, seqScan, plan } }
```

Pole `seqScan` jest osobnym kryterium akceptacji dla issues indeksowych: po dodaniu
indeksów wszystkie cztery zapytania mają `seqScan: false`.

### 1.3 `measure-dev.mjs` — algorytm

```
usuń .next/
start `npm run dev`, mierz czas do linii "Ready" w stdout        → readyMs
GET /calendar, mierz czas pierwszej odpowiedzi                    → firstCompileMs
GET /calendar ponownie 5×                                         → warmP50Ms
dotknij src/components/calendar/gantt-view.tsx (zmiana komentarza),
  mierz czas do odpowiedzi kolejnego GET                          → hmrMs
zapisz też peak RSS procesu dev (process.memoryUsage z sondy co 1 s) → peakRssMb
zabij proces
```

To jest pomiar bólu zgłoszonego przez usera jako główny („najbardziej boli lokalnie").
`peakRssMb` weryfikuje, czy `--max-old-space-size=4096` jest potrzebny, czy jest
zabobonem.

## 2. Zestaw L — generator

`scripts/perf/seed-large.ts` wypełnia bazę deterministycznie (ziarno stałe `1337`,
zero `Math.random()` bez ziarna, żeby dwa uruchomienia dawały ten sam kształt danych):

| Tabela | Wierszy | Uwagi |
|---|---|---|
| `artists` | 200 | polskie znaki w części nazw, część bez handle |
| `videographers` | 60 | część bez lokalizacji |
| `campaigns` | 40 | rozłożone na 18 miesięcy |
| `productions` | 500 | 6 do 14 kroków każda, 20% bez artysty, 15% bez kampanii |
| `calendar_entries` | 3 000 | 60% powiązanych z produkcją |
| `posts` | 5 000 | 70% z metrykami |
| `csv_uploads` / `csv_rows` | 20 / 12 000 | |

Skala celowo przekracza realną (dziś dane są rzędu dziesiątek wierszy). Optymalizujemy
pod zapas, a różnice widać dopiero na takiej skali. Generator działa na osobnej bazie
wskazanej `PERF_DATABASE_URL` i odmawia startu, gdy URL jest równy `DATABASE_URL`
(ochrona przed zasianiem bazy roboczej).

## 3. Ścieżki mierzone

| Klucz | URL | Dlaczego ta |
|---|---|---|
| `home` | `/` | pulpit, 4 zapytania, wejście do aplikacji |
| `calendar` | `/calendar?week=2026-03-02` | gantt, największy komponent, główny podejrzany. Uwaga: oś czasu steruje parametr `view` (`week`/`month`/`quarter`), a wybór ganta kontra tabeli parametr `mode` (`gantt`/`table`), `src/app/calendar/page.tsx:110` i `:139` |
| `calendar-table` | `/calendar?week=2026-03-02&mode=table` | alternatywny widok tych samych danych |
| `productions` | `/productions/list` | długa lista |
| `production-detail` | `/productions/<id>` | 660-linijkowa strona z krokami |
| `campaign-detail` | `/campaigns/<id>` | 5 zapytań, najgęstsza strona |
| `analytics` | `/analytics` | agregacje po `posts` |

## 4. Budżety (progi twarde, zestaw L, tryb produkcyjny `next build && next start`)

| Metryka | Próg | Uzasadnienie progu |
|---|---|---|
| p95 czasu odpowiedzi `home`, `productions`, `analytics` | < 600 ms | granica, poniżej której klik czuje się natychmiastowy |
| p95 `calendar`, `campaign-detail`, `production-detail` | < 900 ms | strony najgęstsze danymi, dopuszczamy więcej |
| p95 dowolnego zapytania krytycznego | < 120 ms | zapytanie nie może zjadać więcej niż 1/5 budżetu strony |
| `seqScan` na tabeli > 1000 wierszy | brak | zasada Z9 |
| Liczba zapytań na render `calendar` | ≤ 3 | dziś 2, ma nie urosnąć przy refaktorze |
| Rozmiar JS pierwszego ładowania `/calendar` | ≤ 350 kB po gzip, **próg do skorygowania po pierwszym pomiarze** w F0-05: gdy wartość startowa jest wyższa, progiem staje się „wartość startowa minus 15%", a liczba 350 kB zostaje celem długoterminowym | pomiar z `next build`, wynik zapisany w `perf/baseline.json` |

Budżety trybu deweloperskiego (Mac mini M1, 16 GB, zimny `.next`):

| Metryka | Próg |
|---|---|
| `readyMs` (start dev servera) | < 8 000 ms |
| `firstCompileMs` (pierwsze wejście na `/calendar`) | < 15 000 ms |
| `warmP50Ms` (kolejne wejścia) | < 1 200 ms |
| `hmrMs` (zapis pliku ganta do odpowiedzi) | < 3 000 ms |
| `peakRssMb` | < 2 500 MB |

Progi deweloperskie są celami, nie wyrocznią: jeśli baseline pokaże, że któryś jest
nieosiągalny bez zmiany bundlera, to jest to dokładnie ta sytuacja, w której zasada Z2
dopuszcza zmianę stacku, i trafia na bramkę F8.

## 5. Kolejność napraw (od najtańszej do najdroższej, każda z hipotezą do obalenia)

| Krok | Zmiana | Hipoteza (co ma się poprawić) | Ryzyko |
|---|---|---|---|
| P1 | Indeksy na **wszystkich 10 kolumnach `references()`**: `productions(campaign_id)`, `productions(artist_id)`, `productions(videographer_id)`, `calendar_entries(production_id)`, `calendar_entries(campaign_id)`, `calendar_entries(artist_id)`, `posts(campaign_id)`, `posts(production_id)`, `posts(raw_csv_row_id)`, `csv_rows(upload_id)`, plus 3 kolumny sortowania: `calendar_entries(starts_at)`, `posts(published_at)`, `productions(t0_at)`. Razem 13 | `seqScan` znika, p95 zapytań spada poniżej 120 ms | niskie, migracja addytywna |
| P2 | Dwie zmiany w jednym kroku, bo osobno nie działają: (a) zrównoleglenie zapytań w Server Components przez `Promise.all` tam, gdzie zapytania są niezależne (dziś to sekwencyjne `await`, więc sam większy pool nic nie da); (b) `max: 1` → pool zależny od środowiska: `1` gdy `process.env.VERCEL`, w innym wypadku wartość z `DB_POOL_MAX`, domyślnie 10 | strony z wieloma zapytaniami przestają czekać szeregowo; największy efekt na `campaign-detail` (5 zapytań) i `home` (4) | średnie, wymaga sprawdzenia limitu połączeń providera i zależności między zapytaniami |
| P3 | Włączenie mechanizmu cache w `next.config.ts` (plik jest dziś pusty), potem zdjęcie `force-dynamic` z `src/app/layout.tsx` i z każdej strony, która nie musi go mieć. **Samo zdjęcie dyrektywy niczego nie zapisze w cache**, bo strony i tak czytają ciasteczko sesji: krok obejmuje więc opakowanie **trzech** odczytów niezależnych od użytkownika (szablony produkcji, szablony kampanii, lista osób) w `use cache` z `cacheLife('minutes')` i `cacheTag` per encja, oraz unieważnianie tagu w akcji mutującej | mniej pracy serwera na wejście, mierzalne na `productions`, `templates`, `analytics` | wysokie, mechanizm Cache Components w Next 16 wymaga sprawdzenia w dokumentacji przed użyciem |
| P4 | Zawężenie `revalidatePath('/')` do konkretnych ścieżek | mutacja nie unieważnia całej aplikacji | niskie, ale 86 miejsc do przejrzenia |
| P5 | Memoizacja ganta: podział `gantt-view.tsx` na komponent kontenerowy i wiersze, `memo` na wierszu, `useMemo` na wyliczeniach osi, `useCallback` na handlerach | `hmrMs` i responsywność interakcji; koniec zawieszek przy przewijaniu i filtrowaniu | wysokie, największy plik w repo, wymaga testów |
| P6 | Usunięcie `kształtu legacy` z gorącej ścieżki: gantt konsumuje `steps[]` bezpośrednio | mniej pracy na request, mniej kodu | wysokie, dotyka semantyki statusów |
| P7 | Domyślny bundler dev: `--turbopack` (jeśli benchmark P7 to potwierdzi) | `readyMs`, `firstCompileMs`, `hmrMs` | średnie, możliwe niezgodności |
| P8 | Zejście z liczby komponentów `'use client'` tam, gdzie nie ma interakcji | rozmiar bundla | średnie |

Kolejność jest wiążąca. Każdy krok to osobne issue z pomiarem przed i po. Krok, który
nie poprawił swojej metryki o co najmniej 10%, zostaje cofnięty i opisany
w `DECISIONS.md` jako obalona hipoteza. To jest normalny wynik, nie porażka.

## 6. Anty-spec wydajności

- Nie dodajemy **własnej** warstwy cache (Redis, cache w pamięci procesu, memoizacja
  zapytań), dopóki P1 do P4 nie są zrobione i zmierzone. Cache na nieindeksowanej bazie
  to zamiatanie pod dywan. Wyjątek, jedyny: mechanizm cache wbudowany we framework,
  opisany w kroku P3, bo on jest częścią tej kolejności, a nie obejściem.
- Nie wprowadzamy `React.lazy` i dzielenia kodu przed pomiarem rozmiaru bundla.
- Nie przepisujemy ganta na bibliotekę zewnętrzną. Problemem jest brak memoizacji,
  nie brak biblioteki.
- Nie optymalizujemy niczego, czego nie ma w tabeli z sekcji 3.
- Nie mierzymy w trybie deweloperskim rzeczy, które deklarujemy jako produkcyjne,
  i odwrotnie. Każdy wynik w `perf/runs/` ma pole `mode: "dev" | "prod"`.
