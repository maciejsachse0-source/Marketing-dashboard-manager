'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTemplate, deleteTemplate, updateTemplate } from '@/server/actions/templates';
import {
  PRODUCTION_TYPES,
  STEP_DATE_MODES,
  type ProductionStage,
  type ProductionType,
  type StepCalendarType,
  type StepDateMode,
} from '../../../drizzle/schema';
import {
  CATEGORY_LABEL,
  FRAME_FOR_CATEGORY,
  FRAME_STYLE,
} from '@/lib/category-colors';
import type {
  ProductionTemplate,
  TemplateStep,
} from '@/lib/production-templates-types';
import {
  DEFAULT_PERIODS,
  MAX_PERIODS,
  MIN_PERIODS,
  PERIOD_OFFSET_MAX,
  codeForIndex,
  describeOffset,
  type TemplatePeriod,
} from '@/lib/production-periods';

const TYPE_LABEL: Record<ProductionType, string> = {
  'with-artist': 'Z artystą',
  solo: 'Solo',
};

const CATEGORY_ORDER: ProductionStage[] = [
  'outreach',
  'ustalenia',
  'nagrywanie',
  'obrobka',
  'publikacja',
];

const DATE_MODE_LABEL: Record<StepDateMode, string> = {
  none: 'brak daty',
  record: 'tylko data (bez kalendarza)',
  calendar: 'data + wpis w kalendarzu',
  'derived-from-shooting': 'auto z innego kroku (wycofywane)',
};

/** Existing templates persisted before the 0-anchored period model used
 *  negative offsets. We shift them into the new range on load so the editor
 *  doesn't refuse to render them — the relative spacing is preserved. */
function migrateLegacyPeriods(input: TemplatePeriod[] | undefined): TemplatePeriod[] {
  if (!input || input.length === 0) return DEFAULT_PERIODS;
  const min = Math.min(...input.map((p) => p.startOffsetDays));
  const shift = min < 0 ? -min : 0;
  return input.map((p, i) => ({
    code: codeForIndex(i),
    startOffsetDays: Math.max(0, p.startOffsetDays + shift),
    endOffsetDays: Math.max(0, p.endOffsetDays + shift),
  }));
}

const CALENDAR_TYPE_LABEL: Record<StepCalendarType, string> = {
  shoot: 'Nagrywka',
  edit: 'Obróbka',
  meeting: 'Spotkanie',
  deadline: 'Deadline',
};

type Mode = { kind: 'create' } | { kind: 'edit'; slug: string };

function newStepId(): string {
  return Math.random().toString(36).slice(2, 14);
}

const MONTH_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'] as const;

/** Date N days after `start` (preserves local-time hours/min so the picker
 *  doesn't drift across DST). */
function dateAt(start: Date, offsetDays: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

/** Compact pl-PL date — "12 maj" or "1 cze". Used as axis tick labels and
 *  in period range chips so the user reads concrete days, not just offsets. */
function fmtDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTH_PL[d.getMonth()]}`;
}

/** YYYY-MM-DD for `<input type="date">` round-tripping. Always local. */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Default preview anchor: the next Monday from today (incl. today if it is
 *  Monday). Matches the historical Mon-anchored grid so default 7-day periods
 *  visually align with calendar weeks on first open. */
function nextMonday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // JS getDay: 0=Sun..6=Sat → re-base to 0=Mon..6=Sun.
  const dowMon = (d.getDay() + 6) % 7;
  const offset = dowMon === 0 ? 0 : 7 - dowMon;
  d.setDate(d.getDate() + offset);
  return d;
}

export function TemplateForm({ mode, initial }: { mode: Mode; initial?: ProductionTemplate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [type, setType] = useState<ProductionType>(initial?.type ?? 'with-artist');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [steps, setSteps] = useState<TemplateStep[]>(initial?.steps ?? []);
  const [periods, setPeriods] = useState<TemplatePeriod[]>(() =>
    migrateLegacyPeriods(initial?.periods),
  );
  // Preview-only anchor date: drives slider axis labels (months + day numbers
  // + concrete dates per period). NOT persisted — templates are reusable, so
  // the real start date is picked when a production is created from this
  // template. Defaults to the next Monday for clean week-aligned visuals.
  const [previewStart, setPreviewStart] = useState<Date>(() => nextMonday());

  const totalSteps = steps.length;

  const updatePeriod = (idx: number, patch: Partial<TemplatePeriod>) => {
    setPeriods((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const resetPeriods = () => setPeriods(DEFAULT_PERIODS);

  /** Append a new period after the last one, defaulting to a 7-day band right
   *  after the current end (or starting fresh at 0 if the list is empty). */
  const addPeriod = () => {
    setPeriods((prev) => {
      if (prev.length >= MAX_PERIODS) return prev;
      const last = prev[prev.length - 1];
      const start = last ? last.endOffsetDays + 1 : 0;
      const end = Math.min(PERIOD_OFFSET_MAX, start + 6);
      return [
        ...prev,
        { code: codeForIndex(prev.length), startOffsetDays: start, endOffsetDays: end },
      ];
    });
  };

  const removePeriod = (idx: number) => {
    setPeriods((prev) => {
      if (prev.length <= MIN_PERIODS) return prev;
      // Renumber codes so they stay contiguous T1..Tn after removal — order
      // and code identity must match the array index (validation depends on it).
      return prev
        .filter((_, i) => i !== idx)
        .map((p, i) => ({ ...p, code: codeForIndex(i) }));
    });
  };

  // Inline overlap detection for the user's eye — server-side validation in
  // periodsSchema is the source of truth, this just surfaces the issue early.
  const periodErrors: (string | null)[] = periods.map((p, i) => {
    if (p.startOffsetDays > p.endOffsetDays) return 'Początek po końcu';
    const prev = periods[i - 1];
    if (prev && prev.endOffsetDays >= p.startOffsetDays) {
      return `Nakłada się z ${prev.code}`;
    }
    return null;
  });

  const updateStep = (idx: number, patch: Partial<TemplateStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeStep = (idx: number) => {
    if (!confirm(`Usunąć krok „${steps[idx].label || 'bez etykiety'}"?`)) return;
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  /** Move a step up/down within its category. Skips swaps that would cross
   *  category boundaries — the user uses category re-assignment for that. */
  const moveStepInCategory = (idx: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const target = prev[idx];
      if (!target) return prev;
      let neighborIdx = -1;
      if (direction === -1) {
        for (let i = idx - 1; i >= 0; i--) {
          if (prev[i].category === target.category) {
            neighborIdx = i;
            break;
          }
        }
      } else {
        for (let i = idx + 1; i < prev.length; i++) {
          if (prev[i].category === target.category) {
            neighborIdx = i;
            break;
          }
        }
      }
      if (neighborIdx === -1) return prev;
      const next = [...prev];
      [next[idx], next[neighborIdx]] = [next[neighborIdx], next[idx]];
      return next;
    });
  };

  const addStepInCategory = (category: ProductionStage) => {
    setSteps((prev) => {
      const newStep: TemplateStep = {
        id: newStepId(),
        category,
        label: '',
        dateMode: 'none',
      };
      const myCatOrder = CATEGORY_ORDER.indexOf(category);
      let boundaryIdx = prev.length;
      for (let i = 0; i < prev.length; i++) {
        const otherCatOrder = CATEGORY_ORDER.indexOf(prev[i].category);
        if (otherCatOrder > myCatOrder) {
          boundaryIdx = i;
          break;
        }
      }
      return [...prev.slice(0, boundaryIdx), newStep, ...prev.slice(boundaryIdx)];
    });
  };

  const onSubmit = () => {
    setError(null);
    const cleanSteps: TemplateStep[] = steps.map((s) => {
      const out: TemplateStep = {
        id: s.id,
        category: s.category,
        label: s.label.trim(),
      };
      const desc = s.description?.trim();
      if (desc) out.description = desc;
      if (s.dateMode && s.dateMode !== 'none') out.dateMode = s.dateMode;
      else out.dateMode = 'none';
      if (s.durationMinutes != null && s.durationMinutes > 0) {
        out.durationMinutes = s.durationMinutes;
      }
      if (s.calendarType) out.calendarType = s.calendarType;
      return out;
    });
    if (cleanSteps.some((s) => !s.label)) {
      setError('Każdy krok musi mieć etykietę.');
      return;
    }
    const ids = new Set<string>();
    for (const s of cleanSteps) {
      if (ids.has(s.id)) {
        setError(`Duplikujący się id kroku: ${s.id}`);
        return;
      }
      ids.add(s.id);
    }
    if (cleanSteps.length === 0) {
      setError('Szablon musi mieć co najmniej jeden krok.');
      return;
    }
    if (periodErrors.some((e) => e !== null)) {
      setError('Popraw nakładające się okresy zanim zapiszesz.');
      return;
    }

    const payload = {
      slug: mode.kind === 'edit' ? mode.slug : slug.trim(),
      name: name.trim(),
      type,
      summary: summary.trim(),
      description: description.trim(),
      steps: cleanSteps,
      periods,
    };

    startTransition(async () => {
      try {
        if (mode.kind === 'edit') {
          const t = await updateTemplate(mode.slug, payload);
          toast.success(`Zapisano szablon "${t.name}"`);
          router.push('/templates');
          router.refresh();
        } else {
          const t = await createTemplate(payload);
          toast.success(`Utworzono szablon "${t.name}"`);
          router.push('/templates');
          router.refresh();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error('Nie udało się zapisać', { description: msg });
      }
    });
  };

  const onDelete = () => {
    if (mode.kind !== 'edit') return;
    if (!confirm(`Usunąć szablon "${initial?.name ?? mode.slug}"?\n\nTej operacji nie można cofnąć. Istniejące produkcje nie będą zmieniane.`))
      return;
    startTransition(async () => {
      try {
        await deleteTemplate(mode.slug);
        toast.success('Szablon usunięty');
        router.push('/templates');
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error('Nie udało się usunąć', { description: msg });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Identity */}
      <section className="card-editorial p-5 space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Podstawy
          </h2>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
            łącznie {totalSteps} kroków
          </span>
        </header>

        <div className="grid gap-1.5">
          <Label htmlFor="name">Nazwa szablonu</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Np. Premiera EP — pełna kolaba"
          />
        </div>

        {mode.kind === 'create' ? (
          <div className="grid gap-1.5">
            <Label htmlFor="slug">Slug (opcjonalnie)</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto z nazwy"
              pattern="[a-z0-9\-]*"
            />
            <p className="text-[10px] text-muted-foreground">
              Tylko małe litery, cyfry i myślnik. Zostaw puste — wygenerujemy z nazwy.
            </p>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label className="text-muted-foreground">Slug</Label>
            <code className="text-sm font-mono px-2 py-1 rounded bg-muted/50 text-muted-foreground w-fit">
              {mode.slug}
            </code>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>Typ produkcji</Label>
          <div className="flex gap-2">
            {PRODUCTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold ui-transition active:scale-[0.97] ${
                  type === t
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border hover:border-foreground/30 text-muted-foreground'
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="summary">Krótki opis</Label>
          <Input
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Jedno zdanie — co wyróżnia ten szablon"
            maxLength={160}
          />
          <p className="text-[10px] text-muted-foreground">
            Pokazany w kreatorze nowej produkcji. {summary.length}/160
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="description">Pełny opis</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Dla kogo, kiedy używać, czego się spodziewać po pipeline."
            maxLength={1000}
          />
          <p className="text-[10px] text-muted-foreground">
            Pokazany na karcie szablonu. {description.length}/1000
          </p>
        </div>
      </section>

      {/* Periods — arbitrary day-range bands measured from the production's
          start day (offset 0). User picks how many: anywhere from MIN_PERIODS
          to MAX_PERIODS. Order is array order; codes T1..Tn auto-derived.
          Overlaps blocked. Used by gantt to render the colored backdrop. */}
      <section className="card-editorial p-5 space-y-4">
        <header className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Okresy czasowe
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Każdy okres to przedział dni od dnia startu produkcji (dzień 0).
              Wybierasz ile chcesz mieć okresów ({MIN_PERIODS}–{MAX_PERIODS}) i
              jak długo każdy trwa — slidery dowolnie skracasz, wydłużasz,
              przesuwasz dzień po dniu. Warunek: kolejne okresy nie mogą się
              nakładać.
            </p>
          </div>
          <button
            type="button"
            onClick={resetPeriods}
            className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground ui-transition shrink-0"
          >
            Przywróć domyślne
          </button>
        </header>

        <div className="flex flex-wrap items-end gap-3 pb-2 border-b border-border/40">
          <div className="grid gap-1">
            <Label htmlFor="preview-start" className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Data startu (podgląd na osi)
            </Label>
            <input
              id="preview-start"
              type="date"
              value={isoDate(previewStart)}
              onChange={(e) => {
                const d = parseIsoDate(e.target.value);
                if (d) setPreviewStart(d);
              }}
              className="h-8 rounded-md border border-input bg-card px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <p className="text-[10px] text-muted-foreground max-w-md leading-relaxed pb-1">
            Tylko do podglądu — nie zapisuje się w szablonie. Realną datę
            startu wybierasz przy tworzeniu produkcji z tego szablonu.
          </p>
        </div>

        <PeriodsSlider
          periods={periods}
          errors={periodErrors}
          previewStart={previewStart}
          onChange={updatePeriod}
          onRemove={removePeriod}
          canRemove={periods.length > MIN_PERIODS}
        />

        <div className="pt-1">
          <Button
            size="sm"
            variant="outline"
            type="button"
            onClick={addPeriod}
            disabled={periods.length >= MAX_PERIODS}
            className="bg-card"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Dodaj okres
            {periods.length >= MAX_PERIODS ? ` (max ${MAX_PERIODS})` : ''}
          </Button>
        </div>
      </section>

      {/* Pipeline — every step (no canonical/custom distinction). All editable,
          movable in-category, removable. */}
      <section className="space-y-4">
        <header className="flex items-baseline justify-between gap-3 flex-wrap px-1">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Kroki szablonu
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pełna definicja pipeline'u. Każdy krok jest edytowalny i można go
              usunąć. Strzałki przesuwają w obrębie tej samej kategorii.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums shrink-0">
            {totalSteps} kroków
          </span>
        </header>

        {(() => {
          let runningOffset = 0;
          return CATEGORY_ORDER.map((cat) => {
            const indicesInCat: number[] = [];
            steps.forEach((s, i) => {
              if (s.category === cat) indicesInCat.push(i);
            });
            const startNumber = runningOffset + 1;
            runningOffset += indicesInCat.length;
            const frame = FRAME_FOR_CATEGORY[cat];
            const tone = FRAME_STYLE[frame];

            return (
              <div
                key={cat}
                className={`rounded-2xl border-2 ${tone.border} ${tone.bg} p-4 sm:p-5 space-y-3`}
              >
                <header className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md text-[11px] font-bold tracking-[0.18em] tabular-nums ${tone.badge}`}
                  >
                    {frame}
                  </span>
                  <span
                    className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${tone.accent}`}
                  >
                    {CATEGORY_LABEL[cat]}
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                    {indicesInCat.length} {indicesInCat.length === 1 ? 'krok' : 'kroków'}
                  </span>
                </header>

                {indicesInCat.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-4 text-center text-[11px] text-muted-foreground">
                    Brak kroków w tej kategorii.
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {indicesInCat.map((stepsIdx, posInCat) => {
                      const step = steps[stepsIdx];
                      const displayNumber = startNumber + posInCat;
                      const canMoveUp = posInCat > 0;
                      const canMoveDown = posInCat < indicesInCat.length - 1;
                      return (
                        <StepRow
                          key={step.id}
                          step={step}
                          displayNumber={displayNumber}
                          canMoveUp={canMoveUp}
                          canMoveDown={canMoveDown}
                          tone={tone}
                          onChange={(patch) => updateStep(stepsIdx, patch)}
                          onRemove={() => removeStep(stepsIdx)}
                          onMoveUp={() => moveStepInCategory(stepsIdx, -1)}
                          onMoveDown={() => moveStepInCategory(stepsIdx, 1)}
                        />
                      );
                    })}
                  </ol>
                )}

                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addStepInCategory(cat)}
                    type="button"
                    className="bg-card"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Dodaj krok do {CATEGORY_LABEL[cat]}
                  </Button>
                </div>
              </div>
            );
          });
        })()}
      </section>

      {error ? (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-md">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 sticky bottom-3 bg-background/85 backdrop-blur p-3 rounded-lg border border-border">
        <Link
          href="/templates"
          className="text-sm text-muted-foreground hover:text-foreground ui-transition"
        >
          ← Wróć do listy
        </Link>
        <div className="flex items-center gap-2">
          {mode.kind === 'edit' ? (
            <Button
              type="button"
              variant="outline"
              onClick={onDelete}
              disabled={pending}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Usuń
            </Button>
          ) : null}
          <Button onClick={onSubmit} disabled={pending}>
            {pending
              ? 'Zapisuję…'
              : mode.kind === 'edit'
                ? 'Zapisz zmiany'
                : 'Utwórz szablon'}
          </Button>
        </div>
      </div>
    </div>
  );
}

type Tone = {
  bg: string;
  border: string;
  badge: string;
  chip: string;
  dot: string;
  rail: string;
};

/**
 * Slider editor for a variable number of periods on a shared horizontal axis.
 * Each period is a colored bar with start/end thumbs (drag) plus a body that
 * translates the whole period when dragged. Same axis = the user can VISUALLY
 * check non-overlap and ordering without reading numbers.
 *
 * Axis: 0..sliderMax days from the production's start day. sliderMax adapts
 * to the longest period so the strip always shows real estate beyond the
 * last period (room to extend or add another). Snapping is per-day. Day-of-
 * week initials sit under the cells so individual dates stay legible.
 */
const PERIOD_TONES: Array<{ bg: string; bar: string; thumb: string; ink: string }> = [
  { bg: 'bg-amber-100', bar: 'bg-amber-300', thumb: 'bg-amber-600 border-amber-700', ink: 'text-amber-900' },
  { bg: 'bg-violet-100', bar: 'bg-violet-300', thumb: 'bg-violet-600 border-violet-700', ink: 'text-violet-900' },
  { bg: 'bg-emerald-100', bar: 'bg-emerald-300', thumb: 'bg-emerald-600 border-emerald-700', ink: 'text-emerald-900' },
  { bg: 'bg-sky-100', bar: 'bg-sky-300', thumb: 'bg-sky-600 border-sky-700', ink: 'text-sky-900' },
  { bg: 'bg-rose-100', bar: 'bg-rose-300', thumb: 'bg-rose-600 border-rose-700', ink: 'text-rose-900' },
  { bg: 'bg-stone-100', bar: 'bg-stone-300', thumb: 'bg-stone-600 border-stone-700', ink: 'text-stone-900' },
];

function PeriodsSlider({
  periods,
  errors,
  previewStart,
  onChange,
  onRemove,
  canRemove,
}: {
  periods: TemplatePeriod[];
  errors: (string | null)[];
  /** Anchors the axis to a real calendar — labels become concrete dates
   *  ("12 maj") and day-of-month numbers, plus month boundary markers. */
  previewStart: Date;
  onChange: (idx: number, patch: Partial<TemplatePeriod>) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  // Axis max scales with the longest period so the strip always has room
  // beyond the last period for editing/extending. Floor at 28 so a fresh
  // template doesn't render a tiny axis.
  const maxEnd = periods.length > 0
    ? Math.max(0, ...periods.map((p) => p.endOffsetDays))
    : 0;
  const sliderMin = 0;
  const sliderMax = Math.min(
    PERIOD_OFFSET_MAX,
    Math.max(28, Math.ceil((maxEnd + 7) / 7) * 7),
  );
  const sliderDays = sliderMax - sliderMin + 1;

  // While dragging we keep a ref instead of state so the global pointermove
  // listener doesn't re-bind on every update — react re-renders are still
  // driven through `onChange`.
  const dragRef = useRef<{
    periodIdx: number;
    handle: 'start' | 'end' | 'span';
    /** For 'span' drags: the original period and the day where the drag began,
     *  so we translate by delta instead of pinning the period start to the
     *  cursor (which would feel jumpy if the user grabs the middle). */
    originStart?: number;
    originEnd?: number;
    originDay?: number;
  } | null>(null);

  const dayFromClientX = (clientX: number): number => {
    const rail = railRef.current;
    if (!rail) return sliderMin;
    const rect = rail.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    const day = Math.round(pct * (sliderDays - 1)) + sliderMin;
    return Math.max(sliderMin, Math.min(sliderMax, day));
  };

  // Global pointer listeners installed once — we read the active drag from
  // dragRef so the closure stays stable for the listener's lifetime.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const day = dayFromClientX(e.clientX);
      const cur = periods[drag.periodIdx];
      if (!cur) return;

      if (drag.handle === 'start') {
        // Allow start to cross beyond end momentarily — the live error UI flags
        // it; user resolves by dragging end. Hard-clamp keeps it ≤ end so the
        // bar doesn't visually invert.
        const clamped = Math.min(day, cur.endOffsetDays);
        if (clamped !== cur.startOffsetDays) {
          onChange(drag.periodIdx, { startOffsetDays: clamped });
        }
      } else if (drag.handle === 'end') {
        const clamped = Math.max(day, cur.startOffsetDays);
        if (clamped !== cur.endOffsetDays) {
          onChange(drag.periodIdx, { endOffsetDays: clamped });
        }
      } else {
        // Span drag = translate the whole period by the cursor delta.
        const delta = day - (drag.originDay ?? day);
        const length = (drag.originEnd ?? cur.endOffsetDays) - (drag.originStart ?? cur.startOffsetDays);
        let newStart = (drag.originStart ?? cur.startOffsetDays) + delta;
        // Clamp so the period stays inside the visible axis.
        if (newStart < sliderMin) newStart = sliderMin;
        if (newStart + length > sliderMax) newStart = sliderMax - length;
        const newEnd = newStart + length;
        if (newStart !== cur.startOffsetDays || newEnd !== cur.endOffsetDays) {
          onChange(drag.periodIdx, {
            startOffsetDays: newStart,
            endOffsetDays: newEnd,
          });
        }
      }
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [periods, onChange, sliderMin, sliderMax, sliderDays]);

  const startDrag = (
    e: React.PointerEvent,
    periodIdx: number,
    handle: 'start' | 'end' | 'span',
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = periods[periodIdx];
    dragRef.current = {
      periodIdx,
      handle,
      originStart: cur.startOffsetDays,
      originEnd: cur.endOffsetDays,
      originDay: dayFromClientX(e.clientX),
    };
    document.body.style.userSelect = 'none';
  };

  const dayToPercent = (d: number) =>
    ((d - sliderMin) / (sliderDays - 1)) * 100;

  // Major ticks every 7 days — labels become real dates anchored on
  // `previewStart` ("5 maj", "12 maj", "19 maj"…). Day 0 also gets a "Start"
  // ribbon below to underline that it's the production's anchor.
  const majorTicks: { offset: number; date: Date; label: string }[] = [];
  for (let d = sliderMin; d <= sliderMax; d++) {
    if (d % 7 !== 0) continue;
    const date = dateAt(previewStart, d);
    majorTicks.push({ offset: d, date, label: fmtDayMonth(date) });
  }

  // Month boundary markers — vertical hairline + month label whenever the
  // visible window crosses into a new month. Helps with longer pipelines that
  // span multiple months. Skip the first day (would visually duplicate the
  // axis edge).
  const monthBoundaries: { offset: number; label: string }[] = [];
  let prevMonth = -1;
  for (let d = sliderMin; d <= sliderMax; d++) {
    const date = dateAt(previewStart, d);
    const m = date.getMonth();
    if (d === sliderMin) {
      prevMonth = m;
      continue;
    }
    if (m !== prevMonth) {
      monthBoundaries.push({ offset: d, label: MONTH_PL[m] });
      prevMonth = m;
    }
  }

  return (
    <div className="space-y-4">
      {/* Shared axis: month band + week-tick dates + day cells + day-of-month
          numbers. Drawn once, sits behind all rails. Anchored on previewStart
          so the user reads concrete calendar dates instead of raw offsets. */}
      <div className="space-y-1">
        {/* Month band — labels each month present in the visible window,
            with a hairline at every month boundary so they read as ranges. */}
        <div className="relative h-4 select-none">
          {/* First-month label sits at the left edge */}
          <span
            className="absolute text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground"
            style={{ left: `0%` }}
          >
            {MONTH_PL[previewStart.getMonth()]} {previewStart.getFullYear()}
          </span>
          {monthBoundaries.map((m) => (
            <span
              key={m.offset}
              className="absolute -translate-x-1/2 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground"
              style={{ left: `${dayToPercent(m.offset)}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        {/* Week-tick date labels (every 7 days) */}
        <div className="relative h-5 select-none">
          {majorTicks.map((t) => (
            <span
              key={t.offset}
              className={`absolute -translate-x-1/2 text-[10px] tracking-tight tabular-nums ${
                t.offset === 0
                  ? 'font-bold text-foreground'
                  : 'text-muted-foreground'
              }`}
              style={{ left: `${dayToPercent(t.offset)}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <div className="relative h-3 rounded bg-muted/40 select-none">
          {/* Day cells — every day a thin vertical hair, weekend days slightly
              darker so the user can see Sat/Sun without labels. */}
          {Array.from({ length: sliderDays }).map((_, i) => {
            const d = sliderMin + i;
            const dow = ((d % 7) + 7) % 7;
            const isWeekend = dow >= 5;
            return (
              <div
                key={i}
                className={`absolute top-0 bottom-0 ${isWeekend ? 'bg-muted-foreground/15' : ''}`}
                style={{
                  left: `${dayToPercent(d) - 0.5 / sliderDays * 100}%`,
                  width: `${100 / sliderDays}%`,
                }}
              />
            );
          })}
          {/* Month boundary hairlines on the cells row — strongest visual cue */}
          {monthBoundaries.map((m) => (
            <div
              key={m.offset}
              className="absolute top-0 bottom-0 w-px bg-foreground/30 pointer-events-none"
              style={{ left: `${dayToPercent(m.offset)}%` }}
            />
          ))}
        </div>
        {/* Per-day day-of-month numbers — replaces the dow initials so the
            user can pick out concrete days at a glance. Day 1 of each month
            is emphasised. */}
        <div className="relative h-3 select-none">
          {Array.from({ length: sliderDays }).map((_, i) => {
            const d = sliderMin + i;
            const date = dateAt(previewStart, d);
            const dow = ((d % 7) + 7) % 7;
            const isWeekend = dow >= 5;
            const isFirstOfMonth = date.getDate() === 1;
            return (
              <span
                key={i}
                className={`absolute -translate-x-1/2 text-[8px] tabular-nums ${
                  isFirstOfMonth
                    ? 'font-bold text-foreground'
                    : isWeekend
                      ? 'text-muted-foreground/55'
                      : 'text-muted-foreground/80'
                }`}
                style={{ left: `${dayToPercent(d)}%` }}
              >
                {date.getDate()}
              </span>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums px-0.5">
          <span>{fmtDayMonth(dateAt(previewStart, sliderMin))} (start)</span>
          <span>{fmtDayMonth(dateAt(previewStart, sliderMax))}</span>
        </div>
      </div>

      {/* One rail per period — same axis, draggable colored span + 2 thumbs */}
      {periods.map((p, idx) => (
        <PeriodRail
          key={`${p.code}-${idx}`}
          period={p}
          tone={PERIOD_TONES[idx % PERIOD_TONES.length]}
          error={errors[idx]}
          dayToPercent={dayToPercent}
          previewStart={previewStart}
          railRef={idx === 0 ? railRef : undefined}
          onRemove={canRemove ? () => onRemove(idx) : undefined}
          onPointerDownStart={(e) => startDrag(e, idx, 'start')}
          onPointerDownEnd={(e) => startDrag(e, idx, 'end')}
          onPointerDownSpan={(e) => startDrag(e, idx, 'span')}
          onClickRail={(clientX) => {
            // Click on empty rail = move nearest endpoint to clicked day.
            const day = dayFromClientX(clientX);
            const distStart = Math.abs(day - p.startOffsetDays);
            const distEnd = Math.abs(day - p.endOffsetDays);
            if (distStart <= distEnd) {
              onChange(idx, { startOffsetDays: Math.min(day, p.endOffsetDays) });
            } else {
              onChange(idx, { endOffsetDays: Math.max(day, p.startOffsetDays) });
            }
          }}
        />
      ))}
    </div>
  );
}

function PeriodRail({
  period,
  tone,
  error,
  dayToPercent,
  previewStart,
  railRef,
  onRemove,
  onPointerDownStart,
  onPointerDownEnd,
  onPointerDownSpan,
  onClickRail,
}: {
  period: TemplatePeriod;
  tone: { bg: string; bar: string; thumb: string; ink: string };
  error: string | null;
  dayToPercent: (d: number) => number;
  /** Anchor for converting offsets to concrete dates in chip + tooltips. */
  previewStart: Date;
  /** Only the FIRST rail registers the shared ref — that's what the drag math
   *  reads to convert clientX → day. All rails are the same width inside the
   *  same flex container so one ref suffices. */
  railRef?: React.Ref<HTMLDivElement>;
  /** Trash button rendered next to the period chip when count > MIN_PERIODS. */
  onRemove?: () => void;
  onPointerDownStart: (e: React.PointerEvent) => void;
  onPointerDownEnd: (e: React.PointerEvent) => void;
  onPointerDownSpan: (e: React.PointerEvent) => void;
  onClickRail: (clientX: number) => void;
}) {
  const startPct = dayToPercent(period.startOffsetDays);
  const endPct = dayToPercent(period.endOffsetDays);
  const widthPct = endPct - startPct;
  const lengthDays = period.endOffsetDays - period.startOffsetDays + 1;
  const startDate = dateAt(previewStart, period.startOffsetDays);
  const endDate = dateAt(previewStart, period.endOffsetDays);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px]">
        <span
          className={`inline-flex items-center justify-center min-w-[2rem] h-5 px-1.5 rounded text-[10px] font-bold tracking-[0.18em] tabular-nums ${tone.bar} ${tone.ink}`}
        >
          {period.code}
        </span>
        <span className={`tabular-nums ${tone.ink}`}>
          {fmtDayMonth(startDate)} → {fmtDayMonth(endDate)}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          ({describeOffset(period.startOffsetDays)} → {describeOffset(period.endOffsetDays)})
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          {lengthDays} {lengthDays === 1 ? 'dzień' : 'dni'}
        </span>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 ui-transition"
            title={`Usuń ${period.code}`}
            aria-label={`Usuń ${period.code}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      <div
        ref={railRef}
        className={`relative h-9 rounded-md ${tone.bg} ${error ? 'ring-2 ring-rose-400' : ''} touch-none cursor-pointer`}
        onPointerDown={(e) => {
          // Click directly on the rail (not on a thumb / span) — move nearest
          // endpoint there. Pointer events bubble up; thumbs stop propagation.
          onClickRail(e.clientX);
        }}
      >
        {/* Filled span — drag to translate */}
        <div
          className={`absolute top-1 bottom-1 rounded ${tone.bar} cursor-grab active:cursor-grabbing`}
          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
          onPointerDown={onPointerDownSpan}
          title="Przeciągnij, by przesunąć cały okres"
        />
        {/* Start thumb */}
        <button
          type="button"
          onPointerDown={onPointerDownStart}
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-7 rounded border-2 ${tone.thumb} cursor-ew-resize shadow-md hover:scale-110 ui-transition`}
          style={{ left: `${startPct}%` }}
          aria-label={`${period.code} początek`}
          title={`Start: ${fmtDayMonth(startDate)} · ${describeOffset(period.startOffsetDays)}`}
        />
        {/* End thumb */}
        <button
          type="button"
          onPointerDown={onPointerDownEnd}
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-7 rounded border-2 ${tone.thumb} cursor-ew-resize shadow-md hover:scale-110 ui-transition`}
          style={{ left: `${endPct}%` }}
          aria-label={`${period.code} koniec`}
          title={`Koniec: ${fmtDayMonth(endDate)} · ${describeOffset(period.endOffsetDays)}`}
        />
      </div>

      {error ? (
        <p className="text-[11px] text-rose-700 font-medium">{error}</p>
      ) : null}
    </div>
  );
}

function StepRow({
  step,
  displayNumber,
  canMoveUp,
  canMoveDown,
  tone,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: TemplateStep;
  displayNumber: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  tone: Tone;
  onChange: (patch: Partial<TemplateStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCalendar = step.dateMode === 'calendar';

  return (
    <li className={`group rounded-xl border-2 ${tone.border} bg-card transition`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className={`grid place-items-center w-5 h-5 rounded-full text-[10px] font-bold tabular-nums text-white shrink-0 ${tone.dot}`}
        >
          {displayNumber}
        </span>
        <Input
          value={step.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Etykieta kroku — np. wysłanie maila"
          maxLength={80}
          className="flex-1 bg-card h-8 text-sm"
        />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
            title="Przesuń wyżej"
            aria-label="Przesuń wyżej"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
            title="Przesuń niżej"
            aria-label="Przesuń niżej"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 ui-transition"
            title="Usuń krok"
            aria-label="Usuń krok"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted ui-transition"
            aria-expanded={expanded}
            title={expanded ? 'Zwiń' : 'Ustawienia kroku'}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 ui-transition ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {step.description && !expanded ? (
        <div className="px-3 pb-2 -mt-1 pl-10 text-[11px] text-muted-foreground/80 italic truncate">
          {step.description}
        </div>
      ) : null}

      {expanded ? (
        <div className="border-t border-border/60 px-3 py-3 space-y-3 text-xs">
          <div className="grid gap-1.5">
            <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Opis (podpowiedź dla użytkownika)
            </Label>
            <Textarea
              value={step.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Co konkretnie zrobić w tym kroku, na co zwrócić uwagę…"
              maxLength={1000}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Tryb daty
              </Label>
              <select
                value={step.dateMode ?? 'none'}
                onChange={(e) => onChange({ dateMode: e.target.value as StepDateMode })}
                className="rounded-md border border-input bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STEP_DATE_MODES.map((m) => (
                  <option key={m} value={m}>
                    {DATE_MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            {isCalendar ? (
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Typ wpisu kalendarza
                </Label>
                <select
                  value={step.calendarType ?? 'meeting'}
                  onChange={(e) =>
                    onChange({ calendarType: e.target.value as StepCalendarType })
                  }
                  className="rounded-md border border-input bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {(['meeting', 'shoot', 'edit', 'deadline'] as StepCalendarType[]).map((t) => (
                    <option key={t} value={t}>
                      {CALENDAR_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {isCalendar ? (
            <div className="grid gap-1.5">
              <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Domyślny czas trwania (minuty)
              </Label>
              <Input
                type="number"
                min={0}
                max={1440}
                value={step.durationMinutes ?? 0}
                onChange={(e) =>
                  onChange({ durationMinutes: Math.max(0, Number(e.target.value) || 0) })
                }
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                0 = punkt w czasie (deadline). Inaczej — domyślny zakres na kalendarzu.
              </p>
            </div>
          ) : null}

          <div className="text-[10px] text-muted-foreground">
            <span className="font-mono">id: {step.id}</span>
          </div>
        </div>
      ) : null}
    </li>
  );
}
