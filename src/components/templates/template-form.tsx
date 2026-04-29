'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTemplate, deleteTemplate, updateTemplate } from '@/server/actions/templates';
import {
  PRODUCTION_STAGES,
  PRODUCTION_TYPES,
  type ProductionStage,
  type ProductionStatus,
  type ProductionType,
} from '../../../drizzle/schema';
import { CANONICAL_STAGES_BY_CATEGORY } from '@/lib/category-sequence';
import { STAGE_LABEL } from '@/lib/production-stages';
import {
  CATEGORY_LABEL,
  FRAME_FOR_CATEGORY,
  FRAME_STYLE,
} from '@/lib/category-colors';
import type {
  ProductionTemplate,
  TemplateCustomStep,
} from '@/lib/production-templates-types';

const TYPE_LABEL: Record<ProductionType, string> = {
  'with-artist': 'Z artystą',
  solo: 'Solo',
};

type Mode = { kind: 'create' } | { kind: 'edit'; slug: string };

export function TemplateForm({ mode, initial }: { mode: Mode; initial?: ProductionTemplate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [type, setType] = useState<ProductionType>(initial?.type ?? 'with-artist');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [steps, setSteps] = useState<TemplateCustomStep[]>(initial?.customSteps ?? []);

  const totalSteps = 9 + steps.length;

  const updateStep = (i: number, patch: Partial<TemplateCustomStep>) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const removeStep = (i: number) =>
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const addStep = () => {
    // Default to first canonical of outreach so the user only has to type a label.
    const firstStage = CANONICAL_STAGES_BY_CATEGORY.outreach[0];
    setSteps((prev) => [
      ...prev,
      { category: 'outreach', label: '', positionAfter: firstStage, description: '' },
    ]);
  };

  const onSubmit = () => {
    setError(null);
    const cleanSteps: TemplateCustomStep[] = steps.map((s) => ({
      category: s.category,
      label: s.label.trim(),
      positionAfter: s.positionAfter,
      ...(s.description?.trim() ? { description: s.description.trim() } : {}),
    }));
    if (cleanSteps.some((s) => !s.label)) {
      setError('Każdy krok dodatkowy musi mieć etykietę.');
      return;
    }

    const payload = {
      slug: mode.kind === 'edit' ? mode.slug : slug.trim(),
      name: name.trim(),
      type,
      summary: summary.trim(),
      description: description.trim(),
      customSteps: cleanSteps,
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

      {/* Custom steps */}
      <section className="card-editorial p-5 space-y-4">
        <header className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Kroki dodatkowe
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              9 kanonicznych kroków zawsze w komplecie. Tu dodajesz dodatkowe — wskakują w wybranej
              kategorii, po wybranym etapie kanonicznym.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={addStep} type="button">
            <Plus className="w-3.5 h-3.5 mr-1" /> Dodaj krok
          </Button>
        </header>

        {steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Brak kroków dodatkowych — szablon używa wyłącznie standardowego pipeline&apos;u 9 kroków.
          </div>
        ) : (
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <StepRow
                key={i}
                index={i}
                total={steps.length}
                step={s}
                onChange={(patch) => updateStep(i, patch)}
                onRemove={() => removeStep(i)}
                onMoveUp={() => moveStep(i, -1)}
                onMoveDown={() => moveStep(i, 1)}
              />
            ))}
          </ol>
        )}
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

function StepRow({
  index,
  total,
  step,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  total: number;
  step: TemplateCustomStep;
  onChange: (patch: Partial<TemplateCustomStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  // positionAfter options depend on the chosen category — restrict to its
  // canonical stages so the user can't anchor outside the bucket.
  const positionOptions = useMemo<ProductionStatus[]>(
    () => CANONICAL_STAGES_BY_CATEGORY[step.category],
    [step.category],
  );

  // When category changes, snap positionAfter back to the first canonical of the
  // new category so we never persist an invalid anchor.
  const onChangeCategory = (cat: ProductionStage) => {
    const first = CANONICAL_STAGES_BY_CATEGORY[cat][0];
    onChange({ category: cat, positionAfter: first });
  };

  // Frame-tinted row — same T1/T2/T3 palette as the gantt strip and the
  // templates list. Solid colored left rail makes the bucket scannable at a
  // glance even when many rows stack vertically.
  const frame = FRAME_FOR_CATEGORY[step.category];
  const tone = FRAME_STYLE[frame];

  return (
    <li
      className={`relative rounded-lg border-2 ${tone.border} ${tone.bg} p-3.5 pl-4 space-y-3 group ui-transition`}
    >
      <span aria-hidden className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${tone.rail}`} />
      <div className="flex items-center gap-2">
        <span
          className={`grid place-items-center w-6 h-6 rounded-full text-[11px] font-bold tabular-nums text-white shrink-0 ${tone.dot}`}
          title={`${frame} · ${CATEGORY_LABEL[step.category]}`}
        >
          {index + 1}
        </span>
        <Input
          value={step.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Etykieta kroku — np. moodboard wizualny"
          maxLength={80}
          className="flex-1 bg-card"
        />
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
            title="Przesuń wyżej"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
            title="Przesuń niżej"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md hover:bg-rose-50 text-muted-foreground hover:text-rose-700 ui-transition"
            title="Usuń krok"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 pl-8">
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Kategoria
          </Label>
          <select
            value={step.category}
            onChange={(e) => onChangeCategory(e.target.value as ProductionStage)}
            className="rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PRODUCTION_STAGES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Po kroku kanonicznym
          </Label>
          <select
            value={step.positionAfter}
            onChange={(e) => onChange({ positionAfter: e.target.value as ProductionStatus })}
            className="rounded-md border border-input bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {positionOptions.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pl-8">
        <Input
          value={step.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Opis kroku (opcjonalnie) — co konkretnie zrobić"
          maxLength={500}
          className="text-sm"
        />
      </div>
    </li>
  );
}
