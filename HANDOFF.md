# HANDOFF — stan przebudowy

> Ten plik POPRAWIA się w miejscu. Nie dopisuj kolejnych sekcji na dole, aktualizuj
> istniejące. Nieaktualny handoff jest gorszy niż jego brak.

## Rola i kontrakt

Orkiestrator (wariant TIME). Pełny kontrakt: `plan/07-MASTER-PROMPT.md`.
Kolejka: `plan/08-BACKLOG.md`. Kontekst mierzony, nigdy szacowany.

## Stan repozytorium

- Ostatni commit przebudowy: `b4d06ee` (F0-04)
- Ostatnie odhaczone issue: **F0-04**
- Następne issue: **F0-05** (szczegóły przekazania: `NEXT-TASKS.md`)
- Gałąź: `main`

## Ukończone issues

F0-00, F0-01, F0-02, F0-03, F0-04. Każde odhaczone w `plan/08-BACKLOG.md`
z wklejonym dowodem, commit per issue.

## Otwarte problemy i pułapki

- `README.md` i `CLAUDE.md` w repozytorium opisują SQLite, a kod używa Postgresa.
  Nie ufaj im do czasu ukończenia F0-07.
- Dev server domyślnie chodzi na webpacku z 4 GB heapu. To objaw, nie ustawienie
  do skopiowania. Decyzja o bundlerze zapada w F2-05 na podstawie pomiaru.
- Dwie dostawy od usera są potrzebne po drodze: `DATABASE_URL` (F0-01) i plik `.xlsx`
  z osobami (F4-06). Oba issues mają wariant zapasowy, więc budowa nie stoi.
- `DATABASE_URL` nie przyszedł, więc F0-01 poszło wariantem zapasowym: baza stoi
  w kontenerze Docker `mc-pg` na porcie 5433. Trzeba go wstawić przed pracą
  (`docker start mc-pg`). Liczby wydajnościowe są przez to porównywalne między sobą,
  ale nie są prognozą produkcji.
- ESLint jest przypięty do 9.x. Wersja 10 wysypuje wtyczkę react z `eslint-config-next`.
- Pomiar kontekstu workera: `bash ~/.claude/agent-context.sh 1000000`. ARGUMENT JEST
  OBOWIĄZKOWY, okno modelu to 1 000 000, a domyślna stała skryptu to 200 000, więc bez
  niego wynik jest pięć razy zawyżony. Skrypt naprawiony 2026-09-02 (szukał transkryptu
  po złym katalogu i zwracał `NO-TRANSCRIPT`), szczegóły w `DECISIONS.md`.
- Pełna lista pułapek i stan środowiska: `NEXT-TASKS.md`.

## Znaczniki

- `STOP-GATE:` — pętla zatrzymana, czeka na decyzję usera
- `BLOCKED-ASK-USER:` — brakuje danych wejściowych od usera

`BLOCKED-ASK-USER:` trzy pytania o produkcję z `docs/ARCHITEKTURA.md` sekcja 2
(aktywna domena, dostęp do panelu Vercela, los padniętego wdrożenia z 2026-05-03).
To jedyny niespełniony punkt Definition of Done fazy F0. Nie blokuje fazy F1, bo indeksy
i zapytania nie zależą od faktów o produkcji, więc pętla jedzie dalej, a punkt zostaje
otwarty do czasu odpowiedzi usera.
