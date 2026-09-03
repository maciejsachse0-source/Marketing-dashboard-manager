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

**Server actions z `src/server/actions/` są niedostępne ze skryptu.** Zmierzone
2026-09-03 (F7-30): każdy z czterech modułów — `calendar`, `campaigns`, `posts`,
`outreach` — rzuca przy imporcie `This module cannot be imported from a Client
Component module`, bo `requireSession()` ciągnie `src/lib/auth.ts` z pakietem
`server-only`. Akcje działają wyłącznie z przeglądarki. Nie próbuj obejścia,
nie ma go.

**Zapis ze skryptu: schema Zod z akcji plus `db.insert`.** Walidacja zostaje ta sama,
odpada tylko `revalidatePath` (strony i tak są dynamiczne, wystarczy odświeżyć):

```bash
set -a; . ./.env.local; set +a     # DATABASE_URL do środowiska
cat > dodaj.ts <<'TS'
import { db, schema } from './src/lib/db';
import { calendarEntryInputSchema } from './src/server/actions/schemas';

async function main() {
  const wpis = calendarEntryInputSchema.parse({
    type: 'shoot',
    title: 'Nagranie BTS z Anią',
    startsAt: '2026-04-30T14:00:00.000Z',
    endsAt: '2026-04-30T16:00:00.000Z',
    platforms: ['instagram', 'tiktok'],
  });
  const [row] = await db.insert(schema.calendarEntries).values({
    ...wpis,
    startsAt: new Date(wpis.startsAt),
    endsAt: new Date(wpis.endsAt),
    status: wpis.status ?? 'planned',
  }).returning();
  console.log('dodano #' + row.id);
  process.exit(0);
}
main();
TS
npx tsx dodaj.ts && rm dodaj.ts
```

Dwie pułapki, obie zmierzone: rozszerzenie **`.ts` kompiluje się do CJS**, więc
`await` na najwyższym poziomie nie przejdzie — stąd `async function main()`.
Rozszerzenie `.mts` z kolei nie widzi nazwanych eksportów z modułów `.ts`.

**Odczyt** działa tym samym wzorcem; `src/lib/context` nie ma `server-only`,
więc gotowe zapytania kontekstowe są dostępne:

```bash
set -a; . ./.env.local; set +a
cat > czytaj.ts <<'TS'
import { getUpcomingCalendar } from './src/lib/context';
async function main() {
  console.log(JSON.stringify(await getUpcomingCalendar(14), null, 2));
  process.exit(0);
}
main();
TS
npx tsx czytaj.ts && rm czytaj.ts
```

`npx tsx -e "...await..."` **nie działa** z tego samego powodu co wyżej
(`/eval.ts` idzie do CJS). Do jednolinijkowca bez `await` nadaje się nadal.

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

**`npm run perf` jest obowiązkowy po każdej zmianie w warstwie danych i w gancie** —
czyli po dotknięciu `drizzle/schema.ts`, `drizzle/migrations/`, `src/lib/db.ts`,
`src/lib/context/`, `src/server/actions/` albo `src/components/calendar/`. Raport
kończy się kodem 1 nie tylko przy przekroczeniu progu z `perf/budget.json`, ale też
przy dryfie powyżej 30% względem poprzedniego przebiegu (ostrzeżenie od 15%).
Dryf blokuje dopiero, gdy pogorszenie przekracza także 10% limitu tej metryki —
inaczej bramka padałaby na szumie maszyny, który sięga tu kilkudziesięciu procent.

Domyślnie odpowiadasz po polsku, naturalnie, konkretnie.
