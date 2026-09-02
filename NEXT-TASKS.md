# NEXT-TASKS — przekazanie do kolejnego workera

Stan na 2026-09-02, po zamknięciu **całej fazy F3** (F3-01 do F3-08).
Definition of Done F3 sprawdzony punkt po punkcie, wszystko zielone (szczegóły
w `DECISIONS.md`, sekcja „F3 — raport fazy").

## Następne issue

**F4-00** `db` Wyrównanie schematu osób. CZYTAJ: `plan/04-import-excel.md` sekcja 3,
`drizzle/schema.ts`. Kolejność w `plan/08-BACKLOG.md` jest prawem.

Uwaga: faza F4 ma issue **F4-06** oznaczone `⏳ ZABLOKOWANE` (czeka na plik `.xlsx`
z osobami od usera). Wolno je pominąć i wrócić później.

Bramka z F0 (`docs/ARCHITEKTURA.md` potwierdzony przez usera) nadal otwarta
i nadal nie blokuje niczego poza wdrożeniem.

## Co zastajesz po F3

**Zero surowych `<button>` w `src/`** (było 89), `<Button>` 146, reguła lintu jest
błędem z pustą listą wyjątków. Nie cofnij tego.

**Zero emoji, wyśrodkowanych kropek i długich myślników** w tekstach widocznych
dla użytkownika. Bramka: `node scripts/check-typography.mjs` (kod 0 = czysto).
Skrypt parsuje drzewo TypeScriptu i patrzy tylko na węzły tekstowe, więc komentarze
w kodzie są poza zakresem, zgodnie z Z7. Uruchom go po każdej zmianie w copy.
Kanon zamiany: długi myślnik na krótki z odstępami, wyśrodkowana kropka na przecinek.

**Trzy pliki rozbite**: `template-form.tsx` 1250 → 552, `campaign-template-form.tsx`
792 → 580, `timeline.tsx` 735 → 228. Jedenaście nowych plików, największy 202 linie.
Testy przypinające leżą w `src/components/templates/__tests__/` i
`src/components/campaigns/__tests__/` — nie kasuj ich, to jedyna siatka pod tymi ekranami.

## Pułapki, na które wdepnąłem w F3-06 do F3-08

1. **`npx playwright test` bierze cudzy serwer.** `reuseExistingServer: true` znaczy,
   że jeśli na porcie 3000 stoi `npm run perf:serve` (build produkcyjny, baza
   `marketing_perf`), to e2e pójdzie tam i pokaże czerwone testy wyglądające
   na regresję. Ubij serwer perfowy, podnieś `npm run dev`, powtórz. Issue: **F7-18**.
2. **Nowy plik wychodzi spod grandfathera lintu.** Kod przeniesiony z wielkiego pliku
   do nowego zamienia ostrzeżenia w błędy. Do listy w `eslint.config.mjs` się NIE
   dopisuje, tylko naprawia przyczynę: wydziel funkcję, wydziel komponent.
3. **Do złożoności cyklomatycznej liczy się `?.` i `??`.** Komponent bez ani jednego
   `if`, który czyta pięć opcjonalnych pól, potrafi przekroczyć próg 10.
4. **`document.body.style.X = ...` to błąd `react-hooks/immutability`** w nowym pliku.
   Zamiennik bez zmiany zachowania: `classList.add('select-none')`.
5. **Zmiana interpunkcji zmienia piksele.** Przecinek jest węższy od kropki, krótki
   myślnik od długiego, więc po F3-06 `pngdiff` pokazuje tysiące różnic i to nie jest
   regresja. Dowodem na „treść bez zmian" jest porównanie diffa z odjętą interpunkcją,
   nie licznik pikseli. Przy F3-07 i F3-08 (czysty refaktor) `pngdiff` dał **0**.
6. **Formularze mają walidację serwerową szerszą niż kliencka.** Szablon produkcji
   wymaga wypełnionego „Krótki opis" i „Pełny opis", choć klient tego nie sprawdza.
   Skrypt przeglądarkowy, który tego nie wypełni, utknie bez nawigacji.

## Liczby, do których porównujesz

`npm run perf` kod **0**, bundel `/calendar` **292,2 kB** przy progu 301,6 kB.
`npm run lint` kod 0, **108 ostrzeżeń** (było 111), 0 błędów.
`npm run typecheck` kod 0. `npm run test` **29 zielonych** (było 21).
`npx playwright test` **8 zielonych** (przy `npm run dev` na porcie 3000).
Szum czasowy między przebiegami sięga 40%, próg szumu porównania zrzutów
to 1 155 do 1 680 pikseli z 7 823 808.

## Jak uruchomić

```
docker start mc-pg
npm run dev                 # webpack, port 3000
node scripts/check-typography.mjs           # bramka Z5, Z6, Z7
npm run perf:serve          # terminal 1 (najpierw ubij dev, port 3000 zajęty)
npm run perf                # terminal 2, oczekiwany kod 0
node scripts/perf/shot.mjs <tag> /sciezka [...]   # zrzuty do screenshots/
node scripts/perf/pngdiff.mjs <a> <b>
```

## Stan środowiska

Bez zmian: baza w kontenerze `mc-pg` (port 5433, bazy `marketing`, `marketing_perf`,
`marketing_test`), `psql` tylko przez `docker exec`, brak `magick`/`compare`/`PIL`,
`.env.local` poza gitem, tryb deweloperski na webpacku (decyzja orkiestratora,
do czasu zamknięcia F7-14). `@testing-library/user-event` NIE jest zainstalowany
i nie trzeba go instalować — `fireEvent` wystarcza.

## Decyzje w toku

Bez zmian: `DATABASE_URL` do prawdziwej bazy, hosting (Vercel), plik `.xlsx`
z osobami (F4-06), potwierdzenie `docs/ARCHITEKTURA.md` przez usera.

## Znaleziska w F7

**F7-01** do **F7-18**, żadne nie blokuje. Nowe w tej paczce:
- **F7-17** — długie myślniki w opisach agentów i szablonów w `data/`, widoczne
  na pulpicie, poza dosłownym zakresem Z7 (`src/`); te same pliki niosą system prompty,
  więc masowa podmiana zmieniłaby tekst idący do modelu.
- **F7-18** — `npx playwright test` po cichu bierze serwer i bazę z portu 3000.

Commity fazy: `8360b94` (F3-01), `0e025de` (F3-02), `d834628` (F3-03), `f4dadad` (F3-04),
`92055e6` (F3-05), `11f4188` (F3-06), `0101935` (F3-07), `76820f6` (F3-08).
