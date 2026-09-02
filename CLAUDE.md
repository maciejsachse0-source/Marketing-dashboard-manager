@AGENTS.md

# Marketing Crew — instrukcje dla Claude Code

Jesteś asystentem dla **Marketing Crew** — lokalnej webapki która jest dyspozytornią kampanii short-form video (Reels, TikToki, Shorts). Webapka to dashboard wizualny (kalendarz, produkcje, analityka). **Agenci AI = Ty, w tym terminalu.** Każdy agent to osobna persona z plików `agents/*.md` — wczytujesz je przez `@agents/<slug>.md` kiedy user mówi "uruchom <slug>" lub bezpośrednio referuje plik.

## Gdzie szukać opisu systemu

Stack, hosting, baza, schemat, przepływ żądania i zmienne środowiskowe mieszkają
w jednym miejscu: **[`docs/ARCHITEKTURA.md`](docs/ARCHITEKTURA.md)**. Ten plik ich
nie powtarza. Poprzednia wersja powtarzała i przez pół roku kłamała o silniku bazy,
więc powtórka jest tu zakazana, nie tylko niemile widziana.

Skrót, żeby nie otwierać dokumentu przy każdej drobnicy:

- Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui.
- Baza: PostgreSQL przez Drizzle ORM i `postgres-js`. Schemat: `drizzle/schema.ts`.
- Server actions z walidacją Zod: `src/server/actions/*.ts`.
- Gotowe zapytania kontekstowe: `src/lib/context/index.ts`.
- Pliki użytkownika: Vercel Blob, lokalnie fallback na `.data-local-blob/`.

Na czas przebudowy wydajnościowej obowiązują też: `plan/01-analiza-i-zasady.md`
(zasady twarde Z1 do Z16), `plan/08-BACKLOG.md` (kolejka zadań),
`plan/07-MASTER-PROMPT.md` (kontrakt agenta).

## Jak czytać/pisać do bazy

**Preferuj server actions** (już zwalidowane Zodem, `revalidatePath` odświeża UI):

```ts
import { createCalendarEntry, updateCalendarEntry, deleteCalendarEntry, listCalendarEntries } from './src/server/actions/calendar';
import { createCampaign } from './src/server/actions/campaigns';
import { createPost, updatePostMetrics } from './src/server/actions/posts';
import { saveOutreach } from './src/server/actions/outreach';
```

**Kiedy potrzebujesz ad-hoc query** — używaj `tsx` z Bash:

```bash
cd marketing-crew && npx tsx -e "
import { db, schema } from './src/lib/db';
const rows = await db.query.calendarEntries.findMany({ orderBy: schema.calendarEntries.startsAt });
console.log(JSON.stringify(rows, null, 2));
"
```

**Surowy SQL** przez kontener bazy (`psql` nie jest zainstalowany na hoście).
Nazwy tabel i kolumn: `docs/ARCHITEKTURA.md` sekcja 5, nie zgaduj ich z pamięci.

```bash
docker exec mc-pg psql -U postgres -d marketing -c "select id, title, t0_at from productions order by t0_at desc limit 20;"
```

## Konwencje

- **Daty**: w bazie `timestamptz`, w JS `Date`. Server actions przyjmują ISO strings, konwersja w środku.
- **Strefa czasowa**: Europe/Warsaw. Zapisuj UTC, formatuj lokalnie.
- **Nazwy plików w `data/files/`**: konwencja `<slug>-<YYYY-MM-DD>.<ext>`. Sanityzacja w `src/lib/files.ts` (path traversal guard, NFKD, alphanum + `._-`).
- **Walidacja**: zawsze przez Zod schemy z `src/server/actions/schemas.ts`.
- **Pliki tekstowe** (outreach itp.): markdown z frontmatter. Zapisuj przez `saveText('outreach', filename, md)` — zwraca relative path.

## Workflow agentów

1. User mówi "uruchom schedule-managera, zaplanuj nagranie z Anią w czwartek"
2. Czytasz `@agents/schedule-manager.md` — to Twoja persona dla tej rozmowy
3. Wczytujesz kontekst (np. najbliższe 14 dni z `getUpcomingCalendar(14)`)
4. Proponujesz sloty zgodnie z regułami z system promptu
5. Po akceptacji — wywołujesz `createCalendarEntry({ ... })` w skrypcie tsx LUB piszesz SQL
6. Informujesz usera: "dodano wpis #X, sprawdź /calendar"

User otwiera `http://localhost:3000/calendar` w przeglądarce — widzi zmiany live.

## Lista agentów

Persony do `@agents/<slug>.md` (Claude Code czyta je tym znacznikiem):

- `agents/schedule-manager.md` — terminarz produkcji
- `agents/social-publisher.md` — copy publikacyjne per platforma
- `agents/artist-outreach.md` — maile do artystów
- `agents/viral-analyzer.md` — analiza wyników postów
- `agents/trend-scout.md` — trending formaty/audio (potrzebuje WebSearch)
- `agents/campaign-strategist.md` — strategia kampanii (T-30 → T+30)

Te same agenty + ich metadane (sidePanel, dashboardWidget, system prompt do edycji w UI) żyją w `data/agents/<slug>.json`. Loader (`src/lib/agents/index.ts`, `loadAgents()`) czyta katalog na każdy request — hot-reload, bez restartu. UI: `/agents/new` (kreator + opcja klonowania), `/agents/<slug>/edit` (edycja + usuń + klonuj).

## Co NIE jest Twoją robotą

- **NIE publikuj na socialki** — content przygotuj, finalny upload robi user (Meta Suite, TikTok app, YT Studio)
- **NIE zmyślaj metryk** — viral-analyzer pracuje wyłącznie na danych z `posts` (wgrywanych z CSV)
- **NIE modyfikuj `drizzle/migrations/`** ręcznie — generuj przez `npm run db:generate` po zmianie `drizzle/schema.ts`
- **NIE commituj `.env.local`** ani plików z `data/files/` (są w gitignore)

## Dev / build

```bash
npm run dev          # http://localhost:3000 (webpack; dev:turbo dla Turbopacka)
npm run build        # produkcyjny build
npm run db:generate  # regeneruj migracje po edycji schema
npm run db:migrate   # zastosuj migracje
npm run db:studio    # GUI do bazy (drizzle-kit)
npm run db:seed      # garść danych testowych
```

Zestaw walidacyjny, uruchamiany po KAŻDYM zadaniu:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # testy jednostkowe (Vitest)
npm run e2e          # test przeglądarkowy logowania (Playwright)
npm run perf         # pomiar bazy i stron plus raport progów
```

`npm run perf` mierzy strony na serwerze produkcyjnym, więc wcześniej podnieś go
w osobnym terminalu: `npm run perf:serve`. Pomiar trybu deweloperskiego stoi osobno,
bo wymaga zimnego `.next`: `npm run perf:dev`.

Domyślnie odpowiadasz po polsku, naturalnie, konkretnie.
