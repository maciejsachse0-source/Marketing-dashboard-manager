# 05 — System komponentów: jeden wzorzec zamiast N kopii

Problem zgłoszony przez usera wprost: „proste wzory guzików i komponentów, żeby nie
tworzyć nowych za każdym razem". Stan zmierzony: **89 surowych `<button>` przeciwko
55 użyciom `<Button>`**, przy istniejącym komponencie `src/components/ui/button.tsx`.
Czyli wzorzec istnieje i jest ignorowany w większości przypadków.

## 1. Inwentarz zastany (zmierzony w F3-01, 2026-09-02)

`src/components/ui/`: `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`,
`label`, `scroll-area`, `select`, `separator`, `sonner`, `table`, `tabs`, `textarea`.
14 komponentów, wszystkie w konwencji shadcn/ui, wariantowane przez `class-variance-authority`.

Wykorzystanie tego, co już jest (`grep -rn '<Nazwa' src --include='*.tsx' | wc -l`):

| Komponent z `ui/` | Użycia | Ręczna alternatywa w kodzie |
|---|---|---|
| `Button` | 56 | **89 surowych `<button>`** (fazy F3-02 do F3-05) |
| `Select` | 28 | 0 surowych `<select>` |
| `Textarea` | 14 | 0 surowych `<textarea>` |
| `Input` | 8 | 3 surowe `<input>` |
| `Table` | **0** | 4 surowe `<table>` |
| `Card` | **0** | 11 plików z ręcznym `rounded-xl border border-border` |
| `Badge` | **0** | pigułki składane ręcznie |

Powtarzające się wzorce spoza `ui/`, z liczbą wystąpień:

| Wzorzec | Wystąpienia | Werdykt F3-01 |
|---|---|---|
| Surowy `<button className=...>` | 89 w 7 katalogach (produkcje 32, kampanie 20, kalendarz 11, szablony 11, analityka 4, artyści 1, kamerzyści 1, pliki korzenia 9) | migracja w F3-02 do F3-05, komponent już jest |
| Mikro-etykieta sekcji `text-[10px] uppercase tracking-[0.1x]` | 90 wystąpień w 5 niemal identycznych wariantach (różnią się tylko grubością pisma) | wzorzec typograficzny, nie komponent; issue **F7-15** |
| Stan pusty | `EmptyState` w `src/components/empty-state.tsx`, 6 użyć | **nie brakuje**, reguła 2 z sekcji 2: komponent poza `ui/` też się liczy |
| Stan ładowania guzika | ręcznie: podmiana napisu (`{pending ? 'Usuwam…' : …}`) w 4 miejscach, `Loader2` z `animate-spin` w 1 | **dobudowane** jako `loading` w `ui/button.tsx` (F3-01) |
| Potwierdzenie destrukcyjnej akcji | natywny `confirm()` w 12 plikach, 16 wywołań | zostaje natywny; platforma robi to bez kodu, nie ma powodu na własny modal |
| Pole wyboru daty | `<input type="date">` 4 razy: 2 przez `ui/input`, 2 surowo | brak nowego komponentu; wystarczy `Input`, doprowadzenie w F3-05 |
| Pasek narzędzi widoku | brak powtarzalnego kształtu: `gantt-toolbar` i paski w kampaniach mają inną zawartość i inny układ | wzorzec jednorazowy per widok, zostaje lokalnie |
| Sekcja formularza z nagłówkiem | brak powtarzalnego kształtu poza mikro-etykietą wyżej | zostaje lokalnie |
| Skorupa strony | `PageShell` w `src/components/page-shell.tsx`, 22 użycia | jest, działa |
| Przejście interakcji | klasa `.ui-transition` z `globals.css`, 66 użyć w 26 plikach | jest, działa |

Wniosek F3-01: **nie ma komponentu, którego brak i który wystąpiłby w co najmniej
dwóch miejscach**. Lista „czego brakuje" z pierwszej wersji tego dokumentu okazała się
w pięciu punktach na sześć nietrafiona: stan pusty i skorupa strony już istnieją,
potwierdzenie destrukcyjne robi platforma, pole daty robi `Input`, a pasek narzędzi
i sekcja formularza nie mają powtarzalnego kształtu. Jedyna faktyczna dziura,
stan pracy guzika, została zamknięta w samym `Button`, nie nowym plikiem.

## 2. Reguła nadrzędna

Zanim napiszesz JAKIKOLWIEK nowy element interfejsu, w tej kolejności:

1. Czy jest w `src/components/ui/`? Użyj.
2. Czy jest w `src/components/` poza `ui/` i da się go użyć bez modyfikacji? Użyj.
3. Czy różni się od istniejącego tylko wyglądem? Dodaj **wariant** do istniejącego
   komponentu, nie nowy plik.
4. Czy różni się zachowaniem i wystąpi w co najmniej dwóch miejscach? Dopiero teraz
   nowy komponent w `src/components/ui/`, z wariantami CVA i wpisem w tym pliku.
5. Wystąpi w jednym miejscu i nigdzie indziej? Zostaw go lokalnie w pliku strony,
   bez wynoszenia do `ui/`. Przedwczesne uogólnienie jest tak samo złe jak duplikat.

## 3. Katalog wariantów guzika (stan faktyczny z `src/components/ui/button.tsx`)

Komponent opakowuje `Button` z Base UI i wariantuje przez CVA. Katalog jest zamknięty:
nowy wariant wymaga dopisania wiersza do tej tabeli w tym samym commicie.

| `variant` | Kiedy | Przykład |
|---|---|---|
| `default` | główna akcja ekranu, maksymalnie jedna na widok | „Zapisz produkcję" |
| `secondary` | akcja towarzysząca | „Anuluj", „Wróć" |
| `outline` | akcja w pasku narzędzi, filtr, przełącznik widoku | „Widok tabeli" |
| `ghost` | akcja w wierszu tabeli i w nagłówkach | ikona edycji |
| `destructive` | usunięcie, wymaga potwierdzenia | „Usuń kampanię" |
| `link` | nawigacja wyglądająca jak tekst | „Pokaż szczegóły" |

Rozmiary, z faktycznymi wysokościami z klas Tailwind (nie zmyślaj innych):

| `size` | Klasa wysokości | Wysokość | Kiedy |
|---|---|---|---|
| `xs` | `h-6` | 24 px | gęste paski narzędzi, pigułki filtrów |
| `sm` | `h-7` | 28 px | wnętrze tabeli |
| `default` | `h-8` | 32 px | formularze, treść strony |
| `lg` | `h-9` | 36 px | pojedyncza akcja główna |
| `icon` | `size-8` | 32 × 32 px | wyłącznie ikona |
| `icon-xs` | `size-6` | 24 × 24 px | ikona w gęstym pasku |
| `icon-sm` | `size-7` | 28 × 28 px | ikona w wierszu tabeli |
| `icon-lg` | `size-9` | 36 × 36 px | ikona jako akcja główna |

Guzik bez widocznego tekstu bez `aria-label` jest błędem dostępności i nie przechodzi
przeglądu. Rozmiary `xs`, `sm`, `icon-xs`, `icon-sm` są mniejsze niż zalecane 44 px
obszaru dotyku, więc na ekranach dotykowych wymagają wypełnienia zewnętrznego wokół
elementu; sprawdzane w F6-01.

## 4. Tabela zdarzeń dla wzorca guzika (S3)

Kolumna „stan dziś" mówi, co komponent już robi, a co trzeba dobudować. Bez tego
kryteria akceptacji wymagałyby zachowania, którego nikt nie planuje zbudować.

| Zdarzenie | Reakcja | Stan dziś |
|---|---|---|
| Najechanie kursorem | Zmiana tła zgodna z wariantem, przejście przez `transition-all` | jest |
| Naciśnięcie | Przesunięcie o 1 px w dół (`active:translate-y-px`), bez przesunięcia układu | jest |
| Ogniskowanie klawiaturą | Obwódka: `focus-visible:border-ring` plus pierścień `ring-3` | jest |
| Enter i Spacja przy ogniskowaniu | To samo co kliknięcie (obsługa Base UI) | jest |
| Stan zablokowany | Krycie 0.5, brak reakcji na wskaźnik (`disabled:pointer-events-none`) | jest |
| Wejście niepoprawne | `aria-invalid` zmienia obramowanie i pierścień na destrukcyjne | jest |
| **Stan pracy (`loading`)** | Ikona wirująca przed tekstem, tekst zachowany, guzik zablokowany, `aria-busy="true"` | **jest** (F3-01). Szerokość rośnie o ikonę i odstęp; blokowanie szerokości wymagałoby ukrycia tekstu albo pomiaru, uzasadnienie w `DECISIONS.md` |
| Ekran dotykowy | Obszar dotyku co najmniej 44 × 44 px, uzyskiwany wypełnieniem wokół guzika przy rozmiarach poniżej 36 px | do sprawdzenia w F6-01 |
| `prefers-reduced-motion` | Brak przejścia tła i brak wirowania, zmiana stanu natychmiastowa | **jest**: regułą globalną w `globals.css` (`transition-duration: 1ms !important` dla `*`) plus `motion-reduce:animate-none` na wirującej ikonie. Zmierzone w przeglądarce: przejście 0,001 s, `animation-name: none` |

## 5. Anty-spec

- Zero `<button className="...">` w kodzie stron i komponentów funkcjonalnych.
- Zero `<div onClick>` i `<span onClick>` jako akcji.
- Zero `<a>` stylowanego na guzik. Nawigacja to `Link`, akcja to `Button`.
- Zero nowego pliku typu `PrimaryButton.tsx`, `SmallButton.tsx`, `IconButton.tsx`.
  To są warianty, nie komponenty.
- Zero kolorów spoza tokenów w klasach guzika (zasada Z4).
- Zero emoji jako ikony (zasada Z5). Ikony wyłącznie `lucide-react`.
- Zero guzika, którego jedyną treścią jest znak interpunkcyjny.

## 6. Sposób egzekwowania

Reguła lintu w `eslint.config.mjs`:

```
'no-restricted-syntax': ['error', {
  selector: 'JSXOpeningElement[name.name="button"]',
  message: 'Uzyj <Button> z @/components/ui/button. Brakuje wariantu? Dodaj wariant, nie nowy komponent.',
}]
```

Włączana z listą wyjątków na pliki zastane (`eslint-disable` z komentarzem i numerem
issue z fazy F3), lista kurczy się w każdej fazie do zera. Licznik surowych guzików
jest metryką raportowaną w każdym raporcie fazy: „89 → N".
