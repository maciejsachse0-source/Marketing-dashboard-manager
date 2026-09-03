'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTemplate, deleteTemplate, updateTemplate } from '@/server/actions/templates';
import { PRODUCTION_TYPES, type ProductionStage, type ProductionType } from '../../../drizzle/schema';
import { CATEGORY_LABEL, FRAME_FOR_CATEGORY, FRAME_STYLE } from '@/lib/category-colors';
import type { ProductionTemplate, TemplateStep } from '@/lib/production-templates-types';
import {
  DEFAULT_PERIODS,
  MAX_PERIODS,
  MIN_PERIODS,
  PERIOD_OFFSET_MAX,
  codeForIndex,
  type TemplatePeriod,
} from '@/lib/production-periods';
import {
  CATEGORY_ORDER,
  TYPE_LABEL,
  isoDate,
  migrateLegacyPeriods,
  newStepId,
  nextMonday,
  parseIsoDate,
} from './template-form-utils';
import { fieldText } from '@/lib/utils';
import { PeriodsSlider } from './template-periods-slider';
import { StepRow } from './template-step-row';

type Mode = { kind: 'create' } | { kind: 'edit'; slug: string };

export function TemplateForm({ mode, initial }: { mode: Mode; initial?: ProductionTemplate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const src: Partial<ProductionTemplate> = initial ?? {};
  const [name, setName] = useState(fieldText(src.name));
  const [slug, setSlug] = useState(fieldText(src.slug));
  const [type, setType] = useState<ProductionType>(src.type ?? 'with-artist');
  const [summary, setSummary] = useState(fieldText(src.summary));
  const [description, setDescription] = useState(fieldText(src.description));
  const [steps, setSteps] = useState<TemplateStep[]>(src.steps ?? []);
  const [periods, setPeriods] = useState<TemplatePeriod[]>(() =>
    migrateLegacyPeriods(src.periods),
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
          <span className="label-micro text-muted-foreground tabular-nums">
            łącznie {totalSteps} kroków
          </span>
        </header>

        <div className="grid gap-1.5">
          <Label htmlFor="name">Nazwa szablonu</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Np. Premiera EP - pełna kolaba"
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
              Tylko małe litery, cyfry i myślnik. Zostaw puste - wygenerujemy z nazwy.
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
              <Button
                variant="ghost"
                key={t}
                onClick={() => setType(t)}
                className={`h-auto bg-clip-border hover:bg-transparent hover:text-inherit px-4 py-2 rounded-lg border text-sm font-semibold ui-transition active:scale-[0.97] ${
                  type === t
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border hover:border-foreground/30 text-muted-foreground'
                }`}
              >
                {TYPE_LABEL[t]}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="summary">Krótki opis</Label>
          <Input
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Jedno zdanie - co wyróżnia ten szablon"
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
              jak długo każdy trwa - slidery dowolnie skracasz, wydłużasz,
              przesuwasz dzień po dniu. Warunek: kolejne okresy nie mogą się
              nakładać.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={resetPeriods}
            className="h-auto border-0 p-0 font-normal hover:bg-transparent label-micro text-muted-foreground hover:text-foreground ui-transition shrink-0"
          >
            Przywróć domyślne
          </Button>
        </header>

        <div className="flex flex-wrap items-end gap-3 pb-2 border-b border-border/40">
          <div className="grid gap-1">
            <Label htmlFor="preview-start" className="label-micro-wide text-muted-foreground">
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
            Tylko do podglądu - nie zapisuje się w szablonie. Realną datę
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
            <Plus className="size-3.5 mr-1" /> Dodaj okres
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
              Pełna definicja pipeline&apos;u. Każdy krok jest edytowalny i można go
              usunąć. Strzałki przesuwają w obrębie tej samej kategorii.
            </p>
          </div>
          <span className="label-micro text-muted-foreground tabular-nums shrink-0">
            {totalSteps} kroków
          </span>
        </header>

        {CATEGORY_ORDER.map((cat, catIdx) => {
          const indicesInCat: number[] = [];
          steps.forEach((s, i) => {
            if (s.category === cat) indicesInCat.push(i);
          });
          // Numeracja jest ciagla przez wszystkie kategorie, wiec pierwszy numer
          // w tej kategorii to liczba krokow ze wszystkich poprzednich plus jeden.
          // Liczone wprost z `steps`, a nie licznikiem przesuwanym w trakcie
          // mapowania: zmienna nadpisywana wewnatrz renderu jest tym, co widzi
          // `react-hooks/immutability`, i ma racje — przy powtorzonym renderze
          // fragmentu numeracja rozjechalaby sie bez zadnej zmiany danych.
          const startNumber =
            steps.filter((s) => CATEGORY_ORDER.slice(0, catIdx).includes(s.category))
              .length + 1;
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
                  className={`label-mini-wider font-semibold ${tone.accent}`}
                >
                  {CATEGORY_LABEL[cat]}
                </span>
                <span className="ml-auto label-micro text-muted-foreground tabular-nums">
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
                  <Plus className="size-3.5 mr-1" /> Dodaj krok do {CATEGORY_LABEL[cat]}
                </Button>
              </div>
            </div>
          );
        })}
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
              <Trash2 className="size-3.5 mr-1" />
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
