'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import { updateCampaign, updateCampaignPeriods } from '@/server/actions/campaigns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * Inline period editor on the campaign detail page. Lets the user move T1..Tn
 * around with sliders to shape the narrative arc (build-up → tension → reveal
 * → afterglow). Periods are anchored at `kickoffAt` (campaign start), not at
 * a release date — the campaign is a long-form vision, not a launch checklist.
 */
/** Visible-window presets for the slider's horizon picker. `days = 0` means
 *  "auto-fit" (slider sizes itself to the periods). The other values let the
 *  user zoom out — useful when the campaign covers a quarter or a full year
 *  and you want to see the broader plan rhythm rather than just T1..Tn. */
const HORIZON_OPTIONS: { label: string; days: number; title: string }[] = [
  { label: 'Auto', days: 0, title: 'Dopasuj do okresów' },
  { label: '4 tyg.', days: 28, title: '4 tygodnie od kotwicy' },
  { label: '8 tyg.', days: 56, title: '8 tygodni od kotwicy' },
  { label: '12 tyg.', days: 84, title: '12 tygodni (kwartał)' },
  { label: '24 tyg.', days: 168, title: '24 tygodnie (pół roku)' },
  { label: '52 tyg.', days: 364, title: '52 tygodnie (rok)' },
];

function migrateLegacy(input: TemplatePeriod[] | null | undefined): TemplatePeriod[] {
  if (!input || input.length === 0) return DEFAULT_PERIODS;
  const min = Math.min(...input.map((p) => p.startOffsetDays));
  const shift = min < 0 ? -min : 0;
  return input.map((p, i) => ({
    code: codeForIndex(i),
    name: p.name,
    startOffsetDays: Math.max(0, p.startOffsetDays + shift),
    endOffsetDays: Math.max(0, p.endOffsetDays + shift),
  }));
}

export function CampaignPeriodsEditor({
  campaignId,
  initialPeriods,
  kickoffAt,
  onPeriodsChange,
  onPreviewStartChange,
}: {
  campaignId: number;
  initialPeriods: TemplatePeriod[] | null | undefined;
  /** Anchor date — the campaign's kickoff. Drives the slider's date axis so
   *  the user reads concrete days instead of raw offsets. The editor also
   *  persists changes to this date back to `campaign.releaseAt`. */
  kickoffAt: Date;
  /** Optional live-preview hook: fires on every period mutation so a parent
   *  can mirror the in-progress edits in another part of the UI (e.g. the
   *  campaign timeline above this editor). */
  onPeriodsChange?: (periods: TemplatePeriod[]) => void;
  /** Optional live-preview hook for the kickoff anchor — fires immediately
   *  when the user picks a new date in the input, BEFORE the persistence
   *  round-trip completes. Used by the campaign-detail page so the upper
   *  CampaignTimeline reflects the new anchor without waiting for refresh.
   *  Editor still owns the actual save — the parent only mirrors. */
  onPreviewStartChange?: (d: Date) => void;
}) {
  const router = useRouter();
  const [periods, setPeriods] = useState<TemplatePeriod[]>(() =>
    migrateLegacy(initialPeriods),
  );
  // Local optimistic mirror of `kickoffAt`. Stays in sync with the prop when
  // the server resends a fresh value (after our own save → router.refresh,
  // OR after an external edit). The .getTime() dep keeps the comparison
  // stable across new Date() instances representing the same moment.
  const [previewStart, setPreviewStartState] = useState<Date>(kickoffAt);
  useEffect(() => {
    setPreviewStartState(kickoffAt);
  }, [kickoffAt.getTime()]);
  const [kickoffSaving, startKickoffSave] = useTransition();
  const setPreviewStart = (d: Date) => {
    setPreviewStartState(d);
    onPreviewStartChange?.(d);
  };

  /**
   * Persist a new kickoff date. The HTML date input only carries the date
   * portion, so we splice in the existing hours/minutes — a campaign created
   * with a 09:00 kickoff doesn't suddenly slip to 00:00 because the user
   * retargeted the day. The slider geometry stays put: periods are stored as
   * day offsets, so changing the anchor only relabels the date axis without
   * shifting the bands' relative positions.
   */
  const handleKickoffChange = (next: Date) => {
    const merged = new Date(next);
    merged.setHours(
      kickoffAt.getHours(),
      kickoffAt.getMinutes(),
      kickoffAt.getSeconds(),
      kickoffAt.getMilliseconds(),
    );
    setPreviewStart(merged);
    startKickoffSave(async () => {
      try {
        await updateCampaign(campaignId, { releaseAt: merged.toISOString() });
        toast.success('Zaktualizowano datę startu kampanii');
        router.refresh();
      } catch (e) {
        toast.error('Nie udało się zapisać daty', {
          description: e instanceof Error ? e.message : String(e),
        });
        setPreviewStart(kickoffAt);
      }
    });
  };
  // 0 = auto-fit (current behavior); positive = explicit visible window in
  // days. Lets the user "zoom out" to see the broader plan or "zoom in" to
  // a tight 4-week view. Persisted only in component state — it's a viewing
  // preference, not a campaign attribute.
  const [horizonDays, setHorizonDays] = useState<number>(0);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  const onPeriodsChangeRef = useRef(onPeriodsChange);
  onPeriodsChangeRef.current = onPeriodsChange;
  useEffect(() => {
    onPeriodsChangeRef.current?.(periods);
  }, [periods]);

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
            Edycja okresów narracji
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Klik w nazwę przy każdym okresie, by ją zmienić (np. „Build-up", „Reveal");
            klik w pole pod paskiem otwiera opis — co chcesz w tej fazie powiedzieć
            widzowi. Przeciągaj kotwice po osi, by kształtować rytm wizji.
            Wynik widać u góry na „Wspólnym planie kampanii".
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

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label
            htmlFor="campaign-preview-start"
            className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
          >
            Data startu kampanii (kotwica osi){' '}
            {kickoffSaving ? (
              <span className="ml-1 text-foreground normal-case tracking-normal">
                · zapisuję…
              </span>
            ) : null}
          </Label>
          <Input
            id="campaign-preview-start"
            type="date"
            value={isoDate(previewStart)}
            onChange={(e) => {
              const d = parseIsoDate(e.target.value);
              if (d) handleKickoffChange(d);
            }}
            disabled={kickoffSaving}
            className="w-fit"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Horyzont kalendarza (jak daleko widać oś)
          </Label>
          <div className="flex flex-wrap gap-1">
            {HORIZON_OPTIONS.map((opt) => {
              const active = horizonDays === opt.days;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setHorizonDays(opt.days)}
                  className={`px-2 py-1 rounded border text-[11px] font-medium tracking-tight ui-transition ${
                    active
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
                  }`}
                  title={opt.title}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <PeriodsSlider
        periods={periods}
        errors={periodErrors}
        previewStart={previewStart}
        onChange={updatePeriod}
        onRemove={removePeriod}
        canRemove={periods.length > MIN_PERIODS}
        editableNames
        horizonDays={horizonDays || undefined}
      />
    </section>
  );
}
