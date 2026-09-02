# NEXT-TASKS — przekazanie do kolejnego workera

Stan na 2026-09-02, po zamknięciu **F3-01 do F3-05** (migracja guzików skończona).
Faza F3 ma jeszcze trzy issues: F3-06, F3-07, F3-08.

## Następne issue

**F3-06** `ui` Kanon typografii i ikon.
CZYTAJ: `plan/01` zasady Z4 do Z8. Kolejność w `plan/08-BACKLOG.md` jest prawem.

Bramka z F0 (`docs/ARCHITEKTURA.md` potwierdzony przez usera) nadal otwarta
i nadal nie blokuje niczego poza wdrożeniem.

## Co zastajesz po F3-01 do F3-05

**Zero surowych `<button>` w `src/`.** Licznik: 89 → 0, `<Button>`: 55 → 146.
Reguła `no-restricted-syntax` w `eslint.config.mjs` jest **błędem, bez listy
wyjątków** (zniknął też wyjątek na `src/components/ui/**`). Nowy surowy `<button>`
wywali `npm run lint`. Sprawdzone na żywym pliku probującym, nie z konfiguracji.

`<Button>` ma nowy prop **`loading`** (F3-01): wirująca ikona przed tekstem,
`aria-busy="true"`, `disabled`, `motion-reduce:animate-none` na ikonie. Szerokość
guzika rośnie o ikonę i odstęp — świadomie, uzasadnienie w `DECISIONS.md`.
Używa go dziś jeden guzik: „Usuń kampanię" w `gantt-narrative-row.tsx`.

`prefers-reduced-motion` był już obsłużony globalnie w `globals.css`
(`transition-duration: 1ms !important` dla `*`) — nie dopisuj tego drugi raz.

**`plan/05-ui-system.md` przepisany**: sekcja 1 to zmierzony inwentarz z licznikami,
sekcja 6 niesie tabelę pięciu pułapek migracji guzika. Czytaj ją, zanim ruszysz
jakikolwiek `className` guzika.

## Pułapki, na które wdepnąłem w F3 (poza tymi z poprzedniego przekazania)

1. **Klasa bazowa `<Button>` zmienia wygląd, choć w kodzie nic nie widać.** Pięć
   mechanizmów, tabela w `plan/05` sekcja 6: wymuszony rozmiar ikony
   (`[&_svg:not([class*='size-'])]:size-4` — opisuj ikony `size-4`, nie `w-4 h-4`),
   `border border-transparent` plus `bg-clip-padding`, `px-2.5` rozpychające okrągłe
   znaczniki w kontenerze `grid`, `h-8`/`text-sm`/`font-medium`/`justify-center`,
   oraz `disabled:opacity-50` i `hover:bg-muted`.
2. **`display: block` skraca wiersz o 4 px** (znika miejsce na wydłużenia dolne).
   Guzik, który był `inline-block`, ma zostać `inline-block`.
3. **`disabled:opacity-100` wolno dopisać tylko tam, gdzie oryginał nie miał
   `opacity-*`.** Gdzie miał (stan pusty, produkcja anulowana), trzeba dopisać jawny
   `disabled:opacity-50`, inaczej przygaszone elementy robią się pełne.
4. **Reszta różnicy pikseli na gancie to faza `animate-pulse`**, nie regresja.
   Skupiska po 82 do 85 pikseli na aktywny znacznik. Geometria zmierzona
   w przeglądarce jest identyczna. Licznik rośnie z liczbą produkcji w bazie.
5. **`npx playwright test` dosiewa dane** (nowe produkcje, kampanie, osoby), więc
   po każdym przebiegu e2e stary zrzut odniesienia przestaje pasować rozmiarem
   („ROZNE WYMIARY"). Bierz zrzut „przed" **bezpośrednio** przed zmianą kodu,
   a e2e uruchamiaj dopiero po zrobieniu obu zrzutów.
6. **Do porównania „przed" trzeba wrócić do starego kodu**: `git stash push -- <ścieżki>`
   dla niezacommitowanych zmian, `git checkout <sha> -- <ścieżki>` dla zacommitowanych
   (przed tym drugim skopiuj bieżące pliki na bok, bo `checkout` je nadpisze i wrzuci
   stare do indeksu).
7. Skrypt `scripts/perf/pngdiff.mjs` mówi tylko „ile pikseli". Do znalezienia „gdzie"
   pisałem trzy jednorazowe skrypty (mapa różnic w kafelkach, wycinek w powiększeniu,
   pierwszy różniący się wiersz) — skasowane po fazie, bo to była praca dochodzeniowa,
   nie narzędzie. Gdy znów będą potrzebne, napisz je od nowa: dekodowanie PNG idzie
   przez `chromium` z playwrighta, tak jak w `pngdiff.mjs`.

## Liczby, do których porównujesz

`npm run perf` kod **0**. Bundel `/calendar`: **292,3 kB** po gzip przy progu 301,6 kB
(wirująca ikona z F3-01 kosztowała 0,3 kB). p95 stron mieszczą się w progach z zapasem;
dryf p95 między przebiegami sięga 40%, więc raportowany „dryf +43%" nie jest regresją.

`npm run lint`: kod 0, 111 ostrzeżeń (grandfather: complexity i react-hooks), 0 błędów.
`npm run test`: 21 zielonych. `npx playwright test`: 8 zielonych.

Próg szumu porównania zrzutów: 1 155 do 1 680 pikseli z 7 823 808 na tym samym kodzie.

## Jak uruchomić

```
docker start mc-pg
npm run dev                 # webpack, port 3000
npm run perf:serve          # terminal 1 (zatrzymaj wcześniej dev, port 3000 zajęty)
npm run perf                # terminal 2, oczekiwany kod 0
node scripts/perf/shot.mjs <tag> /sciezka [...]   # zrzuty do screenshots/
node scripts/perf/pngdiff.mjs <a> <b>
```

## Stan środowiska

Bez zmian wobec poprzedniego przekazania: baza w kontenerze `mc-pg` (port 5433,
bazy `marketing`, `marketing_perf`, `marketing_test`), `psql` tylko przez
`docker exec`, brak `magick`/`compare`/`PIL`, `.env.local` poza gitem,
tryb deweloperski na webpacku (decyzja orkiestratora, do czasu zamknięcia F7-14).

## Decyzje w toku

Bez zmian: `DATABASE_URL` do prawdziwej bazy, hosting (Vercel), plik `.xlsx`
z osobami (F4-06), potwierdzenie `docs/ARCHITEKTURA.md` przez usera.

## Znaleziska w F7

**F7-01** do **F7-16**, żadne nie blokuje. Nowe w tej paczce:
- **F7-15** — mikro-etykieta sekcji powielona 90 razy w pięciu wariantach; naturalne
  miejsce naprawy to F3-06, więc zajrzyj tam, zanim zaczniesz.
- **F7-16** — `ui/card.tsx`, `ui/badge.tsx` i `ui/table.tsx` bez ani jednego użycia,
  przy 11 ręcznie składanych kartach i 4 surowych `<table>`.

Commity fazy: `8360b94` (F3-01), `0e025de` (F3-02), `d834628` (F3-03),
`f4dadad` (F3-04), `92055e6` (F3-05).
