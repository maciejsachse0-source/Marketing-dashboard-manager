# 04 — Import osób z arkusza Excel

Powierzchnia: strona `/import/osoby` plus warstwa parsowania w `src/lib/import/`.
Zastępuje jednorazowy skrypt `scripts/import-people.ts`, w którym dane osobowe są
wpisane na sztywno w kodzie (160 linii, w tym pełne imiona i handle z Instagrama).

## 1. Wejście

`arkusz źródłowy` to plik `.xlsx` dostarczony przez usera. Do czasu dostarczenia
pracujemy na fixture `tests/fixtures/osoby.xlsx`, generowanym skryptem
`scripts/make-fixture-xlsx.ts` z danych syntetycznych (bez prawdziwych osób).

Kształt potwierdzony na prawdziwym pliku (issue F4-06, 2026-09-03): jeden skoroszyt,
pięć arkuszy, nagłówki w wierszu 1, osobny arkusz dla twórców i osobny dla kamerzystów,
plus trzy arkusze robocze (mały arkusz kontaktów, szablony wiadomości, lista do
weryfikacji). Arkusz twórców ma 28 kolumn, z czego import dotyka pięciu; arkusz
kamerzystów 12 kolumn, z czego import dotyka pięciu. Reszta to kolumny robocze
(priorytet, etap produkcji, legendy, kolumny obliczane formułą, kolumny bez nagłówka)
— import je pomija.

Trzy rzeczy z prawdziwego pliku, których nie było w założeniu: (1) arkusz twórców
nie ma kolumny telefonu, ma ją tylko mały arkusz kontaktów; (2) handle na Instagramie
bywa zapisany bez małpy, samą nazwą; (3) część wierszy ma wyłącznie handle, bez imienia
— dla importu to błąd „brak nazwy", bo `name` jest wymagane (znalezisko F7-44).

Import NIE zakłada stałych nazw kolumn, tylko je proponuje (sekcja 3).

Biblioteka: `exceljs`. Uzasadnienie względem zasady Z16: żadna z obecnych zależności
nie czyta `.xlsx` (papaparse to CSV), a format to spakowany XML, którego nie parsuje się
ręcznie. Alternatywa `xlsx` (SheetJS) odpada, bo wersja z npm jest zamrożona i miała
otwarte podatności na prototype pollution. Wpis do `DECISIONS.md` obowiązkowy.

Limity wejścia: plik ≤ 10 MB, ≤ 5 000 wierszy, ≤ 60 kolumn. Przekroczenie to błąd
z komunikatem, nie próba przetworzenia.

## 2. Przepływ, krok po kroku

```
1. WYBÓR PLIKU     upload .xlsx (walidacja: rozszerzenie, typ MIME, rozmiar)
2. WYBÓR ARKUSZA   gdy skoroszyt ma > 1 arkusz, user wskazuje który i jaką rolę
                   pełni (twórcy / kamerzyści)
3. MAPOWANIE       tabela: kolumna arkusza → pole osoby; propozycja automatyczna,
                   user może zmienić każdą pozycję
4. SUCHY PRZEBIEG  podgląd: N nowych, M duplikatów, K wierszy z błędem, pierwsze
                   20 wierszy w tabeli z zaznaczonymi problemami. ZERO zapisów
5. ZATWIERDZENIE   user wybiera co zrobić z duplikatami: pomiń / zaktualizuj
6. ZAPIS           jedna transakcja, wstawki paczkami po 100 wierszy
7. PODSUMOWANIE    ile dodano, ile zaktualizowano, ile pominięto, lista błędów
                   do pobrania jako CSV
```

Kroki 4 i 5 są nieusuwalne. Import, który pisze do bazy bez podglądu, jest zakazany.

## 3. Warunek wstępny: wyrównanie schematu (issue F4-00)

Stan zastany, sprawdzony w `drizzle/schema.ts`, nie zakładany:

```
artists         id, name, handle, email, phone, avatar_url, notes,
                last_contact_at, created_at
videographers   id, name, contact, hourly_rate, equipment,
                availability_notes, avatar_url, notes, created_at
```

Czyli: **żadna z tabel nie ma `location`**, a `videographers` nie ma `handle`,
`email` ani `phone`, tylko jedno pole `contact`. Dane źródłowe mają dla obu ról
te same cztery rzeczy: imię, profil na Instagramie, lokalizację i status.

Dlatego przed pierwszym wierszem kodu importu wchodzi migracja (issue F4-00):

| Tabela | Dodawane kolumny |
|---|---|
| `artists` | `location text` |
| `videographers` | `handle text`, `email text`, `phone text`, `location text`, `status text` |

Druga migracja addytywna doszła w F7-45: `artists` dostaje `status text`
(migracja `0004`). Do tej pory kolumna statusu z arkusza twórców po prostu ginęła.

Migracje są wyłącznie addytywne. Istniejące `videographers.contact` zostaje
nietknięte; import wypełnia nowe kolumny, a jednorazowy skrypt przenoszący dane
z `contact` do `handle` albo `email` jest osobnym issue w F7, nie częścią importu.

## 4. Mapowanie kolumn

Pola docelowe po migracji F4-00:

| Rola | Pola wymagane | Pola opcjonalne |
|---|---|---|
| twórca (`artists`) | `name` | `handle`, `email`, `phone`, `location`, `status`, `notes` |
| kamerzysta (`videographers`) | `name` | `handle`, `email`, `phone`, `location`, `status`, `notes` |

Propozycja automatyczna: dopasowanie nagłówka po znormalizowanej formie
(małe litery, bez znaków diakrytycznych, bez spacji i znaków niealfanumerycznych)
do listy aliasów:

```
name      ← imie, imię, imię i nazwisko, nazwa, osoba, name, artysta, kamerzysta, twórca
handle    ← insta, instagram, ig, handle, profil, nick
email     ← email, mail, e-mail, kontakt
phone     ← telefon, nr telefonu, tel, phone, numer, komorka
location  ← lokalizacja, miasto, location, city, region
status    ← status, dostepnosc, uwagi o statusie
notes     ← notatki, notatka, uwagi, komentarz, notes
```

Aliasy „imię i nazwisko", „nr telefonu" i „notatka" doszły po pierwszym prawdziwym pliku
(F4-06). Po nich wszystkie kolumny prawdziwego arkusza, dla których w bazie jest
odpowiednik, dopasowują się same i nic nie trzeba przestawiać ręcznie.

Nagłówek bez dopasowania trafia jako „pomijana" i wymaga świadomego wyboru usera.
Kolumna zmapowana dwa razy do tego samego pola to błąd blokujący przejście dalej.
Obie role mają ten sam zestaw pól — od migracji `0004` (F7-45) `status` jest
dostępny także dla twórcy.

## 5. Normalizacja i walidacja wiersza (S2)

```
dla wiersza r:
  name     = trim(r.name);  pusty → BŁĄD "brak nazwy"
  handle   = trim(r.handle).toLowerCase()
             usuń prefiks "https://instagram.com/", "instagram.com/", "www."
             usuń końcowy "/"
             zapewnij dokładnie jeden wiodący "@"
             pusty po normalizacji → null
  email    = trim.toLowerCase(); niepusty i nie pasuje do wzorca → BŁĄD "zły email"
  phone    = usuń spacje, myślniki, nawiasy; "+48" i "0048" → "+48"
             9 cyfr bez prefiksu → dodaj "+48"
             wynik nie pasuje do ^\+?[0-9]{9,15}$ → BŁĄD "zły telefon"
  location = trim, pierwsza litera duża, reszta bez zmian
             synonimy: "tricity", "trojmiasto", "trójmiasto" → "Trójmiasto"
  status   = trim (dowolny tekst, bez słownika, bo dane wejściowe są opisowe)
             od F7-45 zapisywany dla obu ról
  notes    = trim
```

Duplikatów szukamy w dwóch zbiorach: wśród osób już w bazie oraz wśród wierszy
zaplanowanych do wstawienia wcześniej w tym samym pliku. Drugi zbiór doszedł w F4-06,
bo prawdziwy arkusz ma parę wierszy o tym samym handle i bez tego obie wchodziły
do bazy jako osobne osoby. Wiersz zderzony z wcześniejszym wierszem pliku jest zawsze
pomijany, nigdy aktualizowany, a podgląd podaje numer tamtego wiersza.

Wykrywanie duplikatu, w tej kolejności, zawsze w obrębie jednej tabeli:
1. `handle` niepuste i identyczne z istniejącym → duplikat pewny
2. `email` niepuste i identyczne → duplikat pewny
3. `name` identyczne po normalizacji i `location` identyczne → duplikat prawdopodobny,
   oznaczony w podglądzie osobnym kolorem i domyślnie NIE aktualizowany

Aktualizacja duplikatu nadpisuje wyłącznie pola niepuste w arkuszu. Pusta komórka
nigdy nie kasuje istniejącej wartości w bazie.

Wiersz całkowicie pusty jest pomijany bez zgłaszania błędu. Wiersz z samą nazwą
i niczym więcej jest poprawny.


## 6. Tabela zdarzeń (S3)

| Zdarzenie | Reakcja |
|---|---|
| Upuszczenie pliku na strefę zrzutu | Ramka strefy podświetlona, po upuszczeniu natychmiast walidacja rozszerzenia i rozmiaru |
| Wybór pliku innego niż `.xlsx` | Komunikat pod strefą: „Ten format nie jest obsługiwany. Wgraj plik xlsx", plik odrzucony, stan bez zmian |
| Plik > 10 MB | Komunikat z podaniem rozmiaru pliku i limitu, plik odrzucony |
| Parsowanie trwa | Przycisk w stanie zablokowanym z tekstem „Wczytuję", strefa zrzutu nieaktywna |
| Zmiana wyboru w mapowaniu | Podgląd suchego przebiegu przelicza się bez ponownego wysyłania pliku |
| Zmapowanie dwóch kolumn do jednego pola | Oba pola oznaczone, przycisk dalej zablokowany, komunikat wskazuje kolidujące kolumny |
| Klawiatura: Tab przez mapowanie | Kolejność ogniskowania zgodna z kolejnością kolumn, każdy select osiągalny, widoczna obwódka ogniskowania |
| Klik „Importuj" | Przycisk zablokowany na czas zapisu, pasek postępu z licznikiem paczek |
| Zapis nie powiódł się | Transakcja wycofana, komunikat z liczbą wierszy i treścią błędu, dane w formularzu zachowane |
| Zapis powiódł się | Podsumowanie z liczbami, link do `/artists` albo `/videographers`, przycisk „Importuj kolejny plik" |
| Brak wierszy do zaimportowania | Stan pusty: „Arkusz nie zawiera wierszy z danymi", przycisk importu niedostępny |
| Wejście na stronę bez sesji | Przekierowanie na `/login`, obsłużone przez istniejące proxy |
| Ekran węższy niż 768 px | Tabela mapowania przechodzi w listę kart, jedna kolumna na kartę, podgląd ograniczony do 5 wierszy |
| `prefers-reduced-motion` | Pasek postępu bez animacji pulsowania, tylko zmiana wartości |

## 7. Anty-spec

- Zero automatycznego importu przy samym wgraniu pliku. Suchy przebieg jest obowiązkowy.
- Zero zapisywania arkusza w repozytorium ani w katalogu `data/`. Plik żyje w pamięci
  procesu na czas importu, ewentualnie w `.data-import/` (gitignore).
- Zero domyślania się roli osoby z zawartości. Rolę wybiera user w kroku 2.
- Zero kasowania osób nieobecnych w arkuszu. Import nigdy nie usuwa.
- Zero osobnego komponentu guzika, tabeli i pola wyboru na potrzeby tego ekranu.
  Wszystko z `src/components/ui/` (zasada Z3).
- Zero paska postępu udającego postęp. Licznik pokazuje faktycznie zapisane paczki.

## 8. Kryteria wydajnościowe importu

| Metryka | Próg |
|---|---|
| Parsowanie i suchy przebieg 1 000 wierszy | < 3 000 ms |
| Zapis 1 000 nowych osób | < 5 000 ms |
| Zużycie pamięci przy pliku 10 MB | wzrost RSS < 300 MB |
