# ARCHITEKTURA

Dokument kanoniczny. Każde zdanie ma obok metodę weryfikacji, którą da się wkleić
do terminala. Gdy komenda przestanie zwracać to, co tu napisano, nieprawdziwy jest
dokument, nie kod. Data ostatniej weryfikacji: 2026-09-02, commit `df91a7b`.

Struktura sekcji jest narzucona przez `plan/02-architektura.md` sekcja 3.

---

## 1. Jednym akapitem

Marketing Crew to dyspozytornia kampanii short-form video (Reels, TikTok, Shorts).
Prowadzi produkcje od pierwszego kontaktu z artystą do publikacji i odczytu metryk:
oś czasu produkcji (widok „Pipeline"), karty produkcji z listą kroków, kampanie
z kamieniami milowymi, katalog artystów i kamerzystów, import surowej analityki
z plików CSV z Meta, TikToka i YouTube'a. Aplikacja jest jednoużytkownikowa:
logowanie to jedna para email plus hasło ze zmiennych środowiskowych, nie ma
rejestracji, ról ani kont zespołowych. Aplikacja **nie publikuje** treści na
platformach i **nie pobiera** metryk przez API; publikacja i eksport CSV zostają
po stronie człowieka. Persony agentów z katalogów `agents/` i `data/agents/`
czyta Claude Code w terminalu; aplikacja ich nie wykonuje.

---

## 2. Gdzie to stoi

**Host produkcji: Vercel. Potwierdzone przez GitHub Deployments.**

Weryfikacja:

```
gh api repos/maciejsachse0-source/Marketing-dashboard-manager/deployments \
  --jq '.[] | "\(.id) \(.environment) \(.created_at) \(.ref[0:8]) \(.creator.login)"'
```

Wynik z 2026-09-02, 29 wdrożeń, wszystkie od `vercel[bot]`, najświeższe u góry:

```
4564105017 Production 2026-05-03T20:55:54Z b53bdb38 vercel[bot]
4563550442 Preview    2026-05-03T19:19:25Z e58496d0 vercel[bot]
4563517474 Preview    2026-05-03T19:13:10Z 6eb4af4f vercel[bot]
4563490140 Preview    2026-05-03T19:08:09Z 55cc0df5 vercel[bot]
4563460286 Preview    2026-05-03T19:02:30Z 62e7c1ce vercel[bot]
4563418238 Production 2026-05-03T18:54:38Z 376b0c84 vercel[bot]
4563358872 Preview    2026-05-03T18:44:24Z 663472b6 vercel[bot]
4563338584 Preview    2026-05-03T18:40:51Z 8fb88f6c vercel[bot]
4563295500 Production 2026-05-03T18:33:01Z 9997b531 vercel[bot]
```

Statusy wdrożeń (`gh api .../deployments/<id>/statuses`):

| Wdrożenie | Stan | Adres |
|---|---|---|
| 4564105017 (ostatnie) | **failure** | `https://marketing-crew-ucifowgq9-maciejsachse0-sources-projects.vercel.app` |
| 4563418238 | success | `https://marketing-crew-cv23yycsl-maciejsachse0-sources-projects.vercel.app` |
| 4563295500 | success | `https://marketing-crew-nqz63f4k0-maciejsachse0-sources-projects.vercel.app` |

Co z tego wynika, a czego nie:

- Projekt **był** wdrażany na Vercel, ostatnio 2026-05-03, czyli cztery miesiące temu.
- **Ostatnie wdrożenie produkcyjne padło.** Ostatnie zielone wdrożenie produkcyjne
  to `4563418238`. Nie wiadomo, czy adres produkcyjny wskazuje dziś na to wdrożenie,
  bo GitHub zna tylko adresy per wdrożenie, nie alias domeny.
- Adresy powyżej to adresy per wdrożenie, nie stała domena produkcyjna. Stałej domeny
  nie da się odczytać z GitHuba; siedzi w panelu Vercela.
- Gałąź wdrożeniowa: `main`. W repozytorium jest też `origin/vercel-postgres-deploy`,
  scalona wcześniej do `main` (`git branch -a`).

**Do potwierdzenia przez usera** (to jest bramka Definition of Done fazy F0, patrz
`plan/08-BACKLOG.md`):

1. Czy adres produkcyjny jest nadal aktywny i pod jaką domeną.
2. Kto ma dostęp do panelu Vercela.
3. Czy padnięte wdrożenie z 2026-05-03 ma być naprawione, czy porzucone.

**Sprawdzone po stronie orkiestratora, 2026-09-02, i to zawęża pytanie 2.** Konto
Vercela podłączone do tego środowiska (`enkidu-png's projects`, plan hobby, team
`team_rYasmVV2hjScAFCS0lxqVHoQ`) ma 22 projekty i nie ma wśród nich tego repozytorium.
Wdrożenia z sekcji wyżej należą do konta `maciejsachse0-sources-projects`, czyli innego
właściciela. Wniosek: bez dostępu do tamtego konta domeny produkcyjnej nie odczytamy
żadnym narzędziem, i tylko user może powiedzieć, czyje to konto i kto się do niego loguje.
Dopóki to nie padnie, wszystkie trzy pytania zostają jako dług, oznaczony
`BLOCKED-ASK-USER` w `HANDOFF.md`.

Odpowiedź usera: **jeszcze nie udzielona**. Dopóki jej nie ma, przyjmujemy, że
środowiskiem docelowym jest Vercel, a jedyną bazą, do której mamy dostęp, jest
lokalny kontener z sekcji 3.

---

## 3. Baza

Aplikacja gada z PostgreSQL przez `postgres-js` opakowany w Drizzle ORM
(`src/lib/db.ts:32`).

Weryfikacja: `npm run pg:info`. Wynik z 2026-09-02:

```
zrodlo         PERF_DATABASE_URL
host           127.0.0.1:5433/marketing_perf
postgres       17.11 (Debian 17.11-1.pgdg13+2)
max_connections 100
strefa czasowa Etc/UTC
```

| Cecha | Wartość | Skąd |
|---|---|---|
| Silnik | PostgreSQL 17.11, obraz `postgres:17` na Debianie | `npm run pg:info` |
| Provider | **kontener Docker na tej maszynie**, nie hosting | `docker ps --filter name=mc-pg` |
| Region | brak, baza jest lokalna | jak wyżej |
| Limit połączeń serwera | 100 | `npm run pg:info` |
| Pula po stronie aplikacji | `1` gdy `process.env.VERCEL`, poza Vercelem `DB_POOL_MAX` z domyślną **10**; `idle_timeout: 20 s` | `src/lib/db.ts` |
| Tryb poolera | `prepare: false`, czyli klient jest gotowy na pooler w trybie transakcyjnym (pgbouncer, Neon pooled, Supabase) | `src/lib/db.ts:20` |

Trzy bazy w tym samym kontenerze, rozdzielone po to, żeby generator zestawu L nie
zasiał bazy roboczej:

| Baza | Zmienna | Rola |
|---|---|---|
| `marketing` | `DATABASE_URL` | robocza, z niej czyta `npm run dev` |
| `marketing_perf` | `PERF_DATABASE_URL` | pomiarowa, mieszka w niej zestaw L (500 produkcji) |
| `marketing_test` | `TEST_DATABASE_URL` | testowa, testy ją czyszczą między przebiegami |

**Skąd 10.** Limit połączeń serwera to 100 (`npm run pg:info`, wiersz wyżej), a poza
Vercelem aplikację obsługuje **jeden** długo żyjący proces `next start`. Dziesięć
połączeń to dziesiąta część limitu, więc obok aplikacji mieszczą się jeszcze
`npm run db:studio`, skrypty pomiarowe i `psql` w kontenerze, a jednocześnie strona
z pięcioma równoległymi zapytaniami (`/campaigns/[id]`) nie stoi w kolejce po
połączenie. Wartość jest do zmiany zmienną `DB_POOL_MAX` bez dotykania kodu.
Na Vercelu wymuszamy 1, bo tam procesów jest tyle, ile ciepłych instancji funkcji,
i każdy pomnożyłby pulę przez siebie.

**Dług, nie stan docelowy.** `DATABASE_URL` do bazy, z której korzysta wdrożenie na
Vercelu, nie został dostarczony. Kontener stanął po to, żeby dało się cokolwiek
zmierzyć. Konsekwencja: wszystkie liczby w `perf/baseline.json` mają pole
`mode: "local-docker"` i **nie zawierają czasu przelotu do bazy zdalnej**. Powód
wyboru: `DECISIONS.md`, wpis F0-01.

---

## 4. Rozmiar danych

Baza robocza `marketing`, pomiar z 2026-09-02.
Weryfikacja: `node scripts/perf/table-counts.mjs --work --json`.

```json
{
  "artists": 0,
  "videographers": 0,
  "campaigns": 0,
  "productions": 0,
  "calendar_entries": 0,
  "posts": 0,
  "csv_uploads": 0,
  "csv_rows": 0
}
```

Baza robocza jest **pusta**, bo powstała od zera w F0-01 razem z kontenerem.
Prawdziwe dane produkcyjne leżą w bazie, do której podpięte jest wdrożenie na
Vercelu, i której nie mamy (sekcja 2). Rozmiaru produkcyjnego nie znamy.

Dla porównania baza pomiarowa `marketing_perf` z zestawem L
(`node scripts/perf/table-counts.mjs --json`):

```json
{
  "artists": 200,
  "videographers": 60,
  "campaigns": 40,
  "productions": 500,
  "calendar_entries": 3000,
  "posts": 5000,
  "csv_uploads": 20,
  "csv_rows": 12000
}
```

Skala zestawu L jest celowo większa od realnej. Optymalizujemy z zapasem, a różnice
między planem z indeksem i bez widać dopiero na takich liczbach.

---

## 5. Schemat

Źródło prawdy: `drizzle/schema.ts`. Dwanaście tabel.
Weryfikacja listy: `grep -n "= pgTable(" drizzle/schema.ts` zwraca 12 linii.

| Tabela | Rola | Klucze obce (`drizzle/schema.ts`) |
|---|---|---|
| `artists` | twórcy | brak |
| `campaigns` | kampanie marketingowe | brak |
| `videographers` | kamerzyści | brak |
| `productions` | produkcja pojedynczego materiału | `artist_id` :226, `videographer_id` :227, `campaign_id` :229 |
| `calendar_entries` | wpisy na osi czasu | `artist_id` :243, `campaign_id` :244, `production_id` :245 |
| `csv_uploads` | nagłówek importu CSV | brak |
| `csv_rows` | surowe wiersze importu | `upload_id` :262 (`on delete cascade`) |
| `posts` | opublikowane materiały i metryki | `campaign_id` :274, `production_id` :275, `raw_csv_row_id` :284 |
| `agents` | metadane person agentów | brak |
| `production_templates` | szablony kroków produkcji | brak |
| `marketing_templates` | szablony kamieni milowych kampanii | brak |
| `agent_runs` | log uruchomień agentów | brak |

Dziesięć kluczy obcych, wszystkie poza `csv_rows.upload_id` z `on delete set null`.

**Indeksy: dziś są wyłącznie klucze główne.** Weryfikacja: `npm run pg:info`, sekcja
„indeksy", 12 pozycji, każda to `<tabela>_pkey`. Żadna kolumna, po której aplikacja
filtruje albo sortuje, nie ma indeksu. To jest wprost pogwałcenie zasady Z9
i pierwsza pozycja do naprawy: issue **F1-01**. Pomiar potwierdza skutek: zapytanie
okna kalendarza i zapytanie analityki idą przez Seq Scan po całych tabelach
(`node scripts/perf/measure-db.mjs`, pole `seqScan` równe `true` dla
`calendar-window` i `posts-analytics`).

Kolumny `jsonb` i ich kształty (typy w `drizzle/schema.ts` powyżej linii 165):

| Tabela.kolumna | Kształt TypeScript |
|---|---|
| `campaigns.kpis` | `Record<string, string \| number>` |
| `campaigns.periods` | `ProductionPeriods` |
| `campaigns.milestones` | `CampaignMilestones` |
| `productions.steps` | `ProductionStep[]`, `not null`, domyślnie `'[]'::jsonb` |
| `productions.periods` | `ProductionPeriods` |
| `productions.platforms` | `Platform[]` |
| `calendar_entries.platforms` | `Platform[]` |
| `csv_rows.data` | `Record<string, unknown>`, `not null` |
| `posts.hashtags` | `string[]` |
| `agents.dashboard_widget` | obiekt konfiguracji widżetu |
| `production_templates.steps`, `.periods` | kroki i okna szablonu |
| `marketing_templates.periods`, `.milestones` | okna i kamienie milowe szablonu |
| `agent_runs.input_json` | `unknown` |

Trzymanie kroków produkcji w `jsonb` jest świadomym wyborem i zostaje. Konsekwencja:
filtrowanie po zawartości `jsonb` jest drogie, więc każda wartość, po której
filtrujemy albo sortujemy, musi dostać osobną kolumnę i indeks.

---

## 6. Przepływ żądania

### 6a. Wejście na stronę, na przykładzie „Pipeline"

1. Przeglądarka wysyła `GET /calendar?week=2026-03-02`.
2. `src/proxy.ts:4` czyta ciasteczko `mc_session`, weryfikuje podpis HMAC
   (`src/lib/auth-token.ts:18`). Brak podpisu albo token starszy niż 30 dni oznacza
   przekierowanie na `/login` z parametrem `next` (`src/proxy.ts:10`).
3. `src/app/calendar/page.tsx:142` to komponent serwerowy. Czyta parametry zapytania
   (`view`, `mode`, `week`, `weeks`, `status`, `type`, `sort`, `campaign`),
   pobiera dane przez Drizzle i renderuje `GanttView` albo `GanttTableView`.
4. Drizzle woła `postgres-js` z puli o rozmiarze 1 (`src/lib/db.ts:17`).
5. Gotowy HTML wraca do przeglądarki. Strona ma `force-dynamic`, więc nie ma tu
   cache'a: każde wejście to komplet zapytań do bazy.

### 6b. Dodanie wpisu kalendarza

Ścieżka zapisu istnieje w kodzie i jest kompletna:

1. Wywołanie `createCalendarEntry(input)` z `src/server/actions/calendar.ts:17`.
   Plik ma dyrektywę `'use server'` (linia 1), więc to server action.
2. `requireSession()` (`src/server/actions/calendar.ts:18`, definicja
   `src/lib/auth.ts:41`) przerywa akcję wyjątkiem `UNAUTHORIZED`, gdy ciasteczko
   sesji nie przechodzi weryfikacji.
3. `calendarEntryInputSchema.parse(input)` (linia 19, schemat w
   `src/server/actions/schemas.ts`) waliduje wejście. Zod rzuca wyjątkiem przy
   złych danych, więc do bazy nie trafia nic niesprawdzonego.
4. `db.insert(schema.calendarEntries).values({...}).returning()` (linie 20 do 34)
   robi `INSERT` i oddaje zapisany wiersz. Daty przychodzą jako ISO string
   i są zamieniane na `Date` w `toDate` (linia 13).
5. `revalidatePath('/calendar')` i `revalidatePath('/')` (linie 35 i 36, opakowane
   w `safeRevalidatePath` z `src/server/actions/revalidate.ts`) unieważniają cache
   obu stron.
6. Akcja zwraca zapisany wiersz.

**Czego w tej ścieżce brakuje: przycisku.** `grep -rn 'createCalendarEntry' src/`
zwraca jedno trafienie, czyli samą definicję. Żaden komponent tej akcji nie woła.
Dziś wpis kalendarza dodaje się wyłącznie skryptem `tsx` z terminala albo ręką
agenta. Dyspozycja tego długu: issue **F7-09**.

---

## 7. Pliki i sekrety

Uploady (briefy, CSV, materiały, outreach) idą do Vercel Blob przez
`@vercel/blob`. Bez tokenu aplikacja spada na dysk, do katalogu
`.data-local-blob/`, i to jest udogodnienie deweloperskie, nie tryb produkcyjny.

Zmienne środowiskowe, wzorzec w `.env.example`, wartości wyłącznie w `.env.local`
(plik jest w `.gitignore` i **nigdy** nie trafia do repozytorium):

| Zmienna | Wymagana | Do czego |
|---|---|---|
| `DATABASE_URL` | tak | baza robocza aplikacji |
| `PERF_DATABASE_URL` | do pomiarów | baza z zestawem L, generator odmawia startu, gdy równa się `DATABASE_URL` |
| `TEST_DATABASE_URL` | do testów integracyjnych | testy ją czyszczą, nie może wskazywać na roboczą ani pomiarową |
| `SESSION_SECRET` | tak, minimum 32 znaki | podpis ciasteczka sesji, `openssl rand -base64 48` |
| `AUTH_EMAIL`, `AUTH_PASSWORD` | tak | jedyna para logowania, domyślnie `admin@demo.pl` i `demo` |
| `BLOB_READ_WRITE_TOKEN` | nie lokalnie | Vercel Blob, bez niego fallback na dysk |
| `DB_POOL_MAX` | nie | rozmiar puli, puste znaczy wartość domyślna sterownika |

Gdzie sekretów **nie** ma być: w `README.md`, w `CLAUDE.md`, w plikach `plan/`,
w treści issues i w komunikatach commitów. Weryfikacja: `git ls-files | grep -c '\.env'`
zwraca `1`, i tym jednym plikiem jest `.env.example` z wartościami zastępczymi.

---

## 8. Uruchomienie lokalne

Od pustego katalogu do działającej aplikacji:

```
git clone <adres repozytorium> && cd Marketing-dashboard-manager
npm install

# Baza. Na tej maszynie stoi kontener Docker; na nowej trzeba go postawić:
docker run -d --name mc-pg -p 5433:5432 \
  -e POSTGRES_PASSWORD=mc -e POSTGRES_DB=marketing postgres:17
docker exec mc-pg psql -U postgres -c 'create database marketing_perf'
docker exec mc-pg psql -U postgres -c 'create database marketing_test'

cp .env.example .env.local        # i uzupełnij wartości, patrz sekcja 7
npm run db:migrate                # migracje Drizzle na bazę roboczą
npm run dev                       # http://localhost:3000, webpack
```

Kontener przy kolejnych sesjach wystarczy wznowić: `docker start mc-pg`.

Komendy sprawdzające, wszystkie kończą się kodem 0 poza `perf` (patrz niżej):

| Komenda | Co robi |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, dziś 0 błędów i 205 ostrzeżeń, każde ma issue w fazie F7 |
| `npm run test` | testy jednostkowe, Vitest |
| `npm run e2e` | test przeglądarkowy logowania, Playwright |
| `npm run pg:info` | wersja bazy, indeksy, liczby wierszy |
| `npm run perf` | pomiar bazy i stron plus raport progów |
| `npm run perf:dev` | pomiar trybu deweloperskiego, wymaga zimnego `.next` |
| `npm run perf:serve` | build i serwer produkcyjny wpięty w bazę pomiarową |

`npm run perf` kończy się dziś kodem **1** i to jest stan oczekiwany: raport wypisuje
trzy przekroczone progi (dwa Seq Scany i rozmiar JavaScriptu strony `/calendar`).
Ich naprawa to fazy F1 i F2.

Pomiar stron wymaga kolejności: najpierw `npm run perf:serve` w jednym terminalu,
potem `npm run perf` w drugim. Bez tego `measure-page.mjs` mierzy albo serwer
deweloperski, albo pustkę, i w obu wypadkach kończy się kodem 1.

---

## 9. Granice i długi

Czego aplikacja nie robi:

- nie publikuje treści na Instagramie, TikToku ani YouTubie, przygotowuje materiał
  i copy, wysyłkę robi człowiek,
- nie pobiera metryk przez API platform, jedyne wejście to import pliku CSV,
- nie ma kont, ról ani zespołów, logowanie to jedna para z `.env.local`,
- nie wykonuje agentów, persony z `agents/` i `data/agents/` czyta Claude Code.

Długi zapisane jako issues w `plan/08-BACKLOG.md`:

| Dług | Issue |
|---|---|
| Zero indeksów poza kluczami głównymi, dwa Seq Scany na tabelach powyżej 1000 wierszy | F1-01 |
| Rozmiar JavaScriptu pierwszego ładowania `/calendar`: 354.8 kB po gzip przy celu 350 kB | faza F2 |
| Brak `DATABASE_URL` do bazy produkcyjnej, pomiary robione na kontenerze lokalnym | F0-01, wpis w `DECISIONS.md` |
| Ostatnie wdrożenie produkcyjne na Vercelu padło 2026-05-03, nikt tego nie tknął | sekcja 2, czeka na decyzję usera |
| 11 wywołań `setState` w efekcie, 6 naruszeń czystości renderu, 63 funkcje ponad progiem złożoności, 17 martwych zmiennych | F7-01 do F7-07 |
| Lewy pasek akcentu wbrew zasadzie Z8 | F7-08 |
| `createCalendarEntry` nie ma żadnego wywołania z interfejsu | F7-09 |
| `videographers` nie ma kolumn `handle`, `email`, `phone`, żadna z tabel osób nie ma `location`, co blokuje import z Excela | F4-00 |

Kształt zastany, który wygląda na dług, a nim nie jest:

- `steps` i `periods` w `jsonb` zamiast w tabelach zależnych. Wybór świadomy, zostaje.
  Cena: po zawartości `jsonb` nie filtrujemy, wszystko filtrowane dostaje osobną
  kolumnę z indeksem.
- Pula połączeń zależna od środowiska: `1` na Vercelu (każda ciepła instancja
  funkcji obsługuje jedno żądanie naraz), `DB_POOL_MAX` z domyślną 10 poza nim.
  Do issue F1-02 było twarde `max: 1` wszędzie, co dławiło zrównoleglone zapytania
  na serwerze lokalnym.

**Uwaga historyczna, żeby nie wracała przy czytaniu starych plików.** Pierwsza wersja
projektu stała na SQLite przez `better-sqlite3`, z plikiem bazy w `data/`. Ten stan
nie istnieje od migracji na PostgreSQL. Dwa pliki `*.bak.db` w repozytorium to
pozostałość po tamtej wersji i zostały usunięte w issue F0-07; opisy w `README.md`
i `CLAUDE.md`, które mówiły o SQLite, tam samo zostały zastąpione odesłaniem do tego
dokumentu.
