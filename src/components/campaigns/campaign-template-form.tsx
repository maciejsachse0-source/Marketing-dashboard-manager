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
import {
  createMarketingTemplate,
  deleteMarketingTemplate,
  updateMarketingTemplate,
} from '@/server/actions/campaign-templates';
import type {
  MarketingMilestone,
  MarketingSubmilestone,
  MarketingTemplate,
} from '@/lib/campaign-templates-types';
import { PeriodsSlider } from '@/components/periods-slider';
import { toneForIndex, isoDate, parseIsoDate } from '@/lib/period-tones';
import {
  DEFAULT_PERIODS,
  MAX_PERIODS,
  MIN_PERIODS,
  PERIOD_OFFSET_MAX,
  codeForIndex,
  type TemplatePeriod,
} from '@/lib/production-periods';
import {
  migrateLegacyPeriods,
  newId,
  nextMonday,
} from './campaign-template-form-utils';
import { fieldText } from '@/lib/utils';
import { MilestoneRow } from './campaign-milestone-row';

type Mode = { kind: 'create' } | { kind: 'edit'; slug: string };

export function CampaignTemplateForm({
  mode,
  initial,
}: {
  mode: Mode;
  initial?: MarketingTemplate;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const src: Partial<MarketingTemplate> = initial ?? {};
  const [name, setName] = useState(fieldText(src.name));
  const [slug, setSlug] = useState(fieldText(src.slug));
  const [summary, setSummary] = useState(fieldText(src.summary));
  const [description, setDescription] = useState(fieldText(src.description));
  const [milestones, setMilestones] = useState<MarketingMilestone[]>(src.milestones ?? []);
  const [periods, setPeriods] = useState<TemplatePeriod[]>(() =>
    migrateLegacyPeriods(src.periods),
  );
  const [previewStart, setPreviewStart] = useState<Date>(() => nextMonday());

  const totalSubs = milestones.reduce((s, m) => s + m.submilestones.length, 0);

  const updatePeriod = (idx: number, patch: Partial<TemplatePeriod>) => {
    setPeriods((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const resetPeriods = () => setPeriods(DEFAULT_PERIODS);

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

  /** Removing a period renumbers the rest. Milestones referencing the removed
   *  code or any code that shifts are remapped: the removed code's milestones
   *  fall back to the previous period (or T1 if removing the first); shifted
   *  codes get the new index-based code. */
  const removePeriod = (idx: number) => {
    setPeriods((prev) => {
      if (prev.length <= MIN_PERIODS) return prev;
      const removedCode = prev[idx].code;
      const survivors = prev
        .filter((_, i) => i !== idx)
        .map((p, i) => ({ ...p, code: codeForIndex(i) }));
      // Build old-code → new-code map, with the removed code redirected to
      // the previous period (or the new first period if we removed index 0).
      const remap = new Map<string, string>();
      let newIdx = 0;
      for (let i = 0; i < prev.length; i++) {
        if (i === idx) continue;
        remap.set(prev[i].code, codeForIndex(newIdx));
        newIdx++;
      }
      const fallback = idx === 0 ? codeForIndex(0) : codeForIndex(Math.max(0, idx - 1));
      remap.set(removedCode, fallback);
      setMilestones((mPrev) =>
        mPrev.map((m) => ({ ...m, period: remap.get(m.period) ?? fallback })),
      );
      return survivors;
    });
  };

  const periodErrors: (string | null)[] = periods.map((p, i) => {
    if (p.startOffsetDays > p.endOffsetDays) return 'Początek po końcu';
    const prev = periods[i - 1];
    if (prev && prev.endOffsetDays >= p.startOffsetDays) {
      return `Nakłada się z ${prev.code}`;
    }
    return null;
  });

  const updateMilestone = (idx: number, patch: Partial<MarketingMilestone>) => {
    setMilestones((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const removeMilestone = (idx: number) => {
    if (!confirm(`Usunąć milestone „${milestones[idx].label || 'bez etykiety'}"?`)) return;
    setMilestones((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveMilestoneInPeriod = (idx: number, direction: -1 | 1) => {
    setMilestones((prev) => {
      const target = prev[idx];
      if (!target) return prev;
      let neighborIdx = -1;
      if (direction === -1) {
        for (let i = idx - 1; i >= 0; i--) {
          if (prev[i].period === target.period) {
            neighborIdx = i;
            break;
          }
        }
      } else {
        for (let i = idx + 1; i < prev.length; i++) {
          if (prev[i].period === target.period) {
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

  const addMilestoneInPeriod = (period: string) => {
    setMilestones((prev) => {
      const newMilestone: MarketingMilestone = {
        id: newId('m'),
        period,
        label: '',
        submilestones: [],
      };
      // Position so milestones stay grouped by period order. Find the index
      // that sits after the last milestone in the current period (or the last
      // milestone in any earlier period if this period is empty).
      const periodOrder = periods.findIndex((p) => p.code === period);
      let boundary = prev.length;
      for (let i = 0; i < prev.length; i++) {
        const otherOrder = periods.findIndex((p) => p.code === prev[i].period);
        if (otherOrder > periodOrder) {
          boundary = i;
          break;
        }
      }
      return [...prev.slice(0, boundary), newMilestone, ...prev.slice(boundary)];
    });
  };

  const addSubmilestone = (mIdx: number) => {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === mIdx
          ? {
              ...m,
              submilestones: [...m.submilestones, { id: newId('s'), label: '' }],
            }
          : m,
      ),
    );
  };

  const updateSubmilestone = (
    mIdx: number,
    sIdx: number,
    patch: Partial<MarketingSubmilestone>,
  ) => {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === mIdx
          ? {
              ...m,
              submilestones: m.submilestones.map((s, j) =>
                j === sIdx ? { ...s, ...patch } : s,
              ),
            }
          : m,
      ),
    );
  };

  const removeSubmilestone = (mIdx: number, sIdx: number) => {
    setMilestones((prev) =>
      prev.map((m, i) =>
        i === mIdx
          ? { ...m, submilestones: m.submilestones.filter((_, j) => j !== sIdx) }
          : m,
      ),
    );
  };

  const moveSubmilestone = (mIdx: number, sIdx: number, direction: -1 | 1) => {
    setMilestones((prev) =>
      prev.map((m, i) => {
        if (i !== mIdx) return m;
        const target = sIdx + direction;
        if (target < 0 || target >= m.submilestones.length) return m;
        const next = [...m.submilestones];
        [next[sIdx], next[target]] = [next[target], next[sIdx]];
        return { ...m, submilestones: next };
      }),
    );
  };

  const onSubmit = () => {
    setError(null);
    const cleanMilestones: MarketingMilestone[] = milestones.map((m) => ({
      id: m.id,
      period: m.period,
      label: m.label.trim(),
      ...(m.description?.trim() ? { description: m.description.trim() } : {}),
      submilestones: m.submilestones.map(
        (s): MarketingSubmilestone => ({
          id: s.id,
          label: s.label.trim(),
          ...(s.description?.trim() ? { description: s.description.trim() } : {}),
        }),
      ),
    }));
    if (cleanMilestones.some((m) => !m.label)) {
      setError('Każdy milestone musi mieć etykietę.');
      return;
    }
    if (cleanMilestones.some((m) => m.submilestones.some((s) => !s.label))) {
      setError('Każdy submilestone musi mieć etykietę.');
      return;
    }
    if (cleanMilestones.length === 0) {
      setError('Szablon musi zawierać co najmniej jeden milestone.');
      return;
    }
    if (periodErrors.some((e) => e !== null)) {
      setError('Popraw nakładające się okresy zanim zapiszesz.');
      return;
    }

    const payload = {
      slug: mode.kind === 'edit' ? mode.slug : slug.trim(),
      name: name.trim(),
      summary: summary.trim(),
      description: description.trim(),
      periods,
      milestones: cleanMilestones,
    };

    startTransition(async () => {
      try {
        if (mode.kind === 'edit') {
          const t = await updateMarketingTemplate(mode.slug, payload);
          toast.success(`Zapisano szablon "${t.name}"`);
          router.push('/campaigns/templates');
          router.refresh();
        } else {
          const t = await createMarketingTemplate(payload);
          toast.success(`Utworzono szablon "${t.name}"`);
          router.push('/campaigns/templates');
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
    if (
      !confirm(
        `Usunąć szablon "${initial?.name ?? mode.slug}"?\n\nIstniejące kampanie nie zostaną zmienione.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteMarketingTemplate(mode.slug);
        toast.success('Szablon usunięty');
        router.push('/campaigns/templates');
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error('Nie udało się usunąć', { description: msg });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="card-editorial p-5 space-y-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Podstawy
          </h2>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
            {milestones.length} milestone&apos;ów, {totalSubs} sub.
          </span>
        </header>

        <div className="grid gap-1.5">
          <Label htmlFor="name">Nazwa szablonu</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Np. Premiera EP - kampania pełna"
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
          <Label htmlFor="summary">Krótki opis</Label>
          <Input
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Jedno zdanie - co wyróżnia tę kampanię"
            maxLength={200}
          />
          <p className="text-[10px] text-muted-foreground">
            Pokazany w kreatorze nowej kampanii. {summary.length}/200
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="description">Pełny opis</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Dla kogo, kiedy używać, czego się spodziewać po kampanii."
            maxLength={2000}
          />
          <p className="text-[10px] text-muted-foreground">
            Pokazany na karcie szablonu. {description.length}/2000
          </p>
        </div>
      </section>

      <section className="card-editorial p-5 space-y-4">
        <header className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Okresy kampanii (T1..Tn)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Każdy okres definiuje fazę wizji kampanii - np. T1 build-up, T2 odkrywanie,
              T3 reveal, T4 climax, T5 afterglow. Przeciągaj suwaki, by kształtować rytm
              opowieści. Możesz mieć od {MIN_PERIODS} do {MAX_PERIODS} okresów.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={addPeriod}
              disabled={periods.length >= MAX_PERIODS}
              className="bg-card"
            >
              <Plus className="w-3 h-3 mr-1" /> Dodaj okres
            </Button>
            <Button
              variant="ghost"
              onClick={resetPeriods}
              className="h-auto border-0 p-0 font-normal hover:bg-transparent text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground ui-transition"
            >
              Domyślne
            </Button>
          </div>
        </header>

        <div className="grid gap-1.5">
          <Label htmlFor="preview-start" className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Podgląd dat - kotwica osi (nie zapisywana w szablonie)
          </Label>
          <Input
            id="preview-start"
            type="date"
            value={isoDate(previewStart)}
            onChange={(e) => {
              const d = parseIsoDate(e.target.value);
              if (d) setPreviewStart(d);
            }}
            className="w-fit"
          />
        </div>

        <PeriodsSlider
          periods={periods}
          errors={periodErrors}
          previewStart={previewStart}
          onChange={updatePeriod}
          onRemove={removePeriod}
          canRemove={periods.length > MIN_PERIODS}
          editableNames
        />
      </section>

      <section className="space-y-4">
        <header className="flex items-baseline justify-between gap-3 flex-wrap px-1">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Kamienie milowe
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pod każdym okresem dodajesz milestone&apos;y wraz z opcjonalnymi
              submilestone&apos;ami. To one budują napięcie - w T1 zapowiedzi, w środku
              odkrywanie, w finale climax i afterglow.
            </p>
          </div>
        </header>

        {periods.map((period, idx) => {
          const indices: number[] = [];
          milestones.forEach((m, i) => {
            if (m.period === period.code) indices.push(i);
          });
          const tone = toneForIndex(idx);

          return (
            <div
              key={`${period.code}-${idx}`}
              className={`rounded-2xl border-2 ${tone.bg} p-4 sm:p-5 space-y-3`}
              style={{
                borderColor: 'rgba(0,0,0,0.08)',
              }}
            >
              <header className="flex items-center gap-2.5 flex-wrap">
                <span
                  className={`inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md text-[11px] font-bold tracking-[0.18em] tabular-nums ${tone.bar} ${tone.ink}`}
                >
                  {period.code}
                </span>
                <span className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${tone.ink}`}>
                  Okres {period.code}
                </span>
                <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                  {indices.length} milestone&apos;ów
                </span>
              </header>

              {indices.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-4 text-center text-[11px] text-muted-foreground">
                  Brak milestone&apos;ów w tym okresie.
                </div>
              ) : (
                <ol className="space-y-3">
                  {indices.map((mIdx, posInPeriod) => {
                    const m = milestones[mIdx];
                    return (
                      <MilestoneRow
                        key={m.id}
                        milestone={m}
                        canMoveUp={posInPeriod > 0}
                        canMoveDown={posInPeriod < indices.length - 1}
                        onChange={(patch) => updateMilestone(mIdx, patch)}
                        onRemove={() => removeMilestone(mIdx)}
                        onMoveUp={() => moveMilestoneInPeriod(mIdx, -1)}
                        onMoveDown={() => moveMilestoneInPeriod(mIdx, 1)}
                        onAddSub={() => addSubmilestone(mIdx)}
                        onUpdateSub={(sIdx, patch) => updateSubmilestone(mIdx, sIdx, patch)}
                        onRemoveSub={(sIdx) => removeSubmilestone(mIdx, sIdx)}
                        onMoveSub={(sIdx, dir) => moveSubmilestone(mIdx, sIdx, dir)}
                      />
                    );
                  })}
                </ol>
              )}

              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => addMilestoneInPeriod(period.code)}
                  className="bg-card"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Dodaj milestone do {period.code}
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
          href="/campaigns/templates"
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
