<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Zadanie, a gdzie zajrzeć

Ten plik jest routerem, nie opisem projektu. Znajdź wiersz najbliższy swojemu zadaniu
i otwórz to, co stoi w kolumnie obok. Nie czytaj wszystkiego.

| Zadanie | Gdzie zajrzeć |
|---|---|
| Wydajność: pomiar, budżety, progi | `plan/03-wydajnosc.md`, `scripts/perf/*`, `perf/budget.json`, `perf/baseline.json`. Pomiar: `npm run perf`, wcześniej `npm run perf:serve` w drugim terminalu; tryb deweloperski osobno: `npm run perf:dev` |
| Baza i migracje | `drizzle/schema.ts`, `drizzle/migrations/`, `docs/ARCHITEKTURA.md` sekcja 5. Migracje generuje `npm run db:generate`, stosuje `npm run db:migrate`. W `migrations/` nie grzeb ręcznie |
| Komponenty i wygląd | `plan/05-ui-system.md`, `src/components/ui/`. Klikalny element akcji wyłącznie przez `src/components/ui/button.tsx`, kolory wyłącznie przez tokeny |
| Import osób z arkusza | `plan/04-import-excel.md`, `src/lib/import/`, ekran `/import/osoby` |
| Testy | jednostkowe `npm run test` (Vitest, pliki `*.test.ts`), przeglądarkowe `npm run e2e` (Playwright, katalog `e2e/`); konfiguracje `vitest.config.ts` i `playwright.config.ts` |
| Architektura, hosting, zmienne środowiskowe | `docs/ARCHITEKTURA.md`. Jedyne źródło kanoniczne; `README.md` i `CLAUDE.md` świadomie tego nie powtarzają |
| Uruchomienie od zera | `docs/ARCHITEKTURA.md` sekcja 8. Skrót na tej maszynie: `docker start mc-pg`, potem `npm run dev` |
| Znaleziska i długi | `plan/08-BACKLOG.md`, faza F7-ZNALEZISKA. Zastany błąd napotkany przy okazji idzie tam jako issue z kryteriami akceptacji, nie do akapitu w raporcie |
| Zasady twarde, których nie wolno złamać | `plan/01-analiza-i-zasady.md`, zasady Z1 do Z16 |
| Kolejka zadań i kontrakt agenta | `plan/08-BACKLOG.md` (kolejność jest prawem), `plan/07-MASTER-PROMPT.md` |
| Decyzje już podjęte, żeby nie podejmować ich drugi raz | `DECISIONS.md` |
| Persony agentów AI | `agents/*.md` (prompty), `data/agents/*.json` (metadane do interfejsu) |
