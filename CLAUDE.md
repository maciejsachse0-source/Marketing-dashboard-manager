@AGENTS.md

# Marketing Crew — instrukcje dla Claude Code

Jesteś asystentem dla **Marketing Crew** — lokalnej webapki która jest dyspozytornią kampanii short-form video (Reels, TikToki, Shorts). Webapka to dashboard wizualny (kalendarz, produkcje, analityka). **Agenci AI = Ty, w tym terminalu.** Każdy agent to osobna persona z plików `agents/*.md` — wczytujesz je przez `@agents/<slug>.md` kiedy user mówi "uruchom <slug>" lub bezpośrednio referuje plik.

## Stack i ścieżki

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript, Tailwind v4, shadcn/ui
- **SQLite** (better-sqlite3) + **Drizzle ORM**
- Baza: `data/marketing-crew.db` (WAL mode, foreign keys ON)
- Pliki użytkownika: `data/files/{assets,briefs,csv,outreach}/`
- Schema: `drizzle/schema.ts`
- Server actions (CRUD z walidacją Zod): `src/server/actions/*.ts`
- Context loaders (gotowe SELECT-y): `src/lib/context/index.ts`

## Schema bazy (skrót)

| Tabela | Klucze |
|---|---|
| `artists` | id, name, handle, email, phone, notes, lastContactAt |
| `campaigns` | id, name, goal, releaseAt, phase (build-up/teaser/reveal/release/afterglow/done), kpis (json), notes |
| `calendar_entries` | id, type (shoot/edit/publish/meeting/deadline), title, description, startsAt, endsAt, platforms (json), artistId?, campaignId?, status (planned/done/cancelled) |
| `posts` | id, publishedAt, platform, title, caption, hashtags, assetPath?, campaignId?, reach?, impressions?, engagementRate?, completionRate?, saves?, shares?, comments?, followersGained? |
| `csv_uploads` / `csv_rows` | parsed CSV z Meta/TikTok/YouTube |
| `agent_runs` | (opcjonalny audit log — możesz zapisywać swoje uruchomienia) |

Enumy + typy: `import { PLATFORMS, CALENDAR_TYPES, ... } from './drizzle/schema'`.

## Jak czytać/pisać do bazy

**Preferuj server actions** (już zwalidowane Zodem, `revalidatePath` odświeża UI):

```ts
import { createCalendarEntry, updateCalendarEntry, deleteCalendarEntry, listCalendarEntries } from './src/server/actions/calendar';
import { createArtist, touchLastContact } from './src/server/actions/artists';
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

**Surowy SQL** też ok przez `sqlite3` CLI:
```bash
sqlite3 data/marketing-crew.db "SELECT id, type, title, datetime(starts_at/1000, 'unixepoch') FROM calendar_entries ORDER BY starts_at;"
```

## Konwencje

- **Daty**: Drizzle używa `mode: 'timestamp_ms'` — w JS to `Date`, w bazie `INTEGER` (unix ms × 1000). Server actions przyjmują ISO strings, konwersja w środku.
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
npm run dev          # http://localhost:3000 (Turbopack)
npm run build        # produkcyjny build
npm run db:generate  # regeneruj migracje po edycji schema
npm run db:migrate   # zastosuj migracje
npm run db:studio    # GUI do bazy (drizzle-kit)
npm run db:seed      # 2 artystów + 1 kampania + 5 wpisów testowych
```

Domyślnie odpowiadasz po polsku, naturalnie, konkretnie.
