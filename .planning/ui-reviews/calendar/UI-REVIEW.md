# /calendar — UI Review (Pipeline / Gantt)

**Audited:** 2026-04-29
**Baseline:** Brak UI-SPEC.md → audyt względem abstrakcyjnych standardów + briefu usera
**Screenshots:** desktop fullpage (1440×900), 1920×1080, 2400×1200 — `.planning/ui-reviews/calendar/screenshots-20260429-200220/`
**Reviewer:** GSD UI auditor

---

## TL;DR

Strona robi za dużo naraz. Każdy wiersz produkcji to **pięć równoległych warstw informacji** (legenda → header tygodnia → bandy T1/T2/T3 z chipami pinów → milestone tick + label + data + tag → sub-bar 9 kółek z drzewkiem) i **trzy konkurujące palety akcentu** (amber/violet/emerald frames vs. niebieski progress fill + active step vs. czerwony today). Skala typografii to **9 różnych pikseli** (7,8,9,10,11,11.5,12,12.5,13) na jednym wierszu. Najpilniejsze: zredukować redundancję dat (te same dane w 4 miejscach), ujednolicić skalę typografii do 3 rozmiarów i zmiękczyć siłę bandów T1/T2/T3 by przestały przykrywać warstwy poniżej.

## Pillar Scores

| Pillar | Score | Key Finding |
|---|---|---|
| 1. Copywriting | 3/4 | "domyślna pozycja — ustaw datę" / "ustaw datę" / "brak daty — ustaw na produkcji" — trzy warianty tej samej instrukcji |
| 2. Visuals | 2/4 | Brak hierarchii: 5 warstw konkuruje o uwagę, czerwony "today" gubi się w amber bandach |
| 3. Color | 1/4 | 4 kolory akcentu (amber/violet/emerald + niebieski progress) na jednej osi czasu + dodatkowo czerwony today + rose anulowane |
| 4. Typography | 1/4 | 9 rozmiarów pikseli (7-13 px), 4 letter-spacings (0.1, 0.12, 0.14, 0.16, 0.18, 0.2 em) |
| 5. Spacing | 3/4 | Klasy spójne, jedyne arbitrary values to absolutne pozycje (TRACK_TOP itd. — uzasadnione) |
| 6. Experience Design | 3/4 | Optimistic UI, hover cards, expand/collapse — solidnie. Brak loading state na cascade |

**Overall: 13/24** — obniżamy głównie za color noise + typography sprawl.

---

## Top 5 Konkretnych Problemów

### 1. (HIGH) Redundancja dat — ta sama informacja w 3-4 miejscach

**Co:**
Data dla tej samej akcji (np. "nagrywka 14.05") może pojawić się jednocześnie w:
- pinie chipu na bandzie T2 (numerowany kółkowy chip + hover card z `dateLabel`)
- pod milestone tickiem ("śr 14.05 · 16:00") — `gantt-view.tsx:1490-1517`
- w "Następny krok" cardzie po lewej (`nextStep.cat.label` — pośrednio)
- w pierwszej linii nagłówka strony jako kontekst

**Pliki:**
- `src/components/calendar/gantt-view.tsx:1450-1539` — milestone label block (weekday + day.month + time + sourceHint badge)
- `src/components/calendar/gantt-view.tsx:961-1032` — stagePins z tooltipem
- `src/components/calendar/gantt-view.tsx:1519-1536` — `T-0` / `auto` source hint badge

**Dlaczego źle:**
Użytkownik nie wie gdzie "kanonicznie" siedzi data — czyta to samo trzy razy i mózg zaczyna szukać różnic ("czy te dwie daty się zgadzają?"). Dodatkowy `T-0`/`auto` badge pod milestone powtarza informację już wyrażoną pozycją na pasku T3 (a "auto: dzień po nagrywce" to **trzeci** raz to samo: pozycja w T2, label czasu, badge tag).

**Jak naprawić:**

**Krok A** — Wybrać jednego "canonicznego nosiciela daty" per krok. Rekomendacja: **chip pin na bandzie** trzyma dokładną datę (jest najbliżej kalendarza), milestone label trzyma TYLKO label kategorii.

W `gantt-view.tsx:1485-1518` zredukować label do samego nazwiska kategorii + ewentualnie wskaźnik "set/unset":

```tsx
// PRZED (1485-1518):
{tentative ? (
  <div className="text-[10px] italic text-muted-foreground/60 text-center mt-0.5 leading-tight">
    ustaw datę
  </div>
) : (
  <div className="mt-0.5 flex items-baseline justify-center gap-1 leading-tight">
    <span className="text-[9px] uppercase tracking-[0.16em] ...">{weekday}</span>
    <span className="text-[11px] tabular-nums font-semibold">{dayMonth}</span>
    {time ? <span className="text-[10px] ...">· {time}</span> : null}
  </div>
)}

// PO — usunąć cały blok daty pod milestone, zostawić tylko label + (opcjonalnie) ikonkę "data ustawiona":
{tentative ? null : null /* wszystkie daty żyją na pinach na bandzie */}
```

**Krok B** — Usunąć całkowicie `sourceHint` badge `T-0`/`auto` (1519-1536). T-0 jest oczywiste z pozycji "Publikacja na początku T3", a `auto` można zakomunikować raz w legendzie ("Obróbka = dzień po nagrywce").

**Oszczędność:** ~50 linii JSX, ~3-4rem pionu na każdym wierszu, poziom hałasu ↓ ~30%.

---

### 2. (HIGH) Konflikt palet akcentu — 4 niezależne kolory walczą o uwagę

**Co:**
Na jednym wierszu produkcji jednocześnie żyją:
- **Amber/Violet/Emerald** — 3 ramki bandów T1/T2/T3 + ich pochodne (chipy pinów, milestone tick gdy passed, step circle border, `NextStepIndicator` rail+dot+ink)
- **Niebieski** (`var(--accent-blue)`) — progress fill na obu trackach (milestone + sub-bar) + tekst label "passed" milestonów
- **Czerwony różowy** (`bg-rose-500/80`) — "today" pionowa linia
- **Czarny** (`bg-foreground`) — active step circle + active milestone tick

**Pliki/linie:**
- `src/components/calendar/gantt-view.tsx:178-209` — `FRAME_TONE` definicja (3 palety)
- `src/components/calendar/gantt-view.tsx:1129-1134` — `bg-rose-500/80` today line
- `src/components/calendar/gantt-view.tsx:1374` / `1732` — niebieski gradient na progress fill
- `src/components/calendar/gantt-view.tsx:1417, 1478, 1505` — `text-[var(--accent-blue)]` na passed milestone tick
- `src/components/calendar/gantt-view.tsx:1222-1226` — `frameAccent` w NextStepIndicator (jeszcze raz amber/violet/emerald)
- `src/lib/category-colors.ts:50-82` — `FRAME_STYLE` (ten sam zestaw, ale w innym pliku → łatwo zdrejfować)

**Dlaczego źle:**
- Czerwona linia "today" — semantycznie najważniejsza (gdzie jestem TERAZ?) — ginie wizualnie pod warstwą amber/violet/emerald bandów (zwłaszcza amber przez niski kontrast).
- Niebieski progress fill na tracku konkuruje z trzema bandami nad nim — i nagle "passed" milestone tick w niebieskim też nie pasuje do amber/violet/emerald frame'u w którym siedzi.
- `NextStepIndicator` po lewej (poza canvasem ganttu) **też** nosi te same trzy frame colors → użytkownik myśli "to jest jeszcze raz cały gantt".

**Jak naprawić:**

**Krok A** — Zredukować bandy T1/T2/T3 do **delikatnego tła + headline label**, nie do dominującej ramki:

```tsx
// gantt-view.tsx:178-209 — FRAME_TONE
T1: {
  bg: 'bg-amber-100/40',          // PRZED: bg-amber-200/70 — za mocne
  border: 'border-amber-300/40',  // PRZED: border-amber-500/70 — pełna ramka kradnie uwagę
  ink: 'text-amber-900/70',
  // ...
},
// (analogicznie T2, T3)
```

I w `gantt-view.tsx:943` zamienić `border-2` na `border` lub całkowicie usunąć ramkę:

```tsx
// PRZED:
className={`absolute top-0 bottom-0 ${tone.bg} pointer-events-none border-2 ${tone.border} rounded-md`}
// PO:
className={`absolute top-0 bottom-0 ${tone.bg} pointer-events-none border-l border-r ${tone.border}`}
```

**Krok B** — Today line musi być nie do przegapienia:

```tsx
// gantt-view.tsx:1130 — PRZED:
className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 pointer-events-none z-[5]"

// PO — pełny rose, pełna grubość, plus chip "TERAZ" na górze:
className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none z-[15] shadow-[0_0_8px_rgba(244,63,94,0.4)]"
// + opcjonalnie nad headerem: <span className="absolute top-0 -translate-x-1/2 px-1 py-0.5 rounded bg-rose-500 text-white text-[9px]">TERAZ</span>
```

**Krok C** — Zdecydować: **ALBO** progress fill jest niebieski (and rest of accents go quiet) **ALBO** używamy frame colors na progress (każdy segment = inny kolor). Mieszanka jest najgorsza.
Rekomendacja: zostać przy niebieskim ale na milestone tick `passed` używać `bg-foreground` (czarny check) zamiast `bg-[var(--accent-blue)]` — zmniejszy to ilość niebieskiego do jednej spójnej linii progresu.

**W `gantt-view.tsx:1417`:**
```tsx
// PRZED:
state === 'passed' ? 'w-6 h-6 bg-[var(--accent-blue)] text-white hover:scale-110' :
// PO:
state === 'passed' ? 'w-6 h-6 bg-foreground text-background hover:scale-110' :
```

---

### 3. (HIGH) Eksplozja skali typografii — 9 rozmiarów pikseli na jednej stronie

**Co:**
W `gantt-view.tsx` policzone arbitralne rozmiary fontu:
- `text-[7px]` (1× — out-of-window indicator step circle, linia 1801)
- `text-[8px]` (2× — out-of-window milestone, source hint badge)
- `text-[9px]` (3× — eyebrow w NextStepIndicator, weekday w milestone label)
- `text-[10px]` (12× — UPPERCASE eyebrows, dayMonth fallback)
- `text-[10.5px]` — w innym pliku
- `text-[11px]` (12× — pin number, today, anulowane, milestone day)
- `text-[11.5px]` — pin description italic
- `text-[12px]` (0× w gantt, ale używane w toolbar)
- `text-[12.5px]` (1× — nextStep label)

A do tego standardowe `text-xs/sm/base`. **Razem ≈ 13+ wariantów rozmiarów**.

**Dodatkowo letter-spacing skalę** (linie z grep):
- `tracking-[0.1em]` (label kategorii)
- `tracking-[0.12em]` (sourceHint, badge w toolbar)
- `tracking-[0.14em]` (eyebrows wszędzie)
- `tracking-[0.16em]` (weekday + ustalenia label)
- `tracking-[0.18em]` (frame badge T1/T2/T3 w expanded)
- `tracking-[0.2em]` (band corner code, anulowane)

**Pliki:**
- `src/components/calendar/gantt-view.tsx` — 34 wystąpień `text-[Npx]`
- Wszystkie linie wymienione w grep'ie powyżej

**Dlaczego źle:**
- Brak hierarchii: gdy istnieje 9 rozmiarów, nie ma "wagi" rozmiaru — wszystko jest tak samo "ważne" (lub nieważne).
- Tailwind v4 + Turbopack rebuild dłużej szuka tych arbitrary values niż klas teoretycznych.
- Maintenance: jeden FE designer doda `text-[11.7px]` "bo wygląda lepiej" i już jest 10. Nie ma kanonu.

**Jak naprawić:**

**Krok A** — Zredukować do **3 rozmiarów na ganttcie**:
- **Eyebrow / kapitaliki**: `text-[10px]` (zamiast 8/9/10) → wystarczy do "TYDZ. 22" / "OUTREACH" / "Krok 5/9"
- **Tabular nums (numbers)**: `text-[11px]` (zamiast 10/10.5/11/11.5/12.5) → numery kółek, daty, "5 produkcji"
- **Body / labels**: `text-sm` (14px) → label "Anna Test", "Następny krok" treść, opisy

**Krok B** — Zredukować letter-spacing do **2 wartości**:
- `tracking-[0.14em]` — dla wszystkich UPPERCASE eyebrow
- `tracking-[0.2em]` — dla "T1/T2/T3" badge'ów (mocniejszy "stempel" feel)

Usunąć resztę. Praktycznie: globalny find+replace w `gantt-view.tsx`:
```
tracking-[0.10em] → tracking-[0.14em]
tracking-[0.12em] → tracking-[0.14em]
tracking-[0.16em] → tracking-[0.14em]
tracking-[0.18em] → tracking-[0.2em]
```

**Krok C** — Konkretne podmiany w `gantt-view.tsx`:
- Linia 991, 1005, 1239, 1787 (pin/step circle numbers): `text-[11px]` → `text-xs` (12px) — bardziej czytelne na 7×7 px kółku
- Linia 1252 (`text-[12.5px]` next step label) → `text-sm font-semibold` (14px, dłuższe linie OK bo `truncate`)
- Linia 1801 (`text-[7px]` out-of-window) → `text-[9px]` minimum, lepiej zastąpić małą strzałką lucide `ChevronLeft className="w-2 h-2"`

**Oszczędność:** czytelność ↑, build size ↓ (mniej arbitrary CSS), maintenance ↓.

---

### 4. (MEDIUM) Legenda u góry tabeli powtarza warstwy które są oczywiste z UI

**Co:**
Na samej górze (`gantt-view.tsx:371-379`) jest pasek legendy:
- T1 / T2 / T3 z label'em "Outreach + ustalenia" / "Nagrywka + obróbka" / "Publikacja"
- Po prawej: "data zapisana" (solid dot) / "domyślna pozycja — ustaw datę" (dashed dot)

**Dlaczego źle:**
- **Label T1/T2/T3** już są wypisane wewnątrz każdej bandy ("Outreach + ustalenia" jako badge `T1` + corner tag) i w expanded view i w `NextStepIndicator`. Dochodzi do **5-krotnego** powtórzenia tej samej taksonomii.
- **"data zapisana / domyślna pozycja"** jest legendą do różnicy *solid vs dashed border na milestone tick* — ale po Phase 5 **piny na bandzie i tak nie używają dashed** (tylko milestone ticki), więc legenda mówi o niewielkim dialekcie ikon.
- Pasek zabiera ~50 px na górze i sam w sobie nie ma "TERAZ jest tu →" — po prostu opisuje resztę.

**Pliki:**
- `src/components/calendar/gantt-view.tsx:370-379` — cały `<div>` legendy
- `src/components/calendar/gantt-view.tsx:2038-2062` — komponenty `LegendChip`, `LegendDot`

**Jak naprawić:**

**Opcja A (rekomendowana)** — Skasować całą legendę. Zamiast tego zrobić jednorazowy onboarding (popover na pierwszej wizycie) lub link "?" z modalem.

```tsx
// gantt-view.tsx:370-379 — usunąć cały blok <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 border-b ...">
```

**Opcja B (kompromis)** — Przenieść legendę na sam dół tabeli (jako footnote `text-xs text-muted-foreground` w jednej linii) i skondensować:

```tsx
<div className="px-5 py-2 border-t border-border/40 text-xs text-muted-foreground">
  T1 outreach · T2 nagrywka + obróbka · T3 publikacja —
  <span className="ml-1 italic">kółko z przerywaną ramką = brak daty, ustaw na produkcji</span>
</div>
```

**Opcja C** — Jeśli zostawiamy legendę u góry, **zredukować do jednej linii** z mniejszym padding:
- Z `px-5 py-3` na `px-5 py-1.5`
- Zamiast 3 chipów + 2 dotów: `T1 / T2 / T3 — outreach → nagrywka → publikacja`

---

### 5. (MEDIUM) "Tree-pattern guides" (drzewko) konkurują wizualnie z trackiem progresu

**Co:**
Pod każdą bandą rysowane są (`gantt-view.tsx:1040-1113`):
- **Solid trunk** — pionowa linia od milestone tick aż do step circle (kolor amber/violet/emerald)
- **Dashed branches** — pionowy "ząb" z każdego non-end step circle + dashed horizontal connector do trunku

To plus:
- Solid track milestone bar (`gantt-view.tsx:1361-1365`) — szary bg + niebieski progress fill na wysokości `7.5rem`
- Solid track sub-bar (`gantt-view.tsx:1718-1735`) — szary bg + niebieski progress fill na wysokości `13.5rem`

**Dlaczego źle:**
- 4 rodzaje linii (solid color trunk, dashed branches, solid grey track, blue progress) na małej przestrzeni (5rem między track 1 a track 2). Mózg musi je rozparsować w realnym czasie.
- Drzewko ma **dydaktyczną** wartość ("step 5 należy do milestone 'Ustalenia'") ale kosztuje sporą ilość pionowego whitespace + dashed lines = noise.
- Zauważalnie w screenshotach wiersza Anna Test trzecia produkcja (z ~9 stepami) — dashed lines pokrywają niemal całą wysokość rzędu.

**Pliki:**
- `src/components/calendar/gantt-view.tsx:1040-1113` — całe drzewko
- `src/components/calendar/gantt-view.tsx:1057-1060` — wartości pozycji TRUNK_TOP/JUNCTION_Y/JUNCTION_TO_SUB_HEIGHT

**Jak naprawić:**

**Krok A** — Zostawić tylko **solid trunk** dla end-step kategorii. Skasować **dashed branches** całkowicie:

```tsx
// gantt-view.tsx:1078-1110 — usunąć cały blok ".filter((s) => s !== endStep).map(...)" — dashed branches
// Zostawić tylko trunk (1064-1073).
```

Przynależność step→milestone wystarczająco komunikuje:
- **Pozycja** kółka pod milestone'em (uniform distribution w bandzie)
- **Border color** kółka (amber/violet/emerald = T1/T2/T3)
- **Hover tooltip** który mówi "Krok 5 (Ustalenia + scenariusz)"

**Krok B** — Jeśli drzewko zostaje, zmiękczyć dashed do `opacity-30` (`border-amber-400/30` itp.) by stało się subtelnym sufitem grupy a nie głównym elementem.

```tsx
// gantt-view.tsx:1046-1051:
const colourBorder =
  cat.frame === 'T1'
    ? 'border-amber-400/30'   // PRZED: /80
    : cat.frame === 'T2'
      ? 'border-violet-400/30'
      : 'border-emerald-400/30';
```

**Oszczędność:** ~80% wizualnego "noise" pod milestone bar, czytelność progresu ↑.

---

## Quick Wins (każdy < 10 linii kodu, do wdrożenia w 1 PRze)

### QW1 — Usuń `T-0`/`auto` source-hint badge

**Plik:** `src/components/calendar/gantt-view.tsx:1519-1536`
**Zmiana:** Usuń cały blok `{sourceHint && !tentative ? (...) : null}`. Pozycja "Publikacja na początku T3" + "Obróbka uniformly = dzień po nagrywce" są oczywiste z layoutu.

### QW2 — Skasuj legendę "data zapisana / domyślna pozycja"

**Plik:** `src/components/calendar/gantt-view.tsx:375-378`
**Zmiana:**
```tsx
// PRZED:
<span className="ml-auto inline-flex items-center gap-4 text-xs text-muted-foreground">
  <LegendDot variant="solid" label="data zapisana" />
  <LegendDot variant="dashed" label="domyślna pozycja — ustaw datę" />
</span>

// PO — usunąć cały <span> (3 linie). Dashed border kółka komunikuje to samo bez legendy.
```

### QW3 — Wzmocnij linię "today"

**Plik:** `src/components/calendar/gantt-view.tsx:1129-1133`
**Zmiana:**
```tsx
// PRZED:
<div
  className="absolute top-0 bottom-0 w-0.5 bg-rose-500/80 pointer-events-none z-[5]"
  style={{ left: `calc(${(todayIdx + 0.5) * dayWidthPct}% - 1px)` }}
  aria-hidden
/>
// PO — z-index ↑, glow:
<div
  className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none z-[15]"
  style={{
    left: `calc(${(todayIdx + 0.5) * dayWidthPct}% - 0.5px)`,
    boxShadow: '0 0 6px rgba(244,63,94,0.5)',
  }}
  aria-hidden
/>
```

### QW4 — Zmiękcz ramki bandów T1/T2/T3

**Plik:** `src/components/calendar/gantt-view.tsx:178-209`
**Zmiana:** Zmniejsz opacity tła i ramki w `FRAME_TONE`:
```tsx
T1: { bg: 'bg-amber-100/40', border: 'border-amber-300/40', /* reszta bez zmian */ },
T2: { bg: 'bg-violet-100/40', border: 'border-violet-300/40', /* */ },
T3: { bg: 'bg-emerald-100/40', border: 'border-emerald-300/40', /* */ },
```
+ w linii 943 zamień `border-2` na `border` (i ewentualnie skasuj `rounded-md` żeby tła płynnie sąsiadowały).

### QW5 — Usuń dashed branches w drzewku, zostaw tylko trunk

**Plik:** `src/components/calendar/gantt-view.tsx:1078-1110`
**Zmiana:** Usuń cały blok `inCat.filter((s) => s !== endStep).map(...)` (~32 linie). Zostawić tylko `Trunk` (1064-1073). Już teraz `border color` step circle (`accentBorder` w SubStepBar) komunikuje przynależność do kategorii T1/T2/T3.

---

## Dodatkowe obserwacje (Low priority)

- **`gantt-view.tsx:1141`** — chip "anulowane" po środku canvasu wiersza — ok, ale wystarczyłoby dodać `border` czy lekki shadow żeby się oderwał od bandów (`bg-rose-100/80` ginie na `bg-amber-200/70`).
- **`gantt-view.tsx:1798-1805`** — out-of-window indicator (małe `‹`/`›` na step circle) ma `text-[7px]` — niemożliwe do przeczytania. Lepiej dać `lucide` `<ChevronLeft className="w-2 h-2"/>`.
- **`gantt-view.tsx:1185-1265`** — `NextStepIndicator` po lewej jest dobrze zaprojektowany ALE w trybie `cancelled` używa `border-rose-200 bg-rose-50/70` i tekst `Anulowane`, podczas gdy chip "anulowane" na canvasie używa `bg-rose-100/80 text-rose-700`. Spójność w odcieniach (bg-50/text-700 vs bg-100/text-700) — wybrać jeden.
- **`gantt-view.tsx:386, 406, 439`** — header tygodnia używa `text-xs uppercase tracking-[0.14em]` i `text-[10px] uppercase tracking-[0.14em]` w sąsiednich blokach — spróbować ujednolicić do jednego `text-[10px]`.
- **`gantt-view.tsx:889`** — w lewej kolumnie wiersz `text-[11px]` z badgem typu produkcji + "kam: ..." — to jest dobrze zaproważone i NIC tu nie ruszać.

---

## Rekomendacja — kolejność wdrażania

1. **QW1 + QW2 + QW3** (15 minut) → natychmiastowy zysk czytelności bez zmiany struktury.
2. **Problem #4 (legenda)** opcja A albo C → -50px pionu + redukcja powtórzeń T1/T2/T3.
3. **Problem #1 (data dedup)** → wybór "canonicznego nosiciela daty" (rekomendacja: piny) i okrojenie milestone label do samej nazwy + skrót `weekday day.month`.
4. **QW4 + QW5** + Problem #2 (kolory) → final cleanup. Tu dotyka się najwięcej miejsc — wymaga dłuższej iteracji + feedback od usera.
5. **Problem #3 (typography)** → najlepiej globalny refactor po pkt 1-4 (wtedy widać które rozmiary naprawdę są używane vs leftovers).

---

## Files Audited

- `src/app/calendar/page.tsx` (300 linii) — orchestracja + filter logic
- `src/components/calendar/gantt-view.tsx` (~2050 linii) — główny renderer pipeline'u
- `src/components/calendar/gantt-toolbar.tsx` (281 linii) — top toolbar (zoom, filter, sort, "Nowa produkcja")
- `src/components/calendar/type-color.ts` (118 linii) — color tables (calendar entry types — używane w innym widoku, nie ganttcie)
- `src/lib/category-colors.ts` (84 linie) — `FRAME_STYLE` (T1/T2/T3 design tokens)
- `src/components/page-shell.tsx` (49 linii) — wrapper layoutu
- `src/app/globals.css` (333 linie) — design tokens, animacje, blob

## Screenshots

`.planning/ui-reviews/calendar/screenshots-20260429-200220/`:
- `desktop-fullpage.png` (1440×900, full page)
- `desktop-1920.png` (1920×1080)
- `desktop-2400.png` (2400×1200, kontekst pełen 5 weeks zoom)
