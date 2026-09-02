# Pakiet planistyczny — przebudowa wydajnościowa Marketing Crew

Cel: aplikacja przestaje mulić i się zawieszać, wiadomo gdzie stoi i jak jest zbudowana,
dochodzi import osób z Excela, a kod ma jeden wzorzec komponentów, testy i mierzalne
progi prędkości.

Tryb budowy: **TIME** (orkiestrator plus sztafeta workerów, jeden worker naraz).

## Pliki

| Plik | Po co |
|---|---|
| `01-analiza-i-zasady.md` | Stan zastany z dowodami z repozytorium, słownik pojęć, zasady twarde Z1 do Z16. Czytaj pierwszy |
| `02-architektura.md` | Co ustalamy o serwerze i bazie, narzucona struktura `docs/ARCHITEKTURA.md`, konwencje wzięte z Open Mercato, decyzja o stacku |
| `03-wydajnosc.md` | Harness pomiarowy z algorytmami, zestaw danych L, budżety liczbowe, kolejność napraw P1 do P8 |
| `04-import-excel.md` | Import osób: przepływ 7 kroków, mapowanie kolumn, normalizacja, tabela zdarzeń, anty-spec |
| `05-ui-system.md` | Wzorzec guzika, katalog wariantów, reguła „nie twórz nowego komponentu", egzekwowanie lintem |
| `06-testy.md` | Vitest, Testing Library, Playwright, kolejność TDD, zakres minimalny, testy prędkości jako bramka |
| `07-MASTER-PROMPT.md` | Blok do wklejenia agentowi budującemu plus uwagi operacyjne dla usera |
| `08-BACKLOG.md` | 44 issues w 9 fazach z kryteriami akceptacji. Jedyne źródło kolejności i postępu |

Poza pakietem, w korzeniu repozytorium: `HANDOFF.md` (stan między sesjami),
`DECISIONS.md` (dziennik decyzji), `WERYFIKACJA.md` (szkielet w F5-04, wypełniany
przez recenzenta po odhaczeniu F7, przed bramką F8; lista do odbioru przez usera).

## Jak wystartować

1. Otwórz nową sesję Claude Code w katalogu repozytorium.
2. Wpisz `/loopstart kickoff` — skill wykryje wariant z pakietu i wykona master prompt.
   Wariant ręczny: skopiuj blok w ramce z `plan/07-MASTER-PROMPT.md` i wklej go.
3. Sesja wykona F0 przez pierwszego workera, potem uruchomi pętlę.
4. Przy zapełnieniu kontekstu 55% sesja wypisze gotowy prompt. Robisz `/clear`
   i wklejasz go. To jedyny ruch, którego model nie zrobi za Ciebie.
5. Przy `STOP-GATE` i `BLOCKED-ASK-USER` sesja czeka na Twoją decyzję.

## Co dostarczasz po drodze

| Kiedy | Co | Co się stanie bez tego |
|---|---|---|
| F0-01 | `DATABASE_URL` do bazy roboczej (kopia, nie produkcja) | Agent postawi lokalnego Postgresa i zmierzy na nim. Pomiary będą przybliżone |
| F0-06 | Potwierdzenie, gdzie faktycznie stoi produkcja | Dokument zapisze „brak potwierdzenia" i zostanie to długiem |
| F4-06 | Plik `.xlsx` z twórcami i kamerzystami | Import powstanie na danych syntetycznych, dopasowanie do prawdziwych nagłówków zostanie na potem |
| F8 | Decyzja o wdrożeniu i ewentualnie o zmianie stacku | Pętla stanie przed ostatnią fazą |

## Co zmienił przegląd krytyka

Pakiet przeszedł przez agenta recenzenta, który zweryfikował każde twierdzenie o kodzie
w samym repozytorium. Znalazł 37 rzeczy, wszystkie z dyspozycją. Najcięższe poprawki:

- Tabela pól osoby w specyfikacji importu była zmyślona. `artists` nie ma `location`,
  a `videographers` nie ma `handle`, `email`, `phone`, `location` ani `status`.
  Stąd nowe issue **F4-00** (migracja wyrównująca schemat) przed całą resztą importu.
- Katalog rozmiarów guzika był zmyślony. Komponent ma 8 rozmiarów o wysokościach
  24, 28, 32 i 36 px, nie 4 o wysokościach 32, 36 i 44 px. Spisany z kodu.
- Brakowało issue `npm install`. `node_modules` nie istnieje, więc pierwsze trzy issues
  startowały od komendy, która by padła. Stąd **F0-00**.
- `psql` nie jest zainstalowany, a dwa kryteria go wymagały. Zastąpiony własnym
  skryptem `scripts/perf/pg-info.mjs`.
- Harness mierzyłby przekierowania na `/login`, bo proxy chroni każdą ścieżkę.
  Skrypt sam się teraz loguje.
- Playwright był potrzebny jako dowód w fazach F1 i F2, a instalowany dopiero w F5.
  Przeniesiony do F0-02.
- Hipoteza „większy pool przyspieszy strony" była z góry skazana: zapytania są
  sekwencyjnymi `await`, nie `Promise.all`. Issue F1-02 obejmuje teraz obie zmiany.
- Zdjęcie `force-dynamic` samo z siebie niczego nie cachuje. F1-03 wymaga teraz
  konkretnego mechanizmu cache z Next 16.
- Cztery issues były wielodniowe. Rozbite: gantt na trzy (kontrakt danych, podział
  pliku, memoizacja), formularze na dwa, ekran importu na dwa.
- Komendy dowodowe były niepoprawne powłokowo (`grep -c` na katalogu, `grep -rc`,
  globy `**`). Wszystkie przepisane na wzorzec `grep -r ... | wc -l` z oczekiwaną liczbą.

## Decyzje otwarte

1. **Stack zostaje**, dopóki pomiar nie wykaże inaczej (plan 02 sekcja 5, zasada Z2).
   Rozstrzygnięcie na bramce F8-02, wyłącznie gdy budżety z plan 03 pozostaną
   nieosiągnięte po F2.
2. **Etap 2 (logowanie i role)** nie jest planowany, zgodnie z Twoją decyzją. Siedzi
   jako F8-03 z opisem zakresu i pułapek, żeby dało się go wycenić bez ponownej analizy.
3. **Bundler deweloperski** rozstrzyga pomiar w F2-05, nie preferencja.
4. **Dane osobowe w historii gita**: `scripts/import-people.ts` zawiera prawdziwe imiona
   i handle z Instagrama. Usunięcie pliku (F4-07) nie czyści historii. Czyszczenie
   historii to osobna decyzja Twoja, bo przepisuje wszystkie commity. Odnotowane
   w `docs/ARCHITEKTURA.md` sekcja 9.
5. **Środowisko dla zespołu** (F5-04): adres podglądowy z danymi syntetycznymi.
   Wybór hostingu należy do agenta, chyba że wskażesz konkretny.
