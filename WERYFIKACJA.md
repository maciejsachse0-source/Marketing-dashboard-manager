# WERYFIKACJA, lista do klikniętego sprawdzenia

Wypełnione przez agenta recenzenta 2026-09-03, po zamknięciu fazy F7, przed bramką F8.
Lista jest zbudowana z issues, które naprawdę są skończone. Pozycje zablokowane
(F4-06, F5-04 w części publicznego adresu, F7-23, F7-29, cała faza F8) nie mają tu wpisu,
bo nie ma czego klikać.

## Jak z tego korzystać

1. Odpal bazę i aplikację na tej maszynie:
   `docker start mc-pg`, potem `npm run dev`, potem `http://localhost:3000`.
   Logowanie parą `AUTH_EMAIL` i `AUTH_PASSWORD` z `.env.local`.
2. Baza robocza to `marketing`. Jeżeli chcesz klikać po dużych danych bez ryzyka,
   użyj środowiska podglądowego: `npm run preview:setup`, potem `npm run preview:serve`,
   adres `http://localhost:3001`. Tam siedzi zestaw syntetyczny (200 artystów,
   500 produkcji, 3000 wpisów kalendarza) i nic stamtąd nie trafia do bazy roboczej.
3. Idź pozycja po pozycji. Każda mówi, co uruchomić, co kliknąć i czego oczekiwać.
4. Zgadza się, zaznacz pole. Nie zgadza się, nie poprawiaj wpisu, tylko zgłoś.
   Zgłoszenia wracają jako issues w fazie `F7-ZNALEZISKA` w `plan/08-BACKLOG.md`.

Uwaga do pomiarów: komendy `npm run perf` i `node scripts/a11y-audit.mjs` wymagają
działającego serwera w trybie produkcyjnym. Postaw go komendą `npm run perf:serve`
i dopiero wtedy uruchamiaj pomiar w drugim oknie terminala.

---

## F0, fundament: środowisko, przyrządy, pomiar bazowy

- [ ] **Aplikacja wstaje na tej maszynie** (F0-00, F0-01), adres `/login`
  Uruchamiasz: `docker start mc-pg`, potem `npm run dev`.
  Oczekujesz: w terminalu linia `Ready in` poniżej jednej sekundy, a
  `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login` zwraca `200`.
  Po zalogowaniu ląduje Cię na `/calendar` z nagłówkiem `Pipeline`.

- [ ] **Trzy osobne bazy, żadna nie miesza się z drugą** (F0-01), terminal
  Uruchamiasz: `npm run pg:info` (baza pomiarowa) i `npm run pg:info -- --work` (robocza).
  Oczekujesz: dwie różne nazwy baz w nagłówku wyniku (`marketing_perf` i `marketing`),
  w obu po 12 tabel i sekcja `indeksy` z 25 pozycjami.
  Bezpiecznik: `git status --porcelain | grep -c '.env.local'` zwraca `0`,
  czyli hasła i adresy baz nie są w repozytorium.

- [ ] **Cztery bramki jakości są zielone** (F0-02), terminal
  Uruchamiasz kolejno: `npm run typecheck`, `npm run lint`, `npm run test`,
  `node scripts/check-typography.mjs`.
  Oczekujesz: typecheck kod 0 bez wypisanych błędów; lint `0 errors, 36 warnings`;
  testy `20 passed` plików i `224 passed` testów; typografia `TRAFIENIA: 0`.

- [ ] **Zestaw danych L jest kompletny** (F0-03), terminal
  Uruchamiasz: `node scripts/perf/table-counts.mjs`.
  Oczekujesz: `videographers 60`, `campaigns 40`, `calendar_entries 3000`,
  `posts 5000`, `csv_uploads 20`, `csv_rows 12000`.
  Uwaga, znaleziona rozbieżność: `artists` pokazuje dziś 1180 zamiast 200,
  a `productions` 504 zamiast 500, bo przebiegi testowe dopisały wiersze do bazy
  pomiarowej. Jeżeli chcesz czystego pomiaru, przed nim wykonaj
  `npx tsx scripts/perf/seed-large.ts`, który stawia zestaw od zera.

- [ ] **Harness pomiarowy odpowiada liczbami, nie opiniami** (F0-04, F0-05), terminal
  Uruchamiasz: `npm run perf:serve` w jednym oknie, `npm run perf` w drugim.
  Oczekujesz: tabela `BAZA` z czterema zapytaniami, przy każdym `seqScan nie`;
  tabela `STRONY` z dziewięcioma adresami; linia `BUNDLE`; na końcu
  `Wszystkie progi trzymają` i kod wyjścia 0.

- [ ] **Dokumentacja mówi prawdę o stacku** (F0-06, F0-07, F6-03, Z12), plik
  Otwierasz: `docs/ARCHITEKTURA.md`.
  Oczekujesz: dziewięć sekcji, w sekcji 1 baza opisana jako PostgreSQL przez
  `postgres-js` i Drizzle, nigdzie SQLite jako stanu bieżącego.
  `README.md` i `CLAUDE.md` nie powtarzają treści, tylko linkują do tego pliku
  (sprawdź pierwsze dwadzieścia linii obu).

---

## F1, wydajność warstwy danych i serwera

- [ ] **Każda kolumna filtrowana ma indeks** (F1-01, zasada Z9), terminal
  Uruchamiasz: `npm run pg:info`, potem `node scripts/perf/measure-db.mjs`.
  Oczekujesz: w sekcji indeksów 25 pozycji, w tym 13 o nazwach kończących się na `_idx`
  (`productions_campaign_id_idx`, `calendar_entries_starts_at_idx`,
  `posts_published_at_idx` i dziesięć pozostałych).
  W tabeli pomiaru: kolumna `seqScan` ma `nie` w każdym z czterech wierszy,
  a `p95 ms` w każdym poniżej 120 (dziś między 0,71 a 1,2 ms).

- [ ] **Strony ładują się w budżecie na dużych danych** (F1-02), terminal plus przeglądarka
  Uruchamiasz: `npm run perf:serve`, potem `npm run perf`.
  Oczekujesz: w tabeli `STRONY` przy każdej pozycji `ok`. Progi: `/` 600 ms,
  `/calendar` 900 ms, `/productions/list` 600 ms. Dzisiejsze wartości p95 to
  odpowiednio 20,6, 92 i 199,5 ms.
  Klikasz dodatkowo: wejdź na `/campaigns/1` i `/productions/1`.
  Oczekujesz: strona pojawia się od razu, bez migotania sekcji jedna po drugiej.

- [ ] **Mechanizm Cache Components jest wyłączony świadomie** (F1-03), plik
  Otwierasz: `next.config.ts` i `src/app/layout.tsx`.
  Oczekujesz: `next.config.ts` nie włącza Cache Components (hipoteza została zmierzona
  i obalona, opis w `DECISIONS.md` pod hasłem F1-03), a `src/app/layout.tsx`
  nie ma już linii `export const dynamic = 'force-dynamic'`.
  Kontrola: `grep -c "force-dynamic" src/app/layout.tsx` zwraca `0`.

- [ ] **Zapis od razu widać w docelowym widoku** (F1-04), `/productions/list`,
      `/campaigns/list`, `/artists`, `/calendar`
  Klikasz: dodaj produkcję na `/productions/list`, dodaj kampanię na `/campaigns/list`,
  dodaj artystę na `/artists`, potem wróć na `/calendar`.
  Oczekujesz: nowy wiersz jest widoczny natychmiast, bez wciskania odświeżenia
  przeglądarki. Nowa produkcja pokazuje się także jako pasek na osi w `/calendar`.
  Odhaczony krok produkcji zostaje odhaczony po wyjściu i powrocie na stronę produkcji.
  Automat: `npx playwright test e2e/revalidate.spec.ts` daje 5 zielonych scenariuszy.

---

## F2, wydajność interfejsu

- [ ] **Gantt nie zacina się przy przełączaniu kampanii** (F2-02, F2-03, F2-04),
      `/calendar?view=week`
  Klikasz: w liście rozwijanej nad osią przełącz kampanię, potem wróć na poprzednią,
  powtórz kilka razy. Zwiń i rozwiń pasek produkcji.
  Oczekujesz: przerysowanie jest natychmiastowe, bez zamrożenia strony.
  Pomiar: `npm run perf:serve`, potem `npx playwright test e2e/gantt-filter.spec.ts`.
  Scenariusz mierzy czas przerysowania z progiem 300 ms.
  Uwaga: na `npm run dev` ten scenariusz świadomie się pomija, bo mierzyłby serwer
  deweloperski, nie kod produkcyjny (F7-28).

- [ ] **Tryb deweloperski chodzi na turbopacku i nie gubi siatki dni** (F2-05, F7-14),
      `/calendar`
  Uruchamiasz: `npm run dev`, wchodzisz na `/calendar`.
  Oczekujesz: w terminalu Next wypisuje `Turbopack`, strona wstaje w mniej niż sekundę,
  a pasy T na osi mają widoczne pionowe kreski podziału dni. Brak kresek to regresja.
  Pomiar liczbowy: `npm run perf:dev`, potem `npm run perf`, sekcja `DEV`,
  wszystkie pięć pozycji na `ok`.

- [ ] **Kod JavaScript strony kalendarza mieści się w budżecie** (F2-06), terminal
  Uruchamiasz: `npm run perf:serve`, potem `npm run perf`.
  Oczekujesz: linia `JS /calendar (gzip) 293.3 kB / limit 301.6`, status `ok`.
  Punkt wyjścia przed przebudową to 354,8 kB, czyli spadek o około 17 procent.

---

## F3, jeden wzorzec zamiast N kopii

- [ ] **W całej aplikacji nie ma już surowych guzików** (F3-01 do F3-05, zasada Z3), terminal
  Uruchamiasz: `grep -r '<button' src/ | wc -l`.
  Oczekujesz: `0`. Punkt wyjścia to 89.
  Kontrola w przeglądarce: na `/`, `/calendar`, `/productions/list`, `/campaigns/list`,
  `/artists`, `/videographers`, `/templates`, `/agents`, `/analytics`, `/import/osoby`
  i `/team` każdy guzik ma ten sam kształt narożników, tę samą wysokość w danym rozmiarze
  i tę samą obwódkę po wejściu tabulatorem.

- [ ] **Teksty nie mają emoji, wyśrodkowanych kropek ani długich myślników**
      (F3-06, F7-17, zasady Z5, Z6, Z7), terminal plus przeglądarka
  Uruchamiasz: `node scripts/check-typography.mjs` oraz `node scripts/check-typography.mjs data`.
  Oczekujesz: obie komendy wypisują `TRAFIENIA: 0`.
  Klikasz: przejrzyj `/agents` i wejdź w dowolną personę.
  Oczekujesz: w opisach nie ma znaku `—` ani `·`. Treść promptu systemowego zostaje
  nietknięta, bo idzie do modelu, nie na ekran.

- [ ] **Formularze szablonów i kampanii nadal działają po rozbiciu na mniejsze pliki**
      (F3-07, F3-08), `/templates/new`, `/campaigns/templates/new`
  Klikasz: utwórz szablon produkcji, dodaj dwa kroki, przesuń jeden strzałkami, zapisz.
  To samo dla szablonu kampanii z kamieniem milowym i podkamieniem.
  Oczekujesz: zapis kończy się komunikatem powodzenia, a po ponownym wejściu w edycję
  widać dokładnie to, co zapisano, w tej samej kolejności.

---

## F4, import osób z arkusza Excel

- [ ] **Reguły normalizacji wiersza są sprawdzone testami** (F4-01), terminal
  Uruchamiasz: `npx vitest run src/lib/import/normalize.test.ts`.
  Oczekujesz: 29 zielonych. Reguły obejmują handle podany jako pełny adres URL,
  handle bez małpy, telefon w czterech zapisach, email z wielkimi literami,
  nazwę z polskimi znakami, wiersz pusty. Pusta komórka zawsze daje `null`,
  nigdy pustego tekstu.

- [ ] **Duplikaty są rozpoznawane trzystopniowo** (F4-02), terminal
  Uruchamiasz: `npx vitest run src/lib/import/dedup.test.ts`.
  Oczekujesz: 13 zielonych. Najważniejsze zachowanie: duplikat prawdopodobny
  (ta sama nazwa i ta sama lokalizacja) domyślnie nie jest aktualizowany,
  a artysta nigdy nie jest duplikatem kamerzysty.

- [ ] **Arkusz syntetyczny powstaje jedną komendą i nie ma w nim prawdziwych osób**
      (F4-03, zasada Z14), terminal
  Uruchamiasz: `npx tsx scripts/make-fixture-xlsx.ts`, potem
  `git status --porcelain | grep -c xlsx`.
  Oczekujesz: plik `tests/fixtures/osoby.xlsx` powstaje, a licznik zwraca `0`,
  czyli arkusz nie wchodzi do repozytorium. W arkuszu 1131 wierszy, wszystkie nazwy
  to atrapy z licznika, domena `przyklad.test`.

- [ ] **Ekran importu prowadzi przez kroki od 1 do 4** (F4-04), `/import/osoby`
  Klikasz: przeciągnij `tests/fixtures/osoby.xlsx` na strefę zrzutu, wybierz arkusz
  twórców i rolę, sprawdź mapowanie kolumn, przejdź do suchego przebiegu.
  Oczekujesz kolejno: strefa podświetla się przy przeciąganiu; po wgraniu widać nazwy
  arkuszy i liczby wierszy; mapowanie ma wypełnione pola `Nazwa`, `Handle`, `E-mail`,
  `Telefon`, `Lokalizacja`, `Uwagi`; podgląd podaje liczby nowych, duplikatów i błędnych.
  Zmiana mapowania przelicza podgląd bez ponownego wysyłania pliku.

- [ ] **Ekran importu odrzuca zły plik komunikatem, nie awarią** (F4-04, zasada Z13),
      `/import/osoby`
  Klikasz: wgraj plik `.csv` albo `.txt`, potem plik większy niż 10 MB.
  Oczekujesz dosłownie: `Ten format nie jest obsługiwany. Wgraj plik xlsx`
  oraz `Plik ma 11,0 MB, a limit to 10,0 MB`. Strona nie przechodzi dalej,
  do serwera nie idzie żadne żądanie parsowania.

- [ ] **Kolizja mapowania blokuje przejście dalej** (F4-04), `/import/osoby`
  Klikasz: ustaw dwie różne kolumny arkusza na to samo pole osoby.
  Oczekujesz: oba pola wyboru dostają czerwoną obwódkę, przycisk dalej jest wygaszony,
  a komunikat wymienia nazwy obu kolidujących pól.

- [ ] **Suchy przebieg niczego nie zapisuje** (F4-04), `/import/osoby` plus terminal
  Uruchamiasz przed i po suchym przebiegu: `node scripts/perf/table-counts.mjs --work`.
  Oczekujesz: liczba w wierszu `artists` i `videographers` identyczna przed i po.

- [ ] **Zapis idzie w jednej transakcji, z licznikiem paczek** (F4-05), `/import/osoby`
  Klikasz: po suchym przebiegu wybierz politykę i kliknij `Importuj`.
  Oczekujesz: przycisk blokuje się z napisem `Zapisuję`, pod nim pasek postępu
  i tekst w formie `Zapisuję, paczka 4 z 10`. Po zakończeniu podsumowanie
  w formie `Dodano 975, zaktualizowano 0, pominięto 0`, odnośnik do `/artists`
  i przycisk `Importuj kolejny plik`.

- [ ] **Błędne wiersze da się pobrać jako CSV** (F4-05), `/import/osoby`
  Klikasz: na ekranie podsumowania kliknij pobranie listy błędów.
  Oczekujesz: przeglądarka pobiera plik `import-bledy.csv`, a w nim jeden wiersz
  na każdy odrzucony wiersz arkusza, z numerem wiersza i powodem.

- [ ] **Przerwany zapis nie zostawia połówek** (F4-05), terminal
  Uruchamiasz: `npx vitest run src/lib/import/save.test.ts`.
  Oczekujesz: 5 zielonych na prawdziwej bazie testowej. Scenariusz kluczowy psuje
  wiersz 120 ze 150 i sprawdza, że po wyjątku w bazie jest tyle wierszy co przed,
  czyli zero, a nie 100 z pierwszej paczki.

- [ ] **Import nigdy nie kasuje osób nieobecnych w arkuszu** (F4-05), terminal
  Uruchamiasz: `npx vitest run src/lib/import/save.test.ts -t "nie usuwa"`.
  Oczekujesz: test zielony. Wstawia 200 osób, importuje arkusz z jednym wierszem
  i sprawdza, że liczba rośnie do 201, a nie spada do 1.

- [ ] **Skrypt z prawdziwymi danymi osobowymi zniknął z kodu** (F4-07, zasada Z14), terminal
  Uruchamiasz: `test -e scripts/import-people.ts; echo $?` oraz
  `grep -r '@noyasnee\|@akku.wav' src scripts | wc -l`.
  Oczekujesz: `1` (plik nie istnieje) i `0` (żadnego prawdziwego handle w kodzie).
  Do decyzji, świadomie otwarte: dane zostały w historii gita, jej czyszczenie
  to Twoja decyzja, opis w `docs/ARCHITEKTURA.md` sekcja 9 (issue F7-23).

- [ ] **Cały import od pliku do bazy przechodzi automatem** (definicja ukończenia F4), terminal
  Uruchamiasz: `npx playwright test e2e/import-osoby.spec.ts`.
  Oczekujesz: 16 zielonych scenariuszy, czas poniżej minuty. Testy chodzą po osobnej
  bazie testowej, więc nic nie wchodzi do bazy roboczej.

---

## F5, testy, dryf i środowisko dla zespołu

- [ ] **Zakres testów jednostkowych jest domknięty** (F5-01), terminal
  Uruchamiasz: `npm run test`.
  Oczekujesz: `Test Files 20 passed`, `Tests 224 passed`, czas poniżej pięciu sekund.

- [ ] **Bramka wydajnościowa blokuje regres, ale nie pada na szumie** (F5-02), terminal
  Uruchamiasz: `node scripts/perf/drift-selftest.mjs`, potem `npm run perf`.
  Oczekujesz: samotest przechodzi, a w raporcie sekcja `DRYF` wypisuje ostrzeżenia
  przy zmianach powyżej 15 procent i kończy się `Wszystkie progi trzymają`.
  Ostrzeżenie samo w sobie nie blokuje, blokuje dopiero 30 procent razem
  z 10 procentami limitu budżetowego.

- [ ] **Scenariusze end to end przechodzą w komplecie** (F5-03), terminal
  Uruchamiasz: `npx playwright test` (ubij wcześniej własny `npm run dev`, port 3000
  musi być wolny, test stawia własny serwer na bazie testowej).
  Oczekujesz: `22 passed, 1 skipped` w około 1,5 minuty. Pominięty jest wyłącznie pomiar
  przerysowania ganta, który ma sens dopiero na budowaniu produkcyjnym.

- [ ] **Środowisko do klikania dla zespołu wstaje lokalnie** (F5-04, część niezablokowana),
      `http://localhost:3001`
  Uruchamiasz: `npm run preview:setup`, potem `npm run preview:serve`.
  Oczekujesz: serwer na porcie 3001, po zalogowaniu widać 200 artystów, 500 produkcji
  i 3000 wpisów kalendarza, czyli dane syntetyczne, nie robocze.
  Do decyzji, świadomie otwarte: publiczny adres tego środowiska czeka na Ciebie.

---

## F6, dostępność, bezpieczeństwo, dokumentacja

- [ ] **Cała aplikacja jest obsługiwalna z klawiatury** (F6-01), terminal plus przeglądarka
  Uruchamiasz: `npm run perf:serve`, potem `node scripts/a11y-audit.mjs`.
  Oczekujesz: dla `/calendar`, `/productions/list` i `/import/osoby` po trzy zera:
  `bez obwódki ogniskowania: 0`, `guziki bez nazwy: 0`, `obszar dotyku < 44 px: 0`,
  a na końcu `RAZEM naruszeń: 0`.
  Klikasz sam: wejdź na `/calendar`, naciskaj tabulator.
  Oczekujesz: przy każdym elemencie widać wyraźną obwódkę, żaden nie jest przeskakiwany.

- [ ] **Każde wejście danych ma schemat walidacji** (F6-02, zasada Z13), terminal
  Uruchamiasz: `node scripts/check-trust-boundaries.mjs`.
  Oczekujesz: ostatnia linia `Punktów wejścia: 73. Bez schematu mimo argumentów: 0`.

- [ ] **Dokument architektury jest kompletny** (F6-03), plik `docs/ARCHITEKTURA.md`
  Otwierasz: spis treści.
  Oczekujesz: dziewięć sekcji, sekcja 5 z nazwami tabel i kolumn, sekcja 8 z instrukcją
  uruchomienia od zera, sekcja 9 z notatką o danych osobowych i o historii gita.

---

## F7, znaleziska naprawione po drodze

- [ ] **Przejścia między stronami nie przeładowują aplikacji** (F7-04), `/agents/<slug>/edit`,
      `/campaigns/<id>`
  Klikasz: odnośnik powrotu na stronie edycji persony agenta i odnośnik
  `wszystkie kampanie` na stronie kampanii.
  Oczekujesz: przejście jest natychmiastowe, pasek boczny nie mruga, przeglądarka
  nie pokazuje pełnego przeładowania strony.

- [ ] **Nie ma już lewych pasków akcentu na wyróżnieniach** (F7-08, zasada Z8), cała aplikacja
  Klikasz: przejrzyj `/calendar`, `/productions/<id>`, `/campaigns/<id>` i okno pomocy.
  Oczekujesz: wyróżnione bloki (ramki informacyjne, pigułki, cytaty) mają pełne
  obramowanie albo tło. Pionowe kreski na osi ganta to łączniki kroków, nie ozdoba,
  i mają zostać.

- [ ] **Kółko podkroku ma to samo obramowanie co reszta ramek** (F7-31), `/calendar`
  Klikasz: rozwiń produkcję z podkrokami na osi.
  Oczekujesz: obwódka kółka podkroku ma ten sam kolor i grubość co obramowanie pasma T,
  do którego należy, a nie kolor wpisany osobno.

- [ ] **Mikro-etykiety sekcji wyglądają wszędzie tak samo** (F7-15), cała aplikacja
  Klikasz: porównaj małe nagłówki nad polami, na przykład `SPRZĘT` i `DOSTĘPNOŚĆ`
  na `/videographers` z `START PRODUKCJI` na stronie produkcji.
  Oczekujesz: identyczna wielkość liter, odstęp między literami i kolor.

- [ ] **Zwinięte pole wyboru pokazuje etykietę, nie klucz** (F7-20), `/agents/new`
  Klikasz: rozwiń i wybierz wartość w polu wyboru na formularzu agenta, potem je zwiń.
  Oczekujesz: w zwiniętym polu widać czytelną nazwę po polsku, nie identyfikator
  techniczny w rodzaju `campaign-strategist`.

- [ ] **Tytuł produkcji widać na jej stronie i na każdej karcie listy** (F7-24),
      `/productions/<id>`, `/productions/list`
  Klikasz: otwórz dowolną produkcję, potem wróć na listę.
  Oczekujesz: nagłówek pierwszego poziomu to tytuł produkcji, a nazwa artysty stoi
  w wierszu pod nim obok daty T-0. Na liście dwie produkcje tego samego artysty
  mają dwa różne, widoczne tytuły.
  Kontrola liczbowa: na zestawie L strona `/productions/332` ma nagłówek
  `Produkcja 332` i podpis `Ewa Wiśniewska`.

- [ ] **Odnośniki nawigacji mają pełne pole dotyku na ekranie dotykowym** (F7-25),
      pasek boczny
  Uruchamiasz: `node scripts/a11y-audit.mjs` przy serwerze produkcyjnym.
  Oczekujesz: `obszar dotyku < 44 px: 0` na każdej z trzech badanych stron.
  Klikasz sam: na urządzeniu dotykowym albo w trybie emulacji dotyku trafiaj w pozycje
  paska bocznego. Każda ma się dać kliknąć bez celowania.

- [ ] **Przesunięcie startu produkcji nie dryfuje przy powtórzeniu** (F7-27),
      `/productions/<id>`
  Klikasz: zmień datę startu produkcji, zapisz, otwórz to samo pole ponownie
  i zapisz tę samą datę drugi raz.
  Oczekujesz: przy drugim zapisie nic się nie przesuwa. Wszystkie kroki, daty
  i wpisy w kalendarzu stoją tam, gdzie po pierwszym zapisie.
  Automat: `npx playwright test e2e/f7-27-start-produkcji.spec.ts`, scenariusz zielony.

- [ ] **Karta kamerzysty pokazuje kontakty z ich własnych kolumn** (F7-19, F7-32),
      `/videographers`
  Klikasz: dodaj kamerzystę i wypełnij osobno pola handle, email i telefon, zapisz.
  Oczekujesz: na karcie pojawiają się trzy osobne kontakty, każdy z własną ikoną
  (koperta, słuchawka, małpa). Wyszukiwarka nad listą znajduje tego kamerzystę
  po każdym z czterech pól. Stare pole `contact` pokazuje się wyłącznie na wierszach,
  które nic innego nie mają, i jest opisane jako pole zastane.
  Uwaga: na środowisku podglądowym i pomiarowym te kolumny są puste, bo generator
  danych syntetycznych wypełnia tylko stare `contact`. Sprawdzaj to na bazie roboczej.

- [ ] **Persony agentów pokazują przepis, który naprawdę działa** (F7-30), `/agents/<slug>`
  Klikasz: otwórz dowolną personę, skopiuj przykładowe wywołanie i wykonaj je.
  Oczekujesz: wywołanie kończy się wynikiem, nie wyjątkiem. Wcześniej przepisy
  wskazywały wywołanie, które rzucało błędem.

- [ ] **Wpisy kalendarza pozostają kanałem dla agentów, bez guzika w interfejsie** (F7-09),
      `/calendar`
  Klikasz: poszukaj przycisku dodania wpisu kalendarza.
  Oczekujesz: takiego przycisku nie ma i tak ma być. Wpisy powstają razem z krokiem
  produkcji albo przez agenta. Jeżeli uznasz, że chcesz go w interfejsie, to jest
  zmiana zakresu, nie błąd.

---

## Znaleziska recenzenta, do rozstrzygnięcia przez Ciebie

Poniższe nie są pozycjami do odhaczenia, tylko listą do decyzji. Pełny opis w raporcie
recenzji, każde nadaje się na issue w `F7-ZNALEZISKA`.

- [ ] Katalog o nazwie `C:\Users\Hp omen\OneDrive\MARKETPLACE DOCS\Marketing Content`
      powstaje w katalogu repozytorium na macOS i rośnie z każdym przebiegiem testów
      (dziś 59 podkatalogów). Źródło: `src/lib/production-work-folder.ts:37`.
- [ ] Baza pomiarowa `marketing_perf` odjechała od zestawu L (1180 artystów zamiast 200,
      504 produkcje zamiast 500), a przebiegi w `perf/runs/` nie zapisują liczby wierszy,
      więc nie widać, na jakich danych zmierzono którą liczbę.
- [ ] Cztery komponenty z `src/components/ui/` i `src/components/campaigns/milestones-tracker.tsx`
      nie mają ani jednego odbiorcy, razem 1012 linii martwego kodu.
- [ ] Akcja serwerowa `saveOutreach` w `src/server/actions/outreach.ts` nie jest wołana
      z żadnego miejsca w interfejsie.
- [ ] Strzałki `←` i `→` w tekstach przycisków i odnośników zastępują ikony,
      a zasada Z5 mówi o ikonach wyłącznie z `lucide-react`.
- [ ] Cztery pliki ganta mają kolor cienia wpisany wprost jako `rgb(...)`,
      co zasada Z4 wyklucza.

---

## Podpis

| Kto sprawdzał | Kiedy | Środowisko (adres) | Uwagi |
|---|---|---|---|
|  |  |  |  |
