# ARCHITEKTURA

Dokument kanoniczny. Każde zdanie ma obok metodę weryfikacji, którą da się wkleić
do terminala. Gdy komenda przestanie zwracać to, co tu napisano, nieprawdziwy jest
dokument, nie kod. Data ostatniej weryfikacji: **2026-09-03**, po fazie F6
(issue F6-03). Dziesięć twierdzeń tego dokumentu sprawdzono komendą tego samego dnia,
lista komend i wyników jest w załączniku na końcu.

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

### 2.1 Środowisko podglądowe dla zespołu (F5-04)

Cel: ekipa klika aplikację i zgłasza uwagi, nic u siebie nie stawiając. Środowisko
stoi **na danych syntetycznych** (zestaw L) i na **osobnej bazie**, więc klikanie
zespołu nie rusza ani bazy roboczej, ani bazy pomiarowej, na której stoją progi.

Postawienie na tej maszynie, dwie komendy:

```
npm run preview:setup    # schemat + zestaw L na bazie marketing_preview
npm run preview:serve    # next build && next start -p 3001 -H 0.0.0.0
```

| Rzecz | Wartość |
|---|---|
| Adres w sieci lokalnej | `http://192.168.1.42:3001` (ta maszyna, ta sama sieć Wi-Fi) |
| Baza | `postgres://…@127.0.0.1:5433/**marketing_preview**` (`PREVIEW_DATABASE_URL`) |
| Baza robocza, dla porównania | `postgres://…@127.0.0.1:5433/**marketing**` (`DATABASE_URL`) |
| Baza pomiarowa | `postgres://…@127.0.0.1:5433/**marketing_perf**` (`PERF_DATABASE_URL`) |
| Zawartość | zestaw L: 200 artystów, 60 kamerzystów, 40 kampanii, 500 produkcji, 3 000 wpisów kalendarza, 5 000 postów, 12 000 wierszy CSV; wszystkie nazwy z generatora `scripts/perf/seed-large.ts` (ziarno 1337) |
| Logowanie | ta sama para co lokalnie: `AUTH_EMAIL` i `AUTH_PASSWORD` z `.env.local`. Środowisko podglądowe MA mieć własną parę — ustaw ją w środowisku procesu przed `preview:serve` |

**Adres musi być po https, inaczej nikt się nie zaloguje.** `next start` biegnie
z `NODE_ENV=production`, a `createSession` ustawia wtedy ciasteczko sesji z flagą
`secure` (`src/lib/auth.ts`). Po zwykłym `http://` przeglądarka ciasteczka nie
zapisze: formularz przyjmie hasło, a następna strona odbije z powrotem na `/login`.
Zmierzone 2026-09-03 na `http://192.168.1.42:3001` — dokładnie takie odbicie.

Sprawdzone przejście po https, na tailnecie tej maszyny:

```
tailscale serve --bg --https=8443 http://127.0.0.1:3001
# adres: https://jans-mac-mini.tailb37a7a.ts.net:8443
tailscale serve --https=8443 off        # wyłączenie
```

Logowanie i lista 500 produkcji działają (zrzut:
`screenshots/F5/F5-05-srodowisko-podgladowe.png`). Serwowanie zostało po sprawdzeniu
**wyłączone**, bo tailnet wymaga od członka zespołu instalacji Tailscale, a warunek
z `plan/06` sekcja 5 brzmi „bez stawiania czegokolwiek u siebie".

**Czego brakuje do adresu, który zespół otwiera bez instalowania czegokolwiek**
(`BLOCKED-ASK-USER`, decyzja usera, nie agenta):

1. **Najtaniej: `tailscale funnel --bg --https=443 http://127.0.0.1:3001`** — publiczny
   adres `https://jans-mac-mini.tailb37a7a.ts.net`, zero kont, zero opłat, działa
   dopóki ta maszyna stoi. Wymaga zgody usera, bo wystawia aplikację publicznie
   (dane syntetyczne, ale logowanie jest jednym hasłem) i zajmuje port 443, na którym
   siedzi dziś vibe-kanban.
2. **Hosting: Vercel plus baza (Neon albo inny Postgres)** — wymaga konta z sekcji 2,
   wypchnięcia repozytorium poza tę maszynę i zmiennych środowiskowych po stronie
   hostingu. Repozytorium ma w historii gita prawdziwe dane osobowe (sekcja 9), więc
   wypchnięcie go gdziekolwiek jest osobną decyzją usera.

Do czasu tej decyzji środowiskiem podglądowym jest adres w sieci lokalnej z tabeli
wyżej, a `WERYFIKACJA.md` w korzeniu repozytorium czeka z gotowym szkieletem.

---

## 3. Baza

Aplikacja gada z PostgreSQL przez `postgres-js` opakowany w Drizzle ORM
(`src/lib/db.ts:34`).

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
| Pula po stronie aplikacji | `1` gdy `process.env.VERCEL`, poza Vercelem `DB_POOL_MAX` z domyślną **10**; `idle_timeout: 20 s` | `src/lib/db.ts:25` i `:26` (ustawione w F1-02) |
| Tryb poolera | `prepare: false`, czyli klient jest gotowy na pooler w trybie transakcyjnym (pgbouncer, Neon pooled, Supabase) | `src/lib/db.ts:20` |
| Cache odczytów | **brak**, świadomie. Strony zostają przy `force-dynamic`, mechanizm Cache Components z Next 16 został w F1-03 wdrożony, zmierzony i cofnięty (żadna z siedmiu mierzonych stron nie poprawiła się o 10%). Powrót do tematu: F7-10 i F7-11 | `DECISIONS.md`, wpis F1-03 |

Trzy bazy w tym samym kontenerze, rozdzielone po to, żeby generator zestawu L nie
zasiał bazy roboczej:

| Baza | Zmienna | Rola |
|---|---|---|
| `marketing` | `DATABASE_URL` | robocza, z niej czyta `npm run dev` |
| `marketing_perf` | `PERF_DATABASE_URL` | pomiarowa, mieszka w niej zestaw L (500 produkcji) |
| `marketing_test` | `TEST_DATABASE_URL` | testowa, testy jednostkowe i **e2e** ją czyszczą przed przebiegiem (F7-21) |
| `marketing_preview` | `PREVIEW_DATABASE_URL` | podglądowa dla zespołu (sekcja 2.1), też zestaw L |

**Skąd 10.** Limit połączeń serwera to 100 (`npm run pg:info`, wiersz wyżej), a poza
Vercelem aplikację obsługuje **jeden** długo żyjący proces `next start`. Dziesięć
połączeń to dziesiąta część limitu, więc obok aplikacji mieszczą się jeszcze
`npm run db:studio`, skrypty pomiarowe i `psql` w kontenerze (`psql` **nie jest**
zainstalowany na hoście, wchodzi się przez `docker exec mc-pg psql`), a jednocześnie strona
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

Baza robocza `marketing`, pomiar z **2026-09-03** (data domknięcia dokumentu).
Weryfikacja: `node scripts/perf/table-counts.mjs --work --json`.

```json
{
  "artists": 102,
  "videographers": 0,
  "campaigns": 19,
  "productions": 67,
  "calendar_entries": 0,
  "posts": 0,
  "csv_uploads": 0,
  "csv_rows": 0
}
```

Baza robocza powstała pusta w F0-01 razem z kontenerem. Wiersze, które w niej dziś
są, zrobiły testy i ręczne klikanie w trakcie faz F1 do F6: 102 artystów (import
z fixture'a w `e2e/import-osoby.spec.ts` i scenariusze odświeżania), 19 kampanii
i 67 produkcji z e2e. Nie ma tam ani jednego prawdziwego nazwiska.
Prawdziwe dane produkcyjne leżą w bazie, do której podpięte jest wdrożenie na
Vercelu, i której nie mamy (sekcja 2). Rozmiaru produkcyjnego nie znamy.

Dla porównania baza pomiarowa `marketing_perf` z zestawem L
(`node scripts/perf/table-counts.mjs --json`, ten sam skrypt bez `--work`):

```json
{
  "artists": 209,
  "videographers": 60,
  "campaigns": 40,
  "productions": 506,
  "calendar_entries": 3000,
  "posts": 5000,
  "csv_uploads": 20,
  "csv_rows": 12000
}
```

Zestaw L sieje 200 artystów i 500 produkcji; nadwyżka (209 i 506) to wiersze
dopisane przez pomiary stron i scenariusze e2e puszczane na tej bazie.
Baza podglądowa `marketing_preview` (sekcja 2.1) niesie ten sam zestaw L.

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

**Indeksy: 25 pozycji, z tego 12 kluczy głównych i 13 dołożonych w F1-01.**
Weryfikacja: `npm run pg:info`, sekcja „indeksy". Stan zastany był inny — do F1-01
istniały wyłącznie klucze główne, a zapytanie okna kalendarza i zapytanie analityki
szły przez Seq Scan po całych tabelach.

| Tabela | Indeksy poza kluczem głównym |
|---|---|
| `productions` | `productions_t0_at_idx`, `productions_artist_id_idx`, `productions_videographer_id_idx`, `productions_campaign_id_idx` |
| `calendar_entries` | `calendar_entries_starts_at_idx`, `calendar_entries_artist_id_idx`, `calendar_entries_campaign_id_idx`, `calendar_entries_production_id_idx` |
| `posts` | `posts_published_at_idx`, `posts_campaign_id_idx`, `posts_production_id_idx`, `posts_raw_csv_row_id_idx` |
| `csv_rows` | `csv_rows_upload_id_idx` |

Skutek zmierzony: `node scripts/perf/measure-db.mjs` daje dziś `seqScan: false`
dla `calendar-window` i `posts-analytics`, a p95 czterech zapytań kontrolnych mieści
się poniżej 1,5 ms przy limicie 120 ms (`npm run perf`, sekcja BAZA).

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
2. `src/proxy.ts:6` czyta ciasteczko `mc_session`, weryfikuje podpis HMAC
   (`verifySessionToken` z `src/lib/auth-token.ts`). Brak podpisu albo token starszy
   niż 30 dni oznacza przekierowanie na `/login` z parametrem `next`
   (`src/proxy.ts:17` i `:24`).
3. `src/app/calendar/page.tsx:75` to komponent serwerowy. Czyta parametry zapytania
   (`view`, `mode`, `week`, `weeks`, `status`, `type`, `sort`, `campaign`),
   pobiera dane przez Drizzle i renderuje `GanttView` albo `GanttTableView`.
4. Drizzle woła `postgres-js` z puli o rozmiarze `DB_POOL_MAX`, domyślnie 10
   (`src/lib/db.ts:25`); na Vercelu 1.
5. Gotowy HTML wraca do przeglądarki. Strona ma `force-dynamic`, więc nie ma tu
   cache'a: każde wejście to komplet zapytań do bazy.

### 6b. Dodanie wpisu kalendarza

Ścieżka zapisu istnieje w kodzie i jest kompletna:

1. Wywołanie `createCalendarEntry(input)` z `src/server/actions/calendar.ts:18`.
   Plik ma dyrektywę `'use server'` (linia 1), więc to server action.
2. `requireSession()` (linia 19, definicja `src/lib/auth.ts:41`) przerywa akcję
   wyjątkiem `UNAUTHORIZED`, gdy ciasteczko sesji nie przechodzi weryfikacji.
3. `calendarEntryInputSchema.parse(input)` (linia 20, schemat w
   `src/server/actions/schemas.ts`) waliduje wejście. Zod rzuca wyjątkiem przy
   złych danych, więc do bazy nie trafia nic niesprawdzonego.
4. `db.insert(schema.calendarEntries).values({...}).returning()` (linie 21 do 35)
   robi `INSERT` i oddaje zapisany wiersz. Daty przychodzą jako ISO string
   i są zamieniane na `Date` w `toDate` (linia 14).
5. `revalidatePath('/calendar')` i `revalidatePath('/', 'page')` (linie 36 i 40,
   opakowane w `safeRevalidatePath` z `src/server/actions/revalidate.ts`)
   unieważniają cache obu stron.
6. Akcja zwraca zapisany wiersz.

**Ten sam schemat obowiązuje na każdej granicy zaufania (zasada Z13, issue F6-02).**
Punktów wejścia jest 73: cztery handlery w `src/app/api/` i 69 eksportowanych akcji
serwerowych. Każdy, który bierze argumenty, parsuje je schematem Zod, zanim dotknie
bazy. Lista „punkt wejścia — schemat" nie jest przepisywana ręcznie do tego dokumentu,
bo rozjechałaby się z kodem; generuje ją komenda:

```
node scripts/check-trust-boundaries.mjs      # kod 0, „Bez schematu mimo argumentów: 0"
```

### 6c. Import osób z arkusza (`/import/osoby`)

Ekran ma siedem kroków (`plan/04-import-excel.md` sekcja 2), komponenty w
`src/components/import/`, logika czysta w `src/lib/import/`:

1. **Plik** — `ImportDropzone`. Rozszerzenie i rozmiar sprawdza `checkFile`
   jeszcze w przeglądarce, `POST /api/import/people` sprawdza je drugi raz na serwerze
   (przeglądarce się nie ufa). Limity: 10 MB i 5 000 wierszy na arkusz
   (`src/lib/import/limits.ts`). Arkusz **nie jest zapisywany** ani w repozytorium,
   ani w `data/` — żyje w pamięci procesu.
2. **Arkusz i rola** — który arkusz skoroszytu i czy to twórcy, czy kamerzyści.
   Rola nigdy nie jest zgadywana z zawartości. Arkusz bez wierszy danych blokuje
   przejście dalej.
3. **Mapowanie** — kolumna arkusza na pole osoby, propozycja z `autoMap`.
   Dwie kolumny na jedno pole to kolizja: oba pola dostają `aria-invalid`, komunikat
   wskazuje kolidujące kolumny, guzik dalej jest zablokowany. Poniżej 768 px tabela
   mapowania przechodzi w listę kart (F6-01).
4. **Suchy przebieg** — `dryRun` liczy plan w przeglądarce z tych samych funkcji,
   których serwer używa do zapisu, więc zmiana mapowania przelicza podgląd
   **bez ponownego wysyłania pliku**.
5. **Zatwierdzenie** — polityka duplikatów: pomiń albo zaktualizuj.
6. **Zapis** — `POST /api/import/people/save` oddaje strumień NDJSON, po jednej linii
   na zapisaną paczkę, całość w jednej transakcji. Serwer liczy plan od zera; to, co
   policzyła przeglądarka, jest wyłącznie podglądem.
7. **Podsumowanie** — liczby i odnośnik do `/artists` albo `/videographers`.

Import **nigdy nie usuwa** osób nieobecnych w arkuszu.

**W ścieżce zapisu wpisu kalendarza nie ma przycisku i to jest decyzja, nie luka.**
`grep -rn 'createCalendarEntry' src/` zwraca jedno trafienie, czyli samą definicję.
Wpisy kalendarza powstają dziś dwiema drogami, żadna nie prowadzi przez formularz:

1. **Z interfejsu, ubocznie.** Ustawienie daty kroku produkcji woła
   `upsertCalendarEntryForStep` z `src/server/actions/production-steps.ts`, które
   zakłada albo aktualizuje wpis dla tego kroku (`production-steps.ts`, funkcja
   `upsertCalendarEntryForStep`, wołana wyłącznie z `setStepDate`).
2. **Od agenta, skryptem.** Claude Code pisze do `calendar_entries` przez
   `db.insert(schema.calendarEntries)` w skrypcie `tsx`, zgodnie z sekcją
   „Kiedy potrzebujesz ad-hoc query" w `CLAUDE.md`.

Czego droga druga **nie** robi: nie importuje `createCalendarEntry`. Zmierzone
2026-09-03: import tej akcji do skryptu `tsx` kończy się wyjątkiem, bo
`requireSession()` ciągnie `src/lib/auth.ts`, a ten pakiet `server-only`, który
poza kontekstem żądania rzuca od razu. Przepisy w `agents/schedule-manager.md`
i `agents/campaign-strategist.md` pokazują ten import jako działający, więc kłamią;
zapisane jako **F7-30**. Same akcje zostają: to jedyna ścieżka zapisu z walidacją
Zod i sesją, gotowa pod przycisk, gdy user go zamówi. Nagłówek
`src/server/actions/calendar.ts` mówi to wprost, żeby nikt nie skasował ich jako
„martwego kodu". Rozstrzygnięte w **F7-09**, uzasadnienie w `DECISIONS.md`.

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
| `PREVIEW_DATABASE_URL` | do środowiska podglądowego | baza `marketing_preview` (sekcja 2.1) |
| `DB_POOL_MAX` | nie | rozmiar puli, puste znaczy wartość domyślna 10 |

Gdzie sekretów **nie** ma być: w `README.md`, w `CLAUDE.md`, w plikach `plan/`,
w treści issues i w komunikatach commitów. Weryfikacja: `git ls-files | grep -c '\.env'`
zwraca `1`, i tym jednym plikiem jest `.env.example` z wartościami zastępczymi.

**Arkusze i pliki danych też nie wchodzą do repozytorium** (zasada Z14, issue F6-02):

```
git ls-files | grep -E '\.env|\.xlsx|\.db$' | grep -v '^\.env\.example$' | wc -l   # 0
```

W `.gitignore` siedzą `/tests/fixtures/*.xlsx` i `/.data-import/`. Fixture do testów
importu jest generowany deterministycznie (`npx tsx scripts/make-fixture-xlsx.ts`),
a `e2e/import-osoby.spec.ts` odtwarza go sam, gdy pliku nie ma.

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
| `npm run lint` | ESLint, dziś **0 błędów i 36 ostrzeżeń**, każde ma issue w fazie F7. Reguła `no-restricted-syntax` na surowym `<button>` jest błędem, lista wyjątków jest pusta |
| `npm run test` | 223 testy jednostkowe w 20 plikach, Vitest |
| `npm run e2e` | 22 scenariusze przeglądarkowe, Playwright. Serwer stawia `scripts/e2e-serve.mjs`: czyści i zasiewa bazę **testową**, dopiero potem `next dev` (F7-21). `reuseExistingServer: true`, więc stojący serwer na porcie 3000 zostanie użyty — i odrzucony przez `e2e/global-setup.ts`, gdy siedzi na innej bazie |
| `npm run pg:info` | wersja bazy, indeksy, liczby wierszy |
| `npm run perf` | pomiar bazy i stron plus raport progów |
| `npm run perf:dev` | pomiar trybu deweloperskiego, wymaga zimnego `.next` |
| `npm run perf:serve` | build i serwer produkcyjny wpięty w bazę pomiarową |
| `node scripts/check-typography.mjs` | bramka zasad Z5, Z6 i Z7 (typografia, zero emoji) |
| `node scripts/check-trust-boundaries.mjs` | lista punktów wejścia i ich schematów Zod (Z13) |
| `node scripts/a11y-audit.mjs` | audyt dostępności na uruchomionej aplikacji (F6-01) |
| `node scripts/perf/drift-selftest.mjs` | reguła dryfu przepuszczona przez całą historię przebiegów |
| `npm run preview:setup`, `npm run preview:serve` | środowisko podglądowe dla zespołu (sekcja 2.1) |

`npm run perf` kończy się dziś kodem **0**. Stan zastany był inny: raport wypisywał
trzy przekroczone progi (dwa Seq Scany i rozmiar JavaScriptu `/calendar`), naprawiły
je fazy F1 i F2. Bundel `/calendar` waży dziś 292,6 kB po gzip przy progu 301,6 kB.
Raport blokuje też przy dryfie: potrzeba jednocześnie ≥30% pogorszenia i pogorszenia
większego niż 10% limitu metryki, bo sam procent zapala się na szumie maszyny
(zmierzone 242% między kolejnymi przebiegami tej samej metryki).

**Bundler: `dev` to turbopack** (F7-14; wcześniej, od F2-05, był webpack).
Turbopack wygrywa każdą metrykę czasu — HMR 466 ms wobec 1961 ms, czyli 4x —
a różnica wyglądu, przez którą F2-05 go odrzucił, przestała występować: pas T
z siatką dni jest na turbopacku **piksel w piksel taki sam jak na `next start`**
(0 różnych pikseli na zrzucie elementu), a cała strona `/calendar?view=week`
różni się od produkcyjnej o 6 832 piksele, czyli **mniej niż webpack** (7 417).
`npm run dev:alt` uruchamia webpacka dla kogoś, kto chce starego zachowania.
Pomiary: `DECISIONS.md`, wpisy F2-05 i F7-14.

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

Długi zapisane jako issues w `plan/08-BACKLOG.md`, faza **F7-ZNALEZISKA**. Lista jest
kompletna: każdy otwarty dług ma numer, żaden nie żyje wyłącznie w akapicie
(zasada Z15). Stan na 2026-09-03: **25 otwartych issues**, żadne blokujące.

| Dług | Issue |
|---|---|
| `setState` wołany wprost w `useEffect` w 10 komponentach (11 trafień) | F7-01 |
| Naruszenia `react-hooks/purity` w 6 plikach, w tym w gancie | F7-02 |
| `react-hooks/immutability` i `react-hooks/refs` | F7-03 |
| Dwa `<a href>` na trasy wewnętrzne zamiast `<Link>` | F7-04 |
| Pięć niezaescapowanych apostrofów i cudzysłowów w JSX | F7-05 |
| 63 funkcje ponad progiem złożoności 10 | F7-06 |
| 17 nieużywanych zmiennych i importów | F7-07 |
| Lewy pasek akcentu wbrew zasadzie Z8 | F7-08 |
| `createCalendarEntry` nie ma wywołania z interfejsu, świadomie | F7-09 |
| Zestaw L nie zasiewa katalogów, więc krok P3 był niemierzalny | F7-10 |
| Powrót do Cache Components na danych, które istnieją | F7-11 |
| Martwy kod w gancie: dwie funkcje i dwa importy bez odbiorcy | F7-12 |
| Gant nadal na liście grandfather w ESLint | F7-13 |
| Turbopack gubi siatkę dni w pasach T (82 921 pikseli różnicy) | F7-14 |
| Mikro-etykieta sekcji powielona 90 razy w pięciu wariantach | F7-15 |
| Trzy komponenty z `ui/` bez ani jednego użycia | F7-16 |
| Długie myślniki w treściach z `data/`, poza zakresem Z7 | F7-17 |
| `npx playwright test` po cichu bierze stojący serwer i jego bazę | F7-18 |
| Przeniesienie danych z `videographers.contact` do `handle` i `email` | F7-19 (dawniej F4-00) |
| Pole wyboru pokazuje surową wartość zamiast etykiety | F7-20 |
| Testy e2e importu piszą do bazy roboczej | F7-21 |
| `AGENTS.md` wskazuje nieistniejący plik planu | F7-22 |
| Dwa prawdziwe handle z Instagrama zostały w historii gita | F7-23 |
| Tytułu produkcji nie widać na jej stronie ani na liście | F7-24 |
| Odnośniki nawigacji poniżej 44 px obszaru dotyku | F7-25 |

Poza fazą F7 czekają jeszcze:

| Sprawa | Gdzie |
|---|---|
| Brak `DATABASE_URL` do bazy produkcyjnej; wszystkie pomiary z kontenera lokalnego | F0-01, `DECISIONS.md` |
| Ostatnie wdrożenie na Vercelu padło 2026-05-03, nikt tego nie tknął | sekcja 2, decyzja usera |
| Publiczny adres środowiska podglądowego (`tailscale funnel` kontra hosting) | F5-04, `BLOCKED-ASK-USER`, sekcja 2.1 |
| Import listy osób z prawdziwego pliku `.xlsx`, którego user jeszcze nie dostarczył | F4-06, ⏳ |
| Wyczyszczenie historii gita z danych osobowych | F4-07, F7-23, decyzja usera |
| Potwierdzenie treści tego dokumentu przez usera | F8-01 |

Kształt zastany, który wygląda na dług, a nim nie jest:

- `steps` i `periods` w `jsonb` zamiast w tabelach zależnych. Wybór świadomy, zostaje.
  Cena: po zawartości `jsonb` nie filtrujemy, wszystko filtrowane dostaje osobną
  kolumnę z indeksem.
- Pula połączeń zależna od środowiska: `1` na Vercelu (każda ciepła instancja
  funkcji obsługuje jedno żądanie naraz), `DB_POOL_MAX` z domyślną 10 poza nim.
  Do issue F1-02 było twarde `max: 1` wszędzie, co dławiło zrównoleglone zapytania
  na serwerze lokalnym.

**Dane osobowe, które były w kodzie.** Do issue F4-07 w repozytorium leżał skrypt
`scripts/import-people.ts`: jednorazowy import osób z arkusza Google, z prawdziwymi
imionami, lokalizacjami i handle'ami z Instagrama wpisanymi na sztywno w dwóch tablicach
(13 kamerzystów i 45 twórców), plus adres tamtego arkusza w komentarzu. Skrypt został
usunięty, a jego robotę przejął ekran `/import/osoby` (kroki 1 do 7, `plan/04-import-excel.md`),
który przyjmuje te same dane z pliku xlsx, nie z kodu. Nic, co robił skrypt, nie zniknęło:
pola `contact`, `hourlyRate`, `equipment` i `availabilityNotes` kamerzysty wypełnia
okno edycji osoby, reszta idzie importem.

Usunięcie pliku **nie czyści historii gita**. Te imiona, lokalizacje i handle nadal
siedzą w każdym commicie sprzed F4-07 i wyjmie je stamtąd każdy, kto sklonuje
repozytorium. Wyczyszczenie historii (`git filter-repo`, `BFG`) przepisuje wszystkie
commity, zmienia każdy hash i wymaga wymuszonego pusha oraz ponownego sklonowania
u wszystkich, którzy repozytorium mają. To jest **decyzja usera**, nie agenta, i nie
została podjęta. Rekomendacja: jeżeli repozytorium ma kiedykolwiek trafić poza jeden
prywatny komputer, historię wyczyścić przed tym krokiem, a nie po nim. Do tego czasu
obowiązuje zasada Z14: żadne prawdziwe imię, handle, adres ani telefon nie wchodzi
do repozytorium, a arkusze żyją w `.data-import/` poza gitem.

**Uwaga historyczna, żeby nie wracała przy czytaniu starych plików.** Pierwsza wersja
projektu stała na SQLite przez `better-sqlite3`, z plikiem bazy w `data/`. Ten stan
nie istnieje od migracji na PostgreSQL. Dwa pliki `*.bak.db` w repozytorium to
pozostałość po tamtej wersji i zostały usunięte w issue F0-07; opisy w `README.md`
i `CLAUDE.md`, które mówiły o SQLite, tam samo zostały zastąpione odesłaniem do tego
dokumentu.

---

## Załącznik: dziesięć twierdzeń tego dokumentu sprawdzonych komendą

Wykonane **2026-09-03**, na tej maszynie, przy kontenerze `mc-pg` w biegu
(issue F6-03, kryterium „weryfikacja zgodności z kodem wykonana TERAZ").
Żadne z dziesięciu nie okazało się fałszywe po poprawkach opisanych niżej.

| # | Twierdzenie | Komenda | Wynik |
|---|---|---|---|
| 1 | Baza to PostgreSQL 17.11, limit połączeń 100 (sekcja 3) | `npm run pg:info` | `postgres 17.11 (Debian 17.11-1.pgdg13+2)`, `max_connections 100` |
| 2 | Indeksów jest 25, z tego 13 poza kluczami głównymi (sekcja 5) | `npm run pg:info \| sed -n '/^indeksy/,/^$/p' \| grep -c '_idx'` | `13`, nagłówek sekcji mówi `indeksy (25)` |
| 3 | Tabel jest dwanaście (sekcja 5) | `grep -c '= pgTable(' drizzle/schema.ts` | `12` |
| 4 | Pula połączeń: 1 na Vercelu, poza nim `DB_POOL_MAX` (sekcja 3) | `grep -n 'max: process.env.VERCEL' src/lib/db.ts` | `25:    max: process.env.VERCEL ? 1 : env.DB_POOL_MAX,` |
| 5 | Cache odczytów nie ma, strony zostają dynamiczne (sekcja 3) | `grep -rn 'force-dynamic' src/app \| wc -l` | `28` deklaracji, żadnego `use cache` w kodzie |
| 6 | Zapytania kontrolne nie idą przez Seq Scan (sekcja 5) | `node scripts/perf/measure-db.mjs` | `seqScan: nie` dla wszystkich czterech; p95 od 0,74 do 1,28 ms przy limicie 120 ms |
| 7 | Baza robocza ma 102 artystów, 19 kampanii, 67 produkcji (sekcja 4) | `node scripts/perf/table-counts.mjs --work --json` | dokładnie te liczby, reszta tabel zero |
| 8 | Każdy z 73 punktów wejścia waliduje wejście Zodem (sekcja 6) | `node scripts/check-trust-boundaries.mjs` | `Punktów wejścia: 73. Bez schematu mimo argumentów: 0.`, kod 0 |
| 9 | W repozytorium nie ma sekretów ani arkuszy (sekcja 7) | `git ls-files \| grep -E '\.env\|\.xlsx\|\.db$' \| grep -v '^\.env\.example$' \| wc -l` | `0` |
| 10 | `npm run dev` to turbopack, webpack siedzi pod `dev:alt` (sekcja 8) | `node -p "require('./package.json').scripts.dev"` | `node scripts/dev-prestart.mjs && next dev --turbopack` |

Dodatkowo, jako kontrola bramek z sekcji 8: `npm run typecheck` kod 0,
`npm run lint` 0 błędów i 108 ostrzeżeń, `npm run test` 216 zielonych w 20 plikach,
`npx playwright test` 22 zielone, `npm run perf` kod 0 z bundlem `/calendar`
292,6 kB przy progu 301,6 kB.

**Co się nie zgadzało i zostało poprawione w tym samym issue** (dokument kłamał,
nie kod):

1. Sekcja 5 twierdziła, że indeksami są wyłącznie klucze główne i że
   `calendar-window` oraz `posts-analytics` idą przez Seq Scan. Nieprawda od F1-01:
   indeksów jest 25, `seqScan` jest `nie`. Tabela indeksów dopisana.
2. Sekcja 4 podawała bazę roboczą jako pustą (same zera). Nieprawda: 102 artystów,
   19 kampanii, 67 produkcji od testów i klikania w fazach F1 do F6.
3. Sekcja 8 twierdziła, że `npm run perf` kończy się kodem 1 i że to stan oczekiwany.
   Nieprawda od F2: kod 0. Poprawione razem z liczbą ostrzeżeń ESLint (było 205,
   jest 108) i liczbami testów.
4. Numery linii w sekcjach 3 i 6 wskazywały na kod sprzed faz F1 i F2
   (`db.ts:32` i `:17`, `calendar/page.tsx:142`, `proxy.ts:4` i `:10`,
   `calendar.ts:17` do `:36`). Wszystkie przeliczone na stan bieżący.
5. Sekcja 9 wymieniała osiem długów bez numerów albo ze starymi numerami
   (F4-00 stało się F7-19). Przepisana na komplet 25 issues z fazy F7 plus tabelę
   spraw czekających na decyzję usera.
