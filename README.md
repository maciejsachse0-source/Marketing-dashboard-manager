# Marketing Crew

Lokalna webapka — pulpit do zarządzania kampanią marketingową w short-form video (Reels, TikToki, Shorts).

**Architektura: dashboard w przeglądarce + agenci w Claude Code.** Webapka wizualizuje dane (kalendarz, produkcje, analityka, baza artystów). Wszystkie 8 wirtualnych agentów żyją jako persony w Claude Code — każdy w pliku `agents/<slug>.md`. Mówisz do Claude Code „uruchom schedule-managera", on wczytuje persona prompt, czyta bazę, działa.

Bez Anthropic API key. Bez kosztów per-token. Korzystasz ze swojej istniejącej subskrypcji Claude Code.

## Gdzie stoi serwer i jak wygląda baza

**[`docs/ARCHITEKTURA.md`](docs/ARCHITEKTURA.md)** i tylko tam. Dziewięć sekcji,
każda z komendą, którą da się sprawdzić: hosting, provider i wersja bazy, schemat,
rozmiar danych, przepływ żądania, zmienne środowiskowe, uruchomienie lokalne, długi.
Ten plik świadomie tego nie powtarza, żeby oba nie mogły się rozjechać.

## Wymagania

- Node 20+
- [Claude Code](https://claude.com/claude-code) (CLI lub IDE extension)

## Setup

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run db:seed     # opcjonalnie — 2 artystów + 1 kampania + 5 wpisów testowych
npm run dev
```

Otwórz <http://localhost:3000>. Otwórz Claude Code w roocie projektu.

## Workflow

```
┌──────────────────────────┐         ┌─────────────────────────┐
│   Przeglądarka           │         │   Claude Code (CLI)     │
│   localhost:3000         │         │                         │
│                          │         │  @agents/schedule-      │
│   • Kalendarz tygodnia   │◄────────│    manager.md           │
│   • Produkcje            │  baza   │                         │
│   • Analityka (CSV)      │  wspólna│  „zaplanuj nagranie     │
│   • Baza artystów        │         │   z Anią w czwartek"    │
│   • Reference cards 8    │         │                         │
│     agentów              │         │  → Server actions       │
└──────────────────────────┘         └─────────────────────────┘
```

1. Otwierasz `localhost:3000/calendar` — widzisz tydzień
2. W terminalu mówisz: `@agents/schedule-manager.md zaplanuj nagranie z Anią w czwartek po południu, 2h, BTS pod Reels`
3. Claude Code wczyta persona + odczyta kalendarz z bazy + zaproponuje sloty
4. Po Twoim OK — wywołuje `createCalendarEntry({ ... })` przez `tsx`
5. Odświeżasz `/calendar` w przeglądarce — wpis jest

Tak samo dla pozostałych 7 agentów. Lista w `/agents` w UI lub w tabeli niżej.

## Struktura

```
marketing-crew/
├── CLAUDE.md             # główny brief dla Claude Code
├── agents/               # persony promptów do @-referencji
│   ├── schedule-manager.md
│   ├── social-publisher.md
│   ├── artist-outreach.md
│   ├── viral-analyzer.md
│   ├── trend-scout.md
│   └── campaign-strategist.md
├── src/
│   ├── app/              # Next.js App Router (strony + API: upload, csv)
│   ├── components/       # UI (shadcn/ui w components/ui/)
│   ├── lib/
│   │   ├── agents/       # rejestr person + ich system prompty (do wyświetlania w UI)
│   │   ├── context/      # helpery do dociągania kontekstu z bazy
│   │   ├── db.ts         # singleton Drizzle + klient bazy
│   │   ├── env.ts        # walidacja env vars (Zod)
│   │   ├── files.ts      # zapisy do data/files/ z path-traversal guard
│   │   └── csv-parser.ts # detekcja formatu Meta/TikTok/YT
│   └── server/actions/   # Server Actions z walidacją Zod (CRUD)
├── drizzle/
│   ├── schema.ts         # tabele
│   ├── migrations/       # generowane przez drizzle-kit
│   ├── migrate.ts        # apply migrations
│   └── seed.ts           # dane testowe
└── data/
    ├── agents/           # JSON-y z metadanymi agentów + system prompty (edytowalne z UI)
    ├── templates/        # production templates + rytm tygodniowy
    └── files/            # assety / CSV / outreach (gitignore)
```

## Komendy

| Komenda | Co robi |
|---|---|
| `npm run dev` | dev server (webpack; wariant na Turbopacku: `npm run dev:turbo`) |
| `npm run build` | build produkcyjny |
| `npm run start` | start z buildu |
| `npm run db:generate` | generuj migracje po zmianie `drizzle/schema.ts` |
| `npm run db:migrate` | apply migracji |
| `npm run db:studio` | przeglądarka bazy (drizzle-kit studio) |
| `npm run db:seed` | dane testowe |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | testy jednostkowe (Vitest) |
| `npm run e2e` | testy przeglądarkowe (Playwright) |
| `npm run perf` | pomiar bazy i stron plus raport progów |

## Agenci

| Slug | Rola |
|---|---|
| `schedule-manager` | Planuje nagrania, montaż, publikacje. Wykrywa kolizje. |
| `social-publisher` | Pisze copy per platforma (hook + caption + hashtagi + CTA). |
| `artist-outreach` | Maile do artystów: cold, briefy, follow-upy, podziękowania. |
| `viral-analyzer` | Analizuje wyniki postów i daje rekomendacje na następny. |
| `trend-scout` | Znajduje trending formaty / audio / tematy (używa WebSearch w Claude Code). |
| `campaign-strategist` | Strategia kampanii: T-30 → T+30, fazy, KPI. |

Każdy ma stronę `/agents/<slug>` z pełnym promptem do skopiowania, gotowym wywołaniem `@agents/<slug>.md` i live kontekstem z bazy. Możesz też:

- `/agents/<slug>/edit` — edytuj system prompt, opis, side panel, widget pulpitu (zapis do JSON)
- `/agents/new` — wizard nowego agenta (od zera albo od kopii istniejącego)
- na pulpicie pod każdym agentem widać 1-linijkowy hint z `dashboardWidget` (np. „2 artystów bez kontaktu >14d")

## Świadome ograniczenia

- Brak auto-publikacji na socialki — agent pisze copy, upload robi człowiek.
- Brak auto-pobierania metryk — wgrywasz CSV z Meta Business Suite / TikTok Analytics / YouTube Studio przez `/analytics`.
- Jeden użytkownik, jedna para logowania ze zmiennych środowiskowych. Brak kont, ról i zespołów.
- Agenci wymagają Claude Code (CLI lub IDE extension) — webapka sama nie ma wbudowanego LLM.
