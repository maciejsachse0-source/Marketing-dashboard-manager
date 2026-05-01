'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PeriodsSlider } from '@/components/periods-slider';
import { isoDate, parseIsoDate } from '@/lib/period-tones';
import {
  DEFAULT_PERIODS,
  MAX_PERIODS,
  MIN_PERIODS,
  PERIOD_OFFSET_MAX,
  codeForIndex,
  type TemplatePeriod,
} from '@/lib/production-periods';
import { updateCampaignPeriods } from '@/server/actions/campaigns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * Inline period editor on the campaign detail page. Lets the user move T1..Tn
 * around with sliders to shape the narrative arc (build-up → tension → reveal
 * → afterglow). Periods are anchored at `kickoffAt` (campaign start), not at
 * a release date — the campaign is a long-form vision, not a launch checklist.
 */
function migrateLegacy(input: TemplatePeriod[] | null | undefined): TemplatePeriod[] {
  if (!input || input.length === 0) return DEFAULT_PERIODS;
  const min = Math.min(...input.map((p) => p.startOffsetDays));
  const shift = min < 0 ? -min : 0;
  return input.map((p, i) => ({
    code: codeForIndex(i),
    startOffsetDays: Math.max(0, p.startOffsetDays + shift),
    endOffsetDays: Math.max(0, p.endOffsetDays + shift),
  }));
}

export function CampaignPeriodsEditor({
  campaignId,
  initialPeriods,
  kickoffAt,
}: {
  campaignId: number;
  initialPeriods: TemplatePeriod[] | null | undefined;
  /** Anchor date — the campaign's kickoff. Drives the slider's date axis so
   *  the user reads concrete days instead of raw offsets. */
  kickoffAt: Date;
}) {
  const [periods, setPeriods] = useState<TemplatePeriod[]>(() =>
    migrateLegacy(initialPeriods),
  );
  const [previewStart, setPreviewStart] = useState<Date>(kickoffAt);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  const updatePeriod = (idx: number, patch: Partial<TemplatePeriod>) => {
    setPeriods((prev) => {
      const next = prev.map((p, i) => (i === idx ? { ...p, ...patch } : p));
      setDirty(true);
      return next;
    });
  };

  const addPeriod = () => {
    setPeriods((prev) => {
      if (prev.length >= MAX_PERIODS) return prev;
      const last = prev[prev.length - 1];
      const start = last ? last.endOffsetDays + 1 : 0;
      const end = Math.min(PERIOD_OFFSET_MAX, start + 6);
      setDirty(true);
      return [
        ...prev,
        { code: codeForIndex(prev.length), startOffsetDays: start, endOffsetDays: end },
      ];
    });
  };

  const removePeriod = (idx: number) => {
    setPeriods((prev) => {
      if (prev.length <= MIN_PERIODS) return prev;
      const next = prev
        .filter((_, i) => i !== idx)
        .map((p, i) => ({ ...p, code: codeForIndex(i) }));
      setDirty(true);
      return next;
    });
  };

  const reset = () => {
    setPeriods(migrateLegacy(initialPeriods));
    setDirty(false);
  };

  const periodErrors: (string | null)[] = periods.map((p, i) => {
    if (p.startOffsetDays > p.endOffsetDays) return 'Początek po końcu';
    const prev = periods[i - 1];
    if (prev && prev.endOffsetDays >= p.startOffsetDays) {
      return `Nakłada się z ${prev.code}`;
    }
    return null;
  });

  const save = () => {
    if (periodErrors.some((e) => e !== null)) {
      toast.error('Popraw nakładające się okresy zanim zapiszesz.');
      return;
    }
    startTransition(async () => {
      try {
        await updateCampaignPeriods(campaignId, periods);
        toast.success('Zapisano timeline kampanii');
        setDirty(false);
      } catch (e) {
        toast.error('Nie udało się zapisać', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <section className="card-editorial p-5 space-y-4">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Timeline kampanii
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Przeciągaj okresy po osi, by kształtować rytm wizji — od pierwszych zapowiedzi
            po finał i afterglow. To NIE jest kalendarz produkcji jednej premiery, tylko
            mapa narracji, którą widz Twoich artystów ma poczuć od początku do końca.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={addPeriod}
            disabled={periods.length >= MAX_PERIODS}
          >
            <Plus className="w-3 h-3 mr-1" /> Dodaj okres
          </Button>
          {dirty ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={reset}
              disabled={pending}
              className="text-muted-foreground"
            >
              <RefreshCcw className="w-3 h-3 mr-1" />
              Cofnij
            </Button>
          ) : null}
          <Button type="button" size="xs" onClick={save} disabled={!dirty || pending}>
            <Save className="w-3 h-3 mr-1" />
            {pending ? 'Zapisuję…' : 'Zapisz'}
          </Button>
        </div>
      </header>

      <div className="grid gap-1.5">
        <Label
          htmlFor="campaign-preview-start"
          className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          Kotwica osi (podgląd dat — domyślnie data startu kampanii)
        </Label>
        <Input
          id="campaign-preview-start"
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
      />
    </section>
  );
}
