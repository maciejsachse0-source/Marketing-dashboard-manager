# 01 — Analiza zastanego stanu, słownik pojęć, twarde zasady

Dokument bazowy. Każdy inny plik pakietu odwołuje się do nazw z sekcji „Słownik"
i do numerów zasad z sekcji „Zasady twarde". Zasada bez numeru nie istnieje.

## 1. Co to za projekt (fakty, nie domysły)

Repo: `maciejsachse0-source/Marketing-dashboard-manager`, katalog roboczy
`~/Desktop/projekty/Marketing-dashboard-manager`, gałąź `main`, 97 commitów,
3.0 MB bez `node_modules`.

Nazwa w `package.json`: `marketing-crew`. Aplikacja to pulpit do prowadzenia
kampanii short-form video: kalendarz/gantt produkcji, produkcje z krokami,
kampanie z kamieniami milowymi, baza artystów i kamerzystów, analityka z CSV,
persony agentów AI (pliki markdown czytane przez Claude Code, nie przez apkę).

### Stack — zmierzony z `package.json` i lockfile, nie z README

| Warstwa | Co jest |
|---|---|
| Framework | Next.js **16.2.4**, App Router, React **19.2.4**, TypeScript 5 |
| Bundler dev | **turbopack** (`next dev --turbopack`) od F7-14; webpack został pod `dev:alt` |
| Baza | **PostgreSQL** przez `postgres` 3.4.5 (postgres-js) + Drizzle ORM 0.45.2 |
| UI | Tailwind v4, shadcn/ui (14 komponentów w `src/components/ui/`), Base UI 1.4.1, lucide-react |
| Formularze | react-hook-form 7.74 + zod 4.3 + @hookform/resolvers |
| Pliki | `@vercel/blob` 2.3.3, fallback na dysk w `.data-local-blob/` |
| CSV | papaparse 5.5 |
| Auth | własny podpisany cookie (`src/lib/auth-token.ts`), middleware `src/proxy.ts` |

### Rozmiar kodu — zmierzony

```
src/app         26 plików   2 977 linii
src/components  74 plików  17 046 linii
src/lib         30 plików   2 529 linii
src/server      16 plików   2 290 linii
drizzle          4 pliki      662 linie
scripts          6 plików     588 linii
razem                      26 124 linie
```

Pięć największych plików (linie): `components/calendar/gantt-view.tsx` **2 545**,
`components/templates/template-form.tsx` 1 250, `components/campaigns/campaign-template-form.tsx` 792,
`components/campaigns/timeline.tsx` 737, `components/productions/production-wizard.tsx` 664.

### Zdiagnozowane wprost (dowody z repo)

| # | Obserwacja | Dowód | Dlaczego boli |
|---|---|---|---|
| A1 | **Zero indeksów w bazie** poza kluczami głównymi | `grep -c 'index(' drizzle/schema.ts` → 0, przy **10** kolumnach `references()` | Każdy filtr po `campaign_id`, `production_id`, `starts_at` to seq scan. Rośnie liniowo z danymi |
| A2 | **Pool jednej połączenia** | `src/lib/db.ts`: `max: 1` | Wszystkie zapytania serializują się. Strona z 5 zapytaniami czeka 5× RTT zamiast 1× |
| A3 | **Zero cache, wszystko `force-dynamic`** | **26 plików** deklaruje `export const dynamic = 'force-dynamic'` (w tym `src/app/layout.tsx`, który zaraża całe drzewo); plików `page.tsx` jest 23 | Każde wejście na stronę = pełny render + komplet zapytań |
| A4 | **86 wywołań `revalidatePath`**, część na `'/'` | `grep -c revalidatePath src/server src/app` → 86 | Każda mutacja unieważnia szerokie poddrzewo |
| A5 | **Gantt 2 545 linii, zero memoizacji** | `grep -c 'useMemo\|useCallback\|memo('` w `gantt-view.tsx` → **0**, przy 5× `useState` | Każdy setState przelicza cały gantt. To pierwszy podejrzany o „zawiesza się" |
| A6 | **47 z 73 komponentów w `src/components` to `'use client'`** (48 z 97 plików `.tsx` w całym `src/`) | `grep -rl "'use client'" src/components \| wc -l` | Duży bundle klienta, dużo hydratacji |
| A7 | **89 surowych `<button>` vs 55 `<Button>`**, wszystkie 89 w `src/components` poza `ui/` (`src/app` ma 0, `src/components/ui` ma 0) | `grep -r '<button' src/components --exclude-dir=ui \| wc -l` | Dokładnie problem zgłoszony przez usera: guziki tworzone od nowa zamiast wzorca |
| A8 | **Zero testów, zero lintu** | brak `*.test.*`, brak `eslint.config.*`, brak skryptu `lint`/`test` w `package.json` | Nie ma czym udowodnić, że optymalizacja niczego nie zepsuła |
| A9 | **`CLAUDE.md` i `README.md` kłamią o stacku** | oba mówią „SQLite (better-sqlite3), `data/marketing-crew.db`", a kod używa Postgresa | Każdy agent i człowiek startuje z fałszywego modelu systemu. To jest przyczyna, dla której user nie wie „gdzie stoi serwer i jak wygląda baza" |
| A10 | **Warstwa adapterów legacy w gorącej ścieżce** | `buildLegacyShape()` w `src/app/calendar/page.tsx` przepisuje `steps[]` na stary kształt przy każdym renderze | Podwójna reprezentacja tych samych danych, złożoność i koszt na request |
| A11 | **Dev na webpacku z 4 GB heapu** | `package.json` → `dev` | Ktoś już walczył z zawieszkami. Objaw, nie przyczyna. Turbopack jest w `dev:turbo`, ale nie jest domyślny |
| A12 | **Martwe artefakty SQLite w repo** | `data/marketing-crew.pre-drop.bak.db`, `data/marketing-crew.pre-flexible.bak.db` | Mylą co do tego, gdzie są dane |

### Czego NIE wiemy i skąd to weźmiemy

| Niewiadoma | Jak rozstrzygamy |
|---|---|
| Gdzie faktycznie stoi produkcja (Vercel? inny host?) | F0-06: `gh api` + `git log` + pytanie do usera; wynik do `docs/ARCHITEKTURA.md` |
| Który provider Postgresa (Neon / Vercel Postgres / Supabase) | URL zdobywa F0-01, wersję i providera zapisuje do dokumentu F0-06 (`npm run pg:info`) |
| Ile jest realnie danych (wierszy per tabela) | F0-04: `pg-info.mjs` i `table-counts.mjs`, wynik do dokumentu w F0-06 |
| Który ekran realnie muli | F0-05: pomiar, nie opinia (harness z pliku 03) |
| Format pliku Excel z twórcami i kamerzystami | ⏳ user dostarczy `.xlsx` (F4-06); do tego czasu import budujemy na fixture (plik 04) |

## 2. Słownik pojęć (S6) — używaj TYLKO tych nazw

| Pojęcie | Znaczenie |
|---|---|
| **harness pomiarowy** | Zestaw skryptów `scripts/perf/*` mierzących czasy: `measure-page.mjs` (TTFB + czas serwera per URL), `measure-db.mjs` (czas zapytań), `measure-build.mjs` (czas builda i startu dev). Jedyne źródło liczb o wydajności |
| **baseline** | Plik `perf/baseline.json` — pomiar PRZED zmianami, wykonany na zamrożonym commicie. Punkt odniesienia dla każdego „szybciej o X%" |
| **budżet** | Twardy próg liczbowy dla metryki (np. „TTFB `/calendar` < 800 ms na 500 produkcjach"). Przekroczenie = test czerwony, nie ostrzeżenie |
| **zestaw danych L** | Duży syntetyczny zestaw: 500 produkcji, 3 000 wpisów kalendarza, 200 artystów, 60 kamerzystów, 5 000 postów. Generator `scripts/perf/seed-large.ts`. Wszystkie pomiary wydajności robimy na L |
| **osoba** | Wspólna nazwa na artystę (`artists`) i kamerzystę (`videographers`). Import z Excela operuje na osobach |
| **arkusz źródłowy** | Plik `.xlsx` dostarczony przez usera z osobami. Jeden plik, dwa logiczne bloki: twórcy i kamerzyści |
| **mapowanie kolumn** | Deklaracja „kolumna arkusza → pole osoby", zapisana w `src/lib/import/column-map.ts`. Import bez zaakceptowanego mapowania nie zapisuje niczego |
| **suchy przebieg** | Faza importu, która parsuje i pokazuje podgląd (ile nowych, ile duplikatów, ile błędnych), ale NIE pisze do bazy |
| **wzorzec guzika** | Komponent `src/components/ui/button.tsx` z wariantami CVA. Jedyny dozwolony sposób renderowania klikalnego elementu akcji |
| **gantt** | Widok `src/components/calendar/gantt-view.tsx` — pasek produkcji na osi czasu. Główny podejrzany o zawieszki |
| **krok produkcji** | `ProductionStep` z `drizzle/schema.ts` — element listy kroków wewnątrz produkcji |
| **kształt legacy** | Stara reprezentacja produkcji (`status` + `customSteps` + `stepOrder`) generowana przez `buildLegacyShape()`. Do usunięcia |
| **znalezisko** | Błąd zastany, na który agent wpadł przy okazji innego zadania. Zawsze kończy jako issue w fazie `F7-ZNALEZISKA` |

## 3. Zasady twarde (łamanie = issue niezaliczone)

**Z1. Żadnej optymalizacji bez pomiaru przed i po.** Każde issue wydajnościowe podaje
liczbę z `perf/baseline.json` i liczbę po zmianie, obie z harnessu, obie na zestawie L.
Zdanie „powinno być szybciej" w raporcie = issue odrzucone.

**Z2. Zmiana stacku wymaga benchmarku, nie opinii.** Wymiana biblioteki, bundlera, ORM-a
albo bazy jest dopuszczalna wyłącznie z tabelą „przed / po" z harnessu i wpisem
w `DECISIONS.md`. Migracja „bo nowsze" = odrzucona.

**Z3. Zero surowych `<button>`, `<a>` jako akcji i lokalnych stylowanych klikalnych divów.**
Każdy element akcji renderuje `Button` z `src/components/ui/button.tsx` (wariant przez
`variant`/`size`). Brakuje wariantu → dodajesz wariant do `button.tsx`, nie nowy komponent.
Kontrola, jedna dla całego pakietu: `grep -r '<button' src/ | wc -l` ma maleć w każdej fazie
i skończyć na **0**, bez wyjątków (dziś 89, wszystkie w `src/components` poza `ui/`).

**Z4. Style wyłącznie przez tokeny.** Zero hardkodowanych kolorów (`#rrggbb`, `rgb(`,
`bg-[#…]`) i zero magicznych rozmiarów pikselowych w komponentach — klasy Tailwind
oparte o zmienne z `globals.css`. Aktualny stan to 0 trafień hex; ma zostać 0.

**Z5. Zero emoji w UI.** Ikony wyłącznie z `lucide-react`. Aktualnie 5 trafień w `src/` —
do wyzerowania.

**Z6. Zakaz wyśrodkowanych kropek `·` jako ozdobników** między słowami w copy i UI.
Separator to spacja, przecinek albo osobny element.

**Z7. Zakaz długich myślników `—` w tekstach widocznych dla użytkownika aplikacji.**
W copy używamy przecinka, dwukropka albo krótkiego myślnika z odstępami.
Zakres, dosłownie: literały tekstowe renderowane w JSX oraz słowniki etykiet w `src/`,
a od F7-17 także wartości tekstowe w plikach `data/**/*.json` (katalog agentów
i szablonów), **z wyjątkiem klucza `systemPrompt`** — ten idzie do modelu, nie na ekran,
i zostaje bajt w bajt. Pomijane są katalogi kopii zapasowych (`_backup*`).
**Nie dotyczy**: komentarzy w kodzie, dokumentów w `plan/` i `docs/`, komunikatów
commitów. Metoda sprawdzenia w F3-06, bo grep nie odróżnia stringa od komentarza.

**Z8. Zakaz lewego brandowego paska akcentu** (`border-l-*` jako ozdoba) na calloutach,
cytatach i pigułkach. Wyróżnienie robimy tłem lub obramowaniem pełnym.

**Z9. Każde zapytanie filtrujące ma indeks.** Kolumna używana w `where`, `orderBy`
albo jako klucz obcy musi mieć indeks w `drizzle/schema.ts` i migrację. Nowy `where`
bez indeksu = issue niezaliczone.

**Z10. Nowy kod przechodzi lint i typecheck.** `npm run lint` i `npm run typecheck`
kończą się kodem 0. Wyłączenie reguły wymaga komentarza z powodem w tej samej linii.

**Z11. Złożoność pod kontrolą.** Żaden NOWY plik nie przekracza 300 linii, żadna
NOWA funkcja nie przekracza złożoności cyklomatycznej 10 (mierzone `eslint`
regułą `complexity`). Pliki zastane większe od progu wolno zostawić, ale nie wolno
ich powiększyć: dotknięty plik ma po zmianie mieć nie więcej linii niż przed.
Wyjątki od reguły nierosnięcia, jedyne: komentarze uzasadniające decyzję wymaganą
przez kryterium akceptacji, atrybuty dostępności (`aria-*`, `role`) oraz importy
wymuszone przez migrację do wspólnego komponentu.

**Z12. Jedno źródło prawdy o architekturze.** `docs/ARCHITEKTURA.md` jest kanoniczne.
`README.md` i `CLAUDE.md` nie powtarzają jego treści, tylko linkują. Rozjazd dokumentu
z kodem = błąd tej samej wagi co bug.

**Z13. Dane wejściowe walidowane na granicy zaufania.** Upload pliku, parametr URL,
pole formularza i wiersz arkusza przechodzą przez schemat Zod przed dotknięciem bazy.
Brak walidacji = issue niezaliczone, nawet gdy „to tylko import".

**Z14. Zero sekretów w repo.** `DATABASE_URL`, `SESSION_SECRET`, tokeny blob wyłącznie
w `.env.local` (gitignore). Wrzucenie pliku Excela z danymi osobowymi do repo jest
zakazane, arkusze trzymamy poza gitem (`.data-import/`, gitignore).

**Z15. Znalezisko idzie do backlogu, nie do akapitu.** Każdy zastany błąd napotkany
przy okazji ma issue w `F7-ZNALEZISKA` z pełnym kryterium akceptacji. Znalezisko
opisane tylko w raporcie jest długiem udającym wiedzę.

**Z16. Zakaz nowych zależności produkcyjnych bez uzasadnienia w `DECISIONS.md`.**
Kolejność wyboru: stdlib Node → API platformy/przeglądarki → biblioteka już
w `package.json` → dopiero potem nowa zależność. Wyjątek zaplanowany z góry:
parser `.xlsx` (plik 04).
