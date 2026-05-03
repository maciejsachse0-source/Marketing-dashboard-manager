'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type {
  CalendarEntry,
  Production,
  ProductionPeriods,
  Artist,
} from '../../../drizzle/schema';
import type { TemplatePeriod } from '@/lib/production-periods';
import { updateCampaign } from '@/server/actions/campaigns';
import { CampaignTimeline } from './timeline';
import { CampaignPeriodsEditor } from './campaign-periods-editor';

type ProductionWithArtist = Production & {
  artist: Pick<Artist, 'id' | 'name' | 'handle'> | null;
};

/**
 * Glues the read-only timeline ("Wspólny plan kampanii") and the inline
 * periods editor below it via shared state. The slider mutations propagate
 * upward through `onPeriodsChange`, so the top narrative strip reflects each
 * drag in real time. Changing the kickoff anchor in the editor below also
 * persists `releaseAt` on the campaign — the date input used to be preview-
 * only and silently discarded the new value on refresh, which was confusing.
 */
export function CampaignNarrativeSection({
  campaignId,
  kickoffAt,
  initialPeriods,
  productions,
  entries,
}: {
  campaignId: number;
  kickoffAt: Date;
  initialPeriods: ProductionPeriods | null | undefined;
  productions: ProductionWithArtist[];
  entries: CalendarEntry[];
}) {
  const [livePeriods, setLivePeriods] = useState<TemplatePeriod[] | null>(
    (initialPeriods as TemplatePeriod[] | null | undefined) ?? null,
  );
  const [previewStart, setPreviewStart] = useState<Date>(kickoffAt);
  const [savingKickoff, startKickoffSave] = useTransition();
  const router = useRouter();

  const handleKickoffChange = (next: Date) => {
    // <input type="date"> only carries a date; preserve the existing
    // hours/minutes so a kickoff originally set to 09:00 doesn't slip to 00:00
    // just because the user retargeted the day.
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

  return (
    <>
      <CampaignTimeline
        kickoffAt={previewStart}
        periods={livePeriods}
        productions={productions}
        entries={entries}
      />
      <CampaignPeriodsEditor
        campaignId={campaignId}
        initialPeriods={initialPeriods as TemplatePeriod[] | null | undefined}
        kickoffAt={kickoffAt}
        onPeriodsChange={setLivePeriods}
        previewStart={previewStart}
        onPreviewStartChange={handleKickoffChange}
        kickoffSaving={savingKickoff}
      />
    </>
  );
}
