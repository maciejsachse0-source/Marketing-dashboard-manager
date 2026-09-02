# 06 — Testy: co, czym, z jakimi progami

Stan zastany: **zero testów, zero lintu, brak skryptów `test`, `lint`, `typecheck`**.
Bez tego nie da się udowodnić, że optymalizacja niczego nie zepsuła, więc warstwa
testowa powstaje w F0, przed pierwszą zmianą wydajnościową.

## 1. Narzędzia

| Warstwa | Narzędzie | Uzasadnienie |
|---|---|---|
| Testy jednostkowe i integracyjne | **Vitest** | natywnie rozumie TypeScript i aliasy z `tsconfig`, startuje w ułamku czasu Jesta, nie wymaga konfiguracji transformacji |
| Testy komponentów | **@testing-library/react** + `jsdom` | standard dla React 19, testuje zachowanie widziane przez użytkownika, nie szczegóły implementacji |
| Testy przez przeglądarkę | **Playwright** (`@playwright/test`, do zainstalowania, nie ma go dziś w `package.json`) | scenariusze end-to-end i pomiar czasów interakcji; instalacja i konfiguracja wchodzą w F0, bo dowody wielu issues z F1 i F2 są scenariuszami e2e |
| Lint | **ESLint** (flat config) + `eslint-config-next` **przypięty do wersji zgodnej z `next` 16.2.4** + reguła `complexity` | Z10 i Z11 |
| Wydajność | harness z pliku 03 | Z1 |

Skrypty do `package.json` (nazwy stałe, używane w kryteriach akceptacji):

```
"typecheck": "tsc --noEmit"
"lint":      "eslint ."
"test":      "vitest run"
"test:watch":"vitest"
"e2e":       "playwright test"
"perf":      "node scripts/perf/measure-db.mjs && node scripts/perf/measure-page.mjs && node scripts/perf/report.mjs"
"pg:info":   "node scripts/perf/pg-info.mjs"
"perf:dev":  "node scripts/perf/measure-dev.mjs"
```

## 2. Reguła kolejności (TDD tam, gdzie ma sens)

**Obowiązkowo test przed kodem** dla: logiki parsowania i normalizacji (plik 04),
wykrywania duplikatów, wyliczeń osi czasu w gancie, wszystkiego, co zmienia zachowanie
istniejącej funkcji podczas refaktoru.

Procedura przy refaktorze wydajnościowym, bez wyjątków:
1. Napisz test przypinający obecne zachowanie funkcji, którą zamierzasz zmienić.
2. Uruchom go i **potwierdź, że przechodzi** na kodzie sprzed zmiany.
3. Zmień kod.
4. Test nadal zielony = refaktor, nie zmiana zachowania. Czerwony = zepsułeś coś.

Procedura przy naprawie błędu:
1. Napisz test odtwarzający błąd. Uruchom, **potwierdź, że pada**.
2. Test przechodzący od razu oznacza, że szukasz w złym miejscu. Powiedz to, nie łataj.
3. Napraw, test zielony.

**Bez testów** zostają: proste komponenty prezentacyjne bez logiki, jednolinijkowe
opakowania, konfiguracja. Test, który sprawdza, że `<div>` renderuje `<div>`, jest
kosztem bez wartości.

## 3. Zakres minimalny na koniec projektu

| Obszar | Czego dotyczą testy | Liczba scenariuszy |
|---|---|---|
| Normalizacja osoby | handle z URL-a, handle bez `@`, telefon w 4 formatach, email z wielkimi literami, polskie znaki w nazwie, wiersz pusty, wiersz z samą nazwą | ≥ 12 |
| Wykrywanie duplikatów | ten sam handle, ten sam email, ta sama nazwa i lokalizacja, nazwa ta sama i lokalizacja inna, aktualizacja nie kasuje pustymi | ≥ 6 |
| Mapowanie kolumn | dopasowanie po aliasie, nagłówek z polskimi znakami, kolizja dwóch kolumn, kolumna nierozpoznana | ≥ 5 |
| Oś czasu ganta | pozycja kroku wewnątrz okna, krok przed oknem, krok po oknie, produkcja bez kotwicy T0, okno tygodnia i kwartału | ≥ 6 |
| Kroki produkcji | kolejność, oznaczanie jako zrobione, krok z datą pochodną | ≥ 4 |
| End-to-end | logowanie, wejście na `/calendar` i przewinięcie, pełny import z fixture, dodanie produkcji | 4 scenariusze |

Pokrycie jako liczba nie jest kryterium. Kryterium jest: **każda funkcja czysta
w `src/lib/` ma test**, a każdy scenariusz z tabeli powyżej istnieje.

## 4. Testy prędkości jako testy, nie jako raport

`scripts/perf/report.mjs` porównuje bieżący pomiar z `perf/budget.json` i kończy się
kodem 1, gdy którykolwiek próg jest przekroczony. Dzięki temu wydajność pada tak samo
głośno jak zepsuty test.

Reguła dryfu porównuje bieżący pomiar z **ostatnim przebiegiem w `perf/runs/`**, nie
z `baseline.json`. Baseline to stan przed optymalizacją, więc po F1 każda metryka jest
od niego lepsza i porównanie z nim nigdy nie wykryje regresji. Pogorszenie względem
ostatniego przebiegu o więcej niż **15%** na dowolnej metryce jest ostrzeżeniem
w raporcie fazy, powyżej **30%** błędem blokującym fazę. `baseline.json` zostaje
wyłącznie jako punkt odniesienia do tabel „przed i po".

## 5. Środowisko dla zespołu

Cel: ekipa ma kliknąć aplikację i zgłosić uwagi, bez stawiania czegokolwiek u siebie.

- Aplikacja wystawiona pod adresem podglądowym, z bazą wypełnioną zestawem L
  (dane syntetyczne, zero prawdziwych osób).
- Plik `WERYFIKACJA.md` w korzeniu repozytorium: lista rzeczy do klikniętego
  sprawdzenia, po jednej pozycji na zbudowaną funkcję, z polem wyboru, adresem i tym,
  czego dokładnie oczekiwać. Szkielet powstaje w F5-04, wypełnia go agent recenzent
  po odhaczeniu F7, przed bramką F8.
- Zgłoszenia zespołu wracają jako issues w fazie `F7-ZNALEZISKA`, nie jako wiadomości.

## 6. Anty-spec

- Zero testów migawkowych całych drzew komponentów. Migawka na 2 000 linii JSX nie mówi,
  co się zepsuło, i jest odhaczana bez czytania.
- Zero mockowania bazy w testach, które mają sprawdzać zapytania. Testy dotykające
  bazy używają osobnej bazy testowej z `TEST_DATABASE_URL`.
- Zero testów zależnych od kolejności wykonania i od danych zostawionych przez inny test.
- Zero pomiarów wydajności w tym samym przebiegu co testy jednostkowe. Osobna komenda,
  osobne warunki.
