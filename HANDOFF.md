# HANDOFF — stan przebudowy

> Ten plik POPRAWIA się w miejscu. Nie dopisuj kolejnych sekcji na dole, aktualizuj
> istniejące. Nieaktualny handoff jest gorszy niż jego brak.

## Rola i kontrakt

Orkiestrator (wariant TIME). Pełny kontrakt: `plan/07-MASTER-PROMPT.md`.
Kolejka: `plan/08-BACKLOG.md`. Kontekst mierzony, nigdy szacowany.

## Stan repozytorium

- Ostatni commit przebudowy: *(brak, pakiet planistyczny dopiero powstał)*
- Ostatnie odhaczone issue: *(brak)*
- Następne issue: **F0-00**
- Gałąź: `main`

## Ukończone issues

*(brak)*

## Otwarte problemy i pułapki

- `README.md` i `CLAUDE.md` w repozytorium opisują SQLite, a kod używa Postgresa.
  Nie ufaj im do czasu ukończenia F0-07.
- Dev server domyślnie chodzi na webpacku z 4 GB heapu. To objaw, nie ustawienie
  do skopiowania. Decyzja o bundlerze zapada w F2-05 na podstawie pomiaru.
- Dwie dostawy od usera są potrzebne po drodze: `DATABASE_URL` (F0-01) i plik `.xlsx`
  z osobami (F4-06). Oba issues mają wariant zapasowy, więc budowa nie stoi.

## Znaczniki

- `STOP-GATE:` — pętla zatrzymana, czeka na decyzję usera
- `BLOCKED-ASK-USER:` — brakuje danych wejściowych od usera

*(brak aktywnych znaczników)*
