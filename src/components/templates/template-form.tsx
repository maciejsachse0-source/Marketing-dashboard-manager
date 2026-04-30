'use client';

import { useState, useTransition } from 'react';
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
  'derived-from-shooting': 'auto: dzień po nagrywce',
};

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

  const totalSteps = steps.length;

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
      // Find the previous/next step in the SAME category.
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
      // Insert the new step at the END of its category — find the index of
      // the last step in this category, or the start of the next category.
      const newStep: TemplateStep = {
        id: newStepId(),
        category,
        label: '',
        dateMode: 'none',
      };
      // Strategy: find the boundary index = first index where step.category
      // comes AFTER our category (in CATEGORY_ORDER). Insert before that.
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

  /** Toggle the unique T-0 anchor — exactly one step is allowed to carry
   *  the flag. Setting it on one step clears all others. */
  const setT0Anchor = (idx: number, value: boolean) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i === idx) return { ...s, isT0Anchor: value || undefined };
        if (value && s.isT0Anchor) return { ...s, isT0Anchor: undefined };
        return s;
      }),
    );
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
      if (s.isT0Anchor) out.isT0Anchor = true;
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
    if (cleanSteps.filter((s) => s.isT0Anchor).length > 1) {
      setError('Tylko jeden krok może być oznaczony jako T-0.');
      return;
    }
    if (cleanSteps.length === 0) {
      setError('Szablon musi mieć co najmniej jeden krok.');
      return;
    }

    const payload = {
      slug: mode.kind === 'edit' ? mode.slug : slug.trim(),
      name: name.trim(),
      type,
      summary: summary.trim(),
      description: description.trim(),
      steps: cleanSteps,
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

      {/* Pipeline — every step (no canonical/custom distinction). All editable,
          movable in-category, removable. One step optionally flagged T-0. */}
      <section className="space-y-4">
        <header className="flex items-baseline justify-between gap-3 flex-wrap px-1">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Kroki szablonu
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pełna definicja pipeline'u. Każdy krok jest edytowalny i można go usunąć.
              Strzałki przesuwają w obrębie tej samej kategorii. Jeden krok można oznaczyć
              jako „T-0" (oś czasu na gantcie — zwykle nagrywka).
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums shrink-0">
            {totalSteps} kroków
          </span>
        </header>

        {(() => {
          // Walk steps once and emit per-category sections, computing global
          // step numbers as we go. Strict O(n) pass — categories without
          // any steps still render their header so the user can add into them.
          let runningOffset = 0;
          return CATEGORY_ORDER.map((cat) => {
            // Indices (in `steps[]`) of steps belonging to this category, in
            // their on-screen order.
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
                          onToggleT0={(v) => setT0Anchor(stepsIdx, v)}
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
  onToggleT0,
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
  onToggleT0: (v: boolean) => void;
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
        {step.isT0Anchor ? (
          <span
            className={`shrink-0 text-[9px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded border ${tone.chip}`}
            title="Krok-kotwica T-0 — oś czasu na gantcie"
          >
            T-0
          </span>
        ) : null}
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

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id={`t0-${step.id}`}
              checked={!!step.isT0Anchor}
              onChange={(e) => onToggleT0(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input"
            />
            <Label htmlFor={`t0-${step.id}`} className="text-[11px] cursor-pointer">
              Oznacz jako kotwicę T-0 (oś czasu w gantcie)
            </Label>
          </div>

          <div className="text-[10px] text-muted-foreground">
            <span className="font-mono">id: {step.id}</span>
          </div>
        </div>
      ) : null}
    </li>
  );
}
