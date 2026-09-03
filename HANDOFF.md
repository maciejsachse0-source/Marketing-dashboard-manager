# HANDOFF — stan przebudowy

> Ten plik POPRAWIA się w miejscu. Nie dopisuj kolejnych sekcji na dole, aktualizuj
> istniejące. Nieaktualny handoff jest gorszy niż jego brak.

## Rola i kontrakt

Orkiestrator (wariant TIME). Pełny kontrakt: `plan/07-MASTER-PROMPT.md`.
Kolejka: `plan/08-BACKLOG.md`. Kontekst mierzony, nigdy szacowany.

## Stan repozytorium

- Ostatni commit przebudowy: `13ff35e`
- Gałąź: `main`
- **Wszystkie fazy budowlane F0 do F7 są zamknięte.** Przegląd końcowy wykonany,
  jedenaście znalezisk recenzenta dopisane jako issues F7-33 do F7-43 i wykonane.
- `WERYFIKACJA.md` (481 linii) czeka na odbiór przez usera.
- Następny krok: **bramka decyzyjna F8**, czeka na decyzje usera.

## Ukończone issues

F0 (osiem), F1 (cztery), F2 (sześć), F3 (osiem), F4 (siedem z ośmiu), F5 (cztery,
jedno kryterium F5-04 otwarte), F6 (trzy), F7 (czterdzieści jeden z czterdziestu trzech).

## Stan bramek na ostatnim commicie

`npm run typecheck` 0 · `npm run lint` 0 błędów, 35 ostrzeżeń · `npm run test` 224 zielone
· `node scripts/check-typography.mjs` 0 (pilnuje też twardych kolorów, strzałek
i `force-dynamic`) · `node scripts/check-trust-boundaries.mjs` 0 (72 punkty wejścia)
· `npm run perf` 0 (bundel `/calendar` 293,4 kB przy progu 301,6 kB, zestaw L zgodny
co do wiersza) · `node scripts/a11y-audit.mjs` 0 naruszeń · `npx playwright test`
22 zielone, 1 pominięty świadomie.

## Otwarte problemy i pułapki

- Baza stoi w kontenerze Docker `mc-pg` na porcie 5433 (`docker start mc-pg`), bo
  `DATABASE_URL` od usera nie przyszedł. Liczby są porównywalne między sobą, ale nie są
  prognozą produkcji.
- Historia gita nadal zawiera prawdziwe dane osobowe z usuniętego `scripts/import-people.ts`.
  Usunięcie pliku tego nie czyści. Decyzja usera, patrz F7-23 i `docs/ARCHITEKTURA.md` sekcja 9.
- Pomiar kontekstu workera: `bash ~/.claude/agent-context.sh 1000000`. ARGUMENT JEST
  OBOWIĄZKOWY, okno modelu to 1 000 000, bez niego wynik jest pięć razy zawyżony.
- Szum zrzutów ekranu wynosi 0 pikseli poza widokiem ganta, gdzie sięga około 4000.
  Dowody wizualne dla ganta bierz z wartości wyliczonej stylu, nie z `pngdiff`.
- Szum czasowy między przebiegami sięga 40%. Wnioski wydajnościowe z mediany trzech przebiegów.
- Pełny stan środowiska i pułapki narzędziowe: `NEXT-TASKS.md` oraz `DECISIONS.md`.

## Znaczniki

- `STOP-GATE:` — pętla zatrzymana, czeka na decyzję usera
- `BLOCKED-ASK-USER:` — brakuje danych wejściowych od usera

`STOP-GATE: bramka decyzyjna F8.` Pętla zatrzymana przed ostatnią fazą. Do rozstrzygnięcia
przez usera: F8-01 (czy wdrażamy na produkcję), F8-02 (czy zmieniamy stack; budżety są
spełnione, więc rekomendacja brzmi „nie"), F8-03 (opcjonalne, logowanie i role, praca
nieplanowana).

`F4-06` zamknięte 2026-09-03: prawdziwy arkusz dostarczony, import przeszedł od pliku
do bazy roboczej bez ręcznego przestawiania kolumn. Zostały z tego dwie decyzje dla
usera: `F7-44` (wiersze bez imienia) i `F7-45` (status twórcy bez kolumny w bazie).

`BLOCKED-ASK-USER: wdrożenie na produkcję` — user zgodził się na push, ale wdrożenie
NIE wykonuje migracji (`build` to samo `next build`), a baza produkcyjna nie ma ani
`0003` (sześć kolumn kamerzysty), ani `0004` (status twórcy). Bez nich `/artists`
i `/videographers` wywalą się na nieistniejących kolumnach. Przed pushem na `main`
trzeba wykonać `DATABASE_URL=<adres produkcyjny> npm run db:migrate`; obie migracje są
addytywne, zero DROP, odwracalne. Brakuje `DATABASE_URL` produkcji. Wariant bez ryzyka:
push na gałąź roboczą zamiast `main` daje wdrożenie podglądowe. Repozytorium jest 116
commitów przed `origin/main` (`github.com/maciejsachse0-source/Marketing-dashboard-manager`),
wdrożenie produkcyjne odpala się automatycznie z `main`, a orkiestrator nie ma dostępu
do tamtego konta Vercela, więc nie zobaczy wyniku wdrożenia.

`BLOCKED-ASK-USER: F5-04` — publiczny adres środowiska podglądowego. Środowisko działa
lokalnie i w sieci lokalnej. Wybór: `tailscale funnel` (zajmuje port 443, na którym stoi
vibe-kanban) albo hosting (wymaga wypchnięcia repozytorium poza tę maszynę, a w historii
gita siedzą dane osobowe). Niezależnie od wyboru potrzebna osobna para `AUTH_EMAIL`
i `AUTH_PASSWORD`.

`BLOCKED-ASK-USER: F7-23` — czyszczenie historii gita z danych osobowych. Przepisuje
wszystkie commity, zmienia każdy hash, wymusza ponowne sklonowanie.

`BLOCKED-ASK-USER: F7-29` — czy czas oglądania i CTR mają być widoczne na `/analytics`.
Trzy kolumny arkusza CSV są wczytywane i nigdzie nie lądują.
