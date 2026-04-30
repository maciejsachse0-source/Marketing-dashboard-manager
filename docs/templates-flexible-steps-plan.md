# Plan: szablony z w pełni elastycznymi krokami

## Cel

Pozbyć się sztywnego enum-u 9 kanonicznych statusów (`PRODUCTION_PROGRESSION`)
i pozwolić, by **każdy szablon definiował swój własny zestaw kroków** — z
dowolnymi etykietami, opisami, kolejnością. Po zaaplikowaniu szablonu produkcja
dostaje pełną listę kroków skopiowaną z szablonu (każdy krok ma swój `id`,
`category`, `label`, `done`, daty, załączniki itd.). Brak kroków „kanonicznych"
zaszytych w schemacie.

Zachowujemy:
- 5 kategorii (`outreach`, `ustalenia`, `nagrywanie`, `obrobka`, `publikacja`) —
  są używane do bucketingu w gantcie/kalendarzu i mają sens domenowy. Kroki
  pozostają w jednej z tych kategorii.
- Status `cancelled` — jako osobny boolean/timestamp `cancelledAt`, nie jako
  jeden ze stanów listy kroków.
- Pojęcie „aktywnego kroku" produkcji (do podglądu w listach, statystykach) —
  ale liczone z listy kroków, nie z enum-a.

Na końcu — **pełna swoboda w edytorze szablonu**: dodawanie, usuwanie,
zmiana etykiety i opisu KAŻDEGO kroku (bez podziału na kanoniczny/dodatkowy).

---

## Nowy model danych

### Templaty (`data/templates/<slug>.json`)

```ts
type TemplateStep = {
  id: string;                  // stabilne id w obrębie szablonu (slug-like, np. "outreach-email")
  category: ProductionStage;   // outreach | ustalenia | nagrywanie | obrobka | publikacja
  label: string;
  description?: string;
  /** Kontrola wpływu na kalendarz — patrz niżej, sekcja Kalendarz. */
  dateMode?: 'none' | 'record' | 'calendar' | 'derived-from-shooting';
  /** Domyślny czas trwania w kalendarzu w minutach (gdy dateMode === 'calendar'). */
  durationMinutes?: number;
  /** Domyślny typ wpisu kalendarza (gdy dateMode === 'calendar'). */
  calendarType?: 'shoot' | 'edit' | 'meeting' | 'deadline';
  /** Opcjonalny tag „to jest moment T-0" — gdy true, gantt traktuje ten krok
   *  jako oś czasu. Dokładnie 0 lub 1 krok per szablon. */
  isT0Anchor?: boolean;
};

type ProductionTemplate = {
  slug: string;
  name: string;
  type: 'with-artist' | 'solo';
  summary: string;
  description: string;
  steps: TemplateStep[];   // <-- jedna płaska lista, nie ma już customSteps
};
```

### Produkcje (`productions` w bazie)

```ts
type ProductionStep = {
  id: string;
  category: ProductionStage;
  label: string;
  description?: string;
  doneAt: string | null;
  dateIso?: string;          // gdy dateMode = record/calendar/derived-from-shooting
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
  // Statyczna konfiguracja skopiowana z szablonu — żeby produkcja była
  // niezależna od późniejszych edycji szablonu:
  dateMode?: TemplateStep['dateMode'];
  durationMinutes?: number;
  calendarType?: TemplateStep['calendarType'];
  isT0Anchor?: boolean;
};

// Kolumny `productions` (zmiany):
{
  // USUNIĘTE:
  //   status: ProductionStatus;        -- enum 9-stanowy znika
  //   stepDates: Record<status, iso>;  -- daty są teraz w step.dateIso
  //   customSteps: Record<cat, CustomStep[]>;  -- zlewa się z steps
  //   stepOrder: Record<cat, string[]>;        -- kolejność jest implicit (kolejność w array)

  // DODANE:
  steps: ProductionStep[];          // pełna sekwencja kroków produkcji, w kolejności
  cancelledAt: number | null;       // timestamp_ms; null gdy aktywna
}
```

Lista `steps` jest **uporządkowana** — kolejność w array określa kolejność
w pipeline (kategorie idą blokami; w obrębie kategorii kolejność jest też
zachowana). Strzałki ↑/↓ przesuwają wpis tylko w obrębie tej samej kategorii
(żeby nie wymieszać outreach z publikacją).

### Migracja istniejących danych

Jednorazowy skrypt SQL + TS migration (`drizzle/migrations/0011_flexible_steps.sql`
+ `scripts/migrate-flexible-steps.ts`):

1. Dodaje kolumny `steps` (TEXT JSON) i `cancelled_at` (INTEGER nullable).
2. Dla każdej istniejącej produkcji:
   - Buduje listę `steps[]` w kolejności:
     a) iteracja po `PRODUCTION_STAGES` (5 kategorii),
     b) w każdej — `resolveCategorySequence(cat, customSteps[cat], stepOrder[cat])`,
     c) kanoniczny → `{ id: '<status>', category, label: STAGE_LABEL[status], doneAt, dateIso, dateMode, durationMinutes, calendarType, isT0Anchor }`,
     d) custom → `{ id: existingId, category, label, description, doneAt, attachmentPath/Name/Size, dateMode: 'none' }`.
   - `doneAt` dla kanonicznego liczone z `PRODUCTION_PROGRESSION.indexOf(status) > stage.index`.
   - `dateIso` dla kanonicznego = `production.stepDates[status]`.
   - `dateMode` przypisywane wg starej tabeli `CALENDAR_STAGES` z `production-step-dates.ts`.
   - Krok `shooting` → `dateMode: 'calendar', isT0Anchor: true`.
   - Krok `editing` → `dateMode: 'derived-from-shooting'`.
   - Outreach steps → `dateMode: 'record'`.
3. `cancelledAt = production.status === 'cancelled' ? production.createdAt : null`.
4. Po zweryfikowaniu, w kolejnej migracji **drop** `status`, `step_dates`,
   `custom_steps`, `step_order`. (Dwustopniowo, żeby móc cofnąć.)

Templaty (3 pliki w `data/templates/`):
- Skrypt `scripts/migrate-templates-flexible.ts` przerabia stary format
  (`customSteps[]` + niejawne 9 kanonicznych) na nowy (`steps[]` z pełną listą).
- Backup starych plików do `data/templates/_backup-pre-flexible/`.

---

## Fazy wdrożenia

Każda faza to **osobny commit**, działający stan po każdym kroku.

### Faza 1 — Schema + migracja danych (offline-safe)

**Pliki:**
- `drizzle/schema.ts` — dodaj `productions.steps` (JSON) + `cancelledAt`. Stare
  kolumny zostają na razie. Nowy typ `ProductionStep`.
- `drizzle/migrations/0011_flexible_steps.sql` — `ALTER TABLE` dodający kolumny.
- `scripts/migrate-flexible-steps.ts` — backfilluje `steps` i `cancelledAt`
  z istniejących `status`/`stepDates`/`customSteps`/`stepOrder`.
- `scripts/migrate-templates-flexible.ts` — przepisuje 3 pliki templatów.

**Cel:** dane w nowym formacie obok starego. Aplikacja **wciąż czyta stary
format** — nic się nie psuje.

**Walidacja:** `npm run db:migrate && npx tsx scripts/migrate-flexible-steps.ts && npx tsx scripts/migrate-templates-flexible.ts`. Sanity check: liczba kroków
w `steps` = 9 + długość starego customSteps[cat], dla każdej produkcji.

### Faza 2 — Helpers + serwer-actions na nowym modelu

**Nowe pliki:**
- `src/lib/production-steps.ts` — pure helpers:
  - `getActiveStepIndex(steps): number` — pierwszy nie-done.
  - `isProductionDone(steps): boolean` — wszystkie done.
  - `getT0AnchorStep(steps): ProductionStep | null`.
  - `derivedDateForEditingStep(steps): string | null` — analogiczne do starego
    `deriveEditingIso`.
  - `resolveTemplateStepsToProductionSteps(templateSteps): ProductionStep[]` —
    deep copy + reset `doneAt`/dat.
- `src/server/actions/production-steps.ts` — wszystkie operacje na nowych
  `steps[]`:
  - `addStep(productionId, category, label, description?)`
  - `removeStep(productionId, stepId)`
  - `renameStep(productionId, stepId, label)`
  - `updateStepDescription(productionId, stepId, description)`
  - `toggleStepDone(productionId, stepId)`
  - `cascadeStepsTo(productionId, stepId, mode: 'mark'|'unmark')` — port starego
    `cascadeStepsTo`, ale operuje na płaskiej liście `steps`.
  - `moveStepInCategory(productionId, stepId, direction)` — swap w obrębie
    tej samej kategorii.
  - `setStepDate(productionId, stepId, dateIso)` — port `setStageDate`,
    z nowym handlowaniem `dateMode === 'derived-from-shooting'` (auto-update
    następnego kroku z tym dateMode).
  - `attachFileToStep`, `removeStepAttachment`.
  - `cancelProduction(productionId)`, `uncancelProduction(productionId)` —
    sets `cancelledAt`.

**Aktualizacja:**
- `src/server/actions/productions.ts`:
  - `createProduction(input, templateSlug?)` — kopiuje `template.steps` do
    nowej produkcji, zapisuje w `steps`. Usuwa `status: 'email-sent'` default.
  - Usuwa `setProductionStatus`. (Status wynika z `steps`.)
  - `listProductions` — bez filtru po `status`; zamiast tego: filtr po
    „in-progress / done / cancelled" liczony z `steps` + `cancelledAt`.

**Cel:** nowa warstwa abstrakcji na danych w nowym formacie. Stara warstwa
(`production-custom-steps.ts`, `production-step-dates.ts`) **wciąż działa
równolegle** — żeby UI nie pękł.

### Faza 3 — UI produkcji (`/productions/[id]`)

**Pliki do przepisania:**
- `src/app/productions/[id]/page.tsx` — czyta `production.steps`. Usuwa
  hardkodowaną tablicę `CATEGORIES` (zostaje tylko nazwa + opis kategorii).
  Dla każdej kategorii — filtruje `steps` po `category`, mapuje na rzędy.
- `src/components/productions/stage-tracker.tsx` — bierze `steps` zamiast
  `status`. Liczy progres jako `done/total` per kategoria.
- `src/components/productions/sub-stage-button.tsx` → przepisanie na
  `step-button.tsx` — pojedynczy generic step (kanoniczny i custom są tym
  samym typem teraz). Click → `cascadeStepsTo`.
- `src/components/productions/custom-step-row.tsx` → `step-row.tsx` — zlewa
  się z `sub-stage-button`. Każdy krok ma label-edit, description-expand,
  date-picker (jeśli `dateMode != 'none'`), arrows, delete, attachment.
- `src/components/productions/move-arrows.tsx` — działa już per `stepId`,
  nic nie zmieniamy poza importem nowego serwer-action.
- `src/components/productions/custom-step-add.tsx` → `step-add-inline.tsx` —
  dodaje krok do kategorii (label only, reszta dziedziczona z UI default).
- `src/components/productions/stage-date-picker.tsx` — działa per krok teraz,
  nie per `ProductionStatus`. Mode i derived-iso liczone z `step.dateMode`.
- `src/components/productions/status-buttons.tsx` → `production-state-buttons.tsx`
  — usuwa „Następny status", zostaje „Anuluj produkcję" / „Wznów" (toggle
  `cancelledAt`).
- `src/components/productions/status-pill.tsx` → przyjmuje `steps` zamiast
  `status`; renderuje „W trakcie · krok N/M" lub „Zakończona" lub „Anulowana".

**Cel:** strona produkcji w pełni działa na nowym modelu. **Wszystkie kroki
edytowalne i przesuwalne** — kanoniczne nie istnieją jako osobna kategoria.

### Faza 4 — Kalendarz + gantt

**Pliki do przepisania:**
- `src/components/calendar/gantt-view.tsx` (1944 linii — największa robota):
  - Każda produkcja → ma `steps[]`. Sub-bar per kategoria liczona z `steps`.
  - „T-0" oznaczone na kroku z `isT0Anchor`. Daty kroków pochodzą z
    `step.dateIso` (recorded), tentative wciąż liczone z `t0At` ± offsety
    per `step.id` (offset table dla migrowanych kroków zostaje, dla nowych —
    placeholder na środku tygodnia).
  - Edycja statusu → klikanie kroku w gantcie woła `cascadeStepsTo` jak
    przedtem, tylko na nowych `steps`.
- `src/app/calendar/page.tsx`:
  - Filter `statusFilter` (`all/in-progress/done/cancelled`) — zamiast
    `p.status === 'cancelled' / 'publishing'`, użyj `p.cancelledAt != null` /
    `isProductionDone(p.steps)`.
- `src/components/calendar/type-color.ts`:
  - `READY_STATUSES` znika. Zastępujemy: `production.steps` ma zaznaczony
    krok publikacji (lub `isProductionDone`).
- `src/server/actions/production-step-dates.ts` → kasujemy. Logika
  kalendarza wbudowana w `setStepDate` w `production-steps.ts`.

**Cel:** kalendarz pokazuje to samo co dziś, ale na nowym modelu.

### Faza 5 — Templaty UI (`template-form` + lista)

**Pliki:**
- `src/components/templates/template-form.tsx`:
  - Usuwa rozróżnienie kanoniczny/custom. Każdy krok renderuje się tak samo
    jako edytowalny `step-row` z labelem, opisem, arrows, delete, dateMode
    selectorem.
  - Lista per kategoria z „Dodaj krok" pod spodem.
  - Strzałki przesuwają tylko w obrębie kategorii.
  - Walidacja: każdy krok musi mieć etykietę; co najwyżej jeden krok
    `isT0Anchor`.
- `src/lib/production-templates.ts` + `production-templates-types.ts`:
  - Nowy schemat Zod (`templateStepSchema`, lista płaska).
- `src/server/actions/templates.ts`:
  - `createTemplate` / `updateTemplate` zapisują nowy format JSON.
- `src/app/templates/page.tsx`:
  - Karta szablonu pokazuje wszystkie kroki w merged sequence, BEZ tagu
    „kanoniczny" (bo go nie ma).
- `src/components/productions/production-wizard.tsx`:
  - Krok 3 wybór templatu — preview tej samej sekwencji.
  - `applyTemplateSteps` zastąpione przez kopiowanie `template.steps` do
    nowo utworzonej produkcji w `createProduction`.

**Cel:** edytor szablonów pełna swoboda. Kreator nowej produkcji konsumuje
nowe templaty.

### Faza 6 — Cleanup

**Usunięcie:**
- Stare kolumny `productions.status`, `step_dates`, `custom_steps`,
  `step_order` (migration `0012_drop_legacy_steps.sql`).
- Stare typy: `ProductionStatus`, `PRODUCTION_PROGRESSION`,
  `PRODUCTION_STATUSES`, `CustomStep`.
- Stare moduły: `category-sequence.ts`, `production-stages.ts`
  (`STAGE_LABEL`/`STAGE_HINT` migrują do templatów jako `label`/`description`).
- Pliki: `production-step-dates.ts`, `production-custom-steps.ts`.
- Skrypt `scripts/check-step-dates.ts`, `scripts/test-output-gen.ts` —
  poprawiamy lub usuwamy.
- Skrypty migracyjne (`scripts/migrate-flexible-steps.ts` itd.) — zostają
  w repo ale oznaczone jako one-shot.

**Walidacja końcowa:** `npx tsc --noEmit` zero błędów, `npm run build`
przechodzi, sanity-test ręczny: tworzymy nową produkcję z każdego templatu,
edytujemy kroki, przesuwamy, anulujemy, znajdujemy w gantcie, klikamy w
kalendarzu.

---

## Czego pilnujemy (ryzyka)

1. **`cascadeStepsTo`** — to jest najbardziej delikatna logika. Migracja musi
   zachować to samo zachowanie (klik na krok zaznacza wszystko przed nim,
   odznacza po). Test: dla 5 produkcji w bazie, przed migracją zrzut listy
   done-kroków, po migracji ten sam zrzut z nowych `steps` musi się zgadzać.

2. **Daty + kalendarz** — `editing` jest obecnie auto-derived. Migracja musi
   to wyrazić jako `dateMode: 'derived-from-shooting'`. Logika
   side-effectu (auto-update editing po zmianie shooting) musi przenieść się
   do `setStepDate` w nowym module.

3. **Output-folder generation** — `setProductionStatus(id, 'publishing')`
   triggeruje `generateOutputFolder`. W nowym modelu: gdy ostatni krok
   publikacji zostaje toggled na done po raz pierwszy → wywołaj. Trigger
   przeniesiony do `cascadeStepsTo` lub `toggleStepDone`.

4. **Template `isT0Anchor`** — żaden istniejący szablon nie ma tego pojęcia.
   Migracja przypisuje `isT0Anchor: true` krokowi `shooting` (T2). Bez tego
   gantt nie wie gdzie postawić oś. Test: po migracji każda produkcja MA
   dokładnie jeden `isT0Anchor` step.

5. **Hardkody `'email-sent'` i innych statusów** — są rozsiane:
   - `productions.ts:36` (`status: parsed.status ?? 'email-sent'`)
   - `productions.ts:122-134` (filtr `status` w listach)
   - `calendar/page.tsx:83-85` (status filter)
   - `gantt-view.tsx` w wielu miejscach
   Plan: globalny grep po `'email-sent'`, `'publishing'`, `'cancelled'`,
   `'shooting'` itd. po fazie 4. Każde wystąpienie albo kasujemy, albo
   zamieniamy na lookup po `step.id` / `isT0Anchor` / `cancelledAt`.

6. **Drizzle types** — usunięcie kolumn ze schemy → typy `Production` się
   zmieniają. Faza 6 odsłoni wiele linii do poprawienia (TypeScript
   wyłapie). Robimy DOPIERO po pełnym przejściu UI na `steps[]`.

---

## Backout

Gdyby Faza 6 (drop kolumn) wykazała problemy: cofnij migration `0012`
i zostaw stare kolumny zerowane / unused. Aplikacja działa na `steps`,
a stare kolumny po prostu dostają wartości placeholder (`status: 'email-sent'`,
puste obiekty) przy pisaniu — koszt: 4 niepotrzebne kolumny w bazie. Akceptowalne
jako fallback.

---

## Akceptacja gotowości

- [ ] Faza 1: skrypty migracji wykonują się czysto na obecnej bazie (snapshot
      `data/marketing-crew.db` przed/po; suma kroków per produkcja zgodna).
- [ ] Faza 2: `npx tsc --noEmit` zero nowych błędów.
- [ ] Faza 3: wszystkie 3 testowe produkcje renderują się na `/productions/[id]`,
      można edytować/usuwać/przesuwać każdy krok (w tym te „kanoniczne"),
      checkbox cascade działa.
- [ ] Faza 4: gantt pokazuje produkcje na T-0, sub-bar per kategoria zgadza
      się z listą kroków, klik w sub-step toggluje. Kalendarz pokazuje wpisy
      z dat kroków.
- [ ] Faza 5: edytor templatu pozwala usunąć/edytować KAŻDY krok. Kreator
      tworzy produkcję z templatu i kroki się przenoszą.
- [ ] Faza 6: stare kolumny i typy znikają; build przechodzi; aplikacja dalej
      działa.

---

## Estymacja

- Faza 1: ~2h (migracja + skrypty + walidacja).
- Faza 2: ~3h.
- Faza 3: ~4h (UI produkcji jest mocno utkana w `status`).
- Faza 4: ~5h (gantt 1944 linii — najtrudniejsze).
- Faza 5: ~2h.
- Faza 6: ~2h cleanup + smoke testing.

**Razem ~18h pracy.** Robimy fazami z commitami między, żeby cofnąć
częściowo gdyby coś poszło nie tak.
