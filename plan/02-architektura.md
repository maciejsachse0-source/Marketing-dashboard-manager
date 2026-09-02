# 02 — Architektura: co ustalamy i jak to zapisujemy

Cel biznesowy tego pliku: user nie wie „gdzie stoi serwer i jak jest zorganizowana
baza". Efektem jest jeden dokument kanoniczny `docs/ARCHITEKTURA.md`, którego każde
zdanie da się sprawdzić komendą.

## 1. Stan zastany, ustalony z kodu

```
Przeglądarka
   │  HTTP
   ▼
Next.js 16 (App Router)  ── proxy src/proxy.ts: cookie sesji, redirect na /login
   │
   ├─ Server Components (23 pliki `page.tsx`; 26 plików deklaruje force-dynamic)
   ├─ Server Actions  src/server/actions/*.ts  (walidacja Zod, revalidatePath)
   └─ Route Handlers  /api/upload, /api/csv
   │
   ▼
Drizzle ORM 0.45  ──►  postgres-js (pool max: 1, prepare: false)
   │
   ▼
PostgreSQL  (provider ustalany w F0-01, zapisywany do dokumentu w F0-06)

Pliki użytkownika: @vercel/blob, fallback na dysk .data-local-blob/
Persony agentów: pliki agents/*.md + data/agents/*.json, czytane przez Claude Code,
                 aplikacja ich nie wykonuje.
```

Sygnały wdrożenia na Vercel: gałąź `origin/vercel-postgres-deploy` scalona do `main`,
`process.env.VERCEL` sprawdzane w `src/server/actions/productions.ts:64` i `:128`,
`prepare: false` w kliencie (kompatybilność z poolerem transakcyjnym), `@vercel/blob`
w zależnościach. To są przesłanki, nie potwierdzenie. Potwierdzenie zbiera F0-06.

## 2. Model danych (12 tabel, `drizzle/schema.ts`)

| Tabela | Rola | Klucze obce |
|---|---|---|
| `artists` | twórcy | — |
| `videographers` | kamerzyści | — |
| `campaigns` | kampanie marketingowe | — |
| `productions` | produkcja pojedynczego materiału | `artist_id`, `videographer_id`, `campaign_id` |
| `calendar_entries` | wpisy na osi czasu | `artist_id`, `campaign_id`, `production_id` |
| `posts` | opublikowane materiały i metryki | `campaign_id`, `production_id`, `raw_csv_row_id` |
| `csv_uploads` / `csv_rows` | surowe importy analityki | `upload_id` |
| `production_templates` | szablony kroków produkcji | — |
| `marketing_templates` | szablony kamieni milowych kampanii | — |
| `agents` | metadane person agentów | — |
| `agent_runs` | log uruchomień agentów | — |

**Asymetria, która uderza w import osób:** `artists` ma `handle`, `email`, `phone`,
a `videographers` ma tylko `contact`, `hourly_rate`, `equipment`, `availability_notes`.
Żadna z dwóch tabel nie ma kolumny `location`, mimo że lokalizacja jest podstawowym
kryterium doboru kamerzysty do artysty i występuje w danych źródłowych
(`scripts/import-people.ts`). Wyrównanie obu tabel jest warunkiem wstępnym importu
z Excela i ma własne issue F4-00.

Dane półstrukturalne siedzą w kolumnach `jsonb`: `ProductionStep[]`,
`ProductionPeriods`, milestone'y kampanii, `kpis`. To świadomy wybór i zostaje.
Konsekwencja dla wydajności: filtrowanie po zawartości `jsonb` jest drogie, więc
wszystko, po czym filtrujemy albo sortujemy, musi mieć osobną kolumnę i indeks (Z9).

## 3. Co MUSI znaleźć się w `docs/ARCHITEKTURA.md`

Struktura dokumentu jest narzucona. Każda sekcja ma podaną metodę weryfikacji, którą
autor dokumentu wkleja jako komendę i wynik.

| Sekcja | Treść | Metoda weryfikacji wpisana do dokumentu |
|---|---|---|
| 1. Jednym akapitem | Co robi aplikacja, dla kogo, jakie ma granice | — |
| 2. Gdzie to stoi | Host produkcji, adres URL, gałąź wdrożeniowa, kto ma dostęp | `gh api repos/:owner/:repo/deployments`, panel hostingu, potwierdzenie od usera |
| 3. Baza | Provider, region, wersja Postgresa, tryb poolera, limit połączeń | `node scripts/perf/pg-info.mjs` (własny skrypt na `postgres-js`; **`psql` nie jest zainstalowany na tej maszynie**, nie opieraj o niego żadnego kryterium) |
| 4. Rozmiar danych | `COUNT(*)` per tabela, data pomiaru | `scripts/perf/table-counts.mjs` |
| 5. Schemat | Tabele, klucze obce, indeksy, kolumny `jsonb` i ich kształty | wygenerowane z `drizzle/schema.ts`; indeksy z `select indexname, tablename from pg_indexes where schemaname='public'` przez `pg-info.mjs` |
| 6. Przepływ żądania | Od kliknięcia do zapisu: proxy, strona, server action, ORM, baza, `revalidatePath` | ścieżki plików z numerami linii |
| 7. Pliki i sekrety | Gdzie lądują uploady, jakie zmienne środowiskowe są wymagane, gdzie NIE ma ich być | `.env.example` |
| 8. Uruchomienie lokalne | Komenda po komendzie, od zera do działającej apki | przejście na czystym katalogu |
| 9. Granice i długi | Czego aplikacja nie robi, co jest tymczasowe (`kształt legacy`, martwe `.db`) | lista z linkami do issues |

**Anty-spec dokumentu:** żadnych zdań typu „nowoczesna architektura", „skalowalne
rozwiązanie", „dobre praktyki". Żadnego kopiowania treści z README. Żadnych diagramów
w formacie graficznym, które rozjadą się z kodem, poza blokiem tekstowym.

## 4. Konwencje kodu (wzorowane na Open Mercato, przycięte do skali tego repo)

Open Mercato leży lokalnie w `~/Desktop/projekty/open-mercato` i jest tu wyłącznie
źródłem konwencji. Nie migrujemy do niego, nie kopiujemy jego pakietów.

Bierzemy cztery rzeczy i tylko cztery:

1. **Routing zadań w `AGENTS.md`** — krótki plik z tabelą „zadanie → gdzie zajrzeć",
   zamiast długiego opisu projektu. Aktualny `AGENTS.md` ma 5 linii i mówi tylko
   o Next.js, do rozbudowy w F0.
2. **Zestaw komend walidacyjnych** — `npm run typecheck`, `npm run lint`, `npm run test`,
   `npm run perf`. Nazwy stałe, wywoływane po każdym issue.
3. **„Sprawdź, czy komponent już istnieje, zanim napiszesz nowy"** — u nas realizowane
   przez `plan/05-ui-system.md` i zasadę Z3.
4. **Brak twardo zapisanych stringów widocznych dla użytkownika w głębi komponentów** —
   etykiety trzymamy przy komponencie, w jednym miejscu na plik, nie rozsypane po JSX.

Czego NIE bierzemy: systemu modułów, RBAC, wielotenantowości, kolejek, MikroORM,
własnego silnika zapytań. To narzędzia do problemu, którego ta aplikacja nie ma.

## 5. Decyzja o stacku

Domyślnie **stack zostaje**: Next.js 16 + Postgres + Drizzle. Powody: jest sprawny,
zespół go zna, a wszystkie zmierzone przyczyny wolnego działania (A1 do A6, A10, A11
z pliku 01) są niezależne od wyboru frameworka i bazy.

Zmiana stacku wchodzi w grę tylko, gdy po fazie F2 harness pokaże, że budżet z pliku 03
jest nieosiągalny bez niej. Wtedy obowiązuje procedura: benchmark alternatywy na tym
samym zestawie L, tabela przed/po, wpis w `DECISIONS.md`, decyzja usera (bramka F8).
Kandydaci do rozważenia w takiej sytuacji, w kolejności kosztu wdrożenia:
`next dev --turbopack` jako domyślny bundler (najtaniej), zamiana poolera na sesyjny
z większym `max`, przeniesienie ciężkich widoków na klienta z jednym endpointem JSON,
i dopiero na końcu wymiana warstwy danych.
