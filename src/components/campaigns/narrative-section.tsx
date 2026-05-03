'use client';

import { useEffect, useState } from 'react';
import type {
  CalendarEntry,
  Production,
  ProductionPeriods,
  Artist,
} from '../../../drizzle/schema';
import type { TemplatePeriod } from '@/lib/production-periods';
import { CampaignTimeline } from './timeline';
import { CampaignPeriodsEditor } from './campaign-periods-editor';

type ProductionWithArtist = Production & {
  artist: Pick<Artist, 'id' | 'name' | 'handle'> | null;
};

/**
 * Glues the read-only timeline ("Wspólny plan kampanii") and the inline
 * periods editor below it via shared state. Slider drags propagate through
 * `onPeriodsChange` so the upper strip reflects each band edit live; the
 * kickoff date input in the editor propagates through `onPreviewStartChange`
 * so the upper strip's date axis re-anchors immediately, before the editor's
 * own save round-trip finishes.
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
  const [livePreviewStart, setLivePreviewStart] = useState<Date>(kickoffAt);
  // Resync after server-side updates (e.g. the editor's save → router.refresh).
  useEffect(() => {
    setLivePreviewStart(kickoffAt);
  }, [kickoffAt.getTime()]);

  return (
    <>
      <CampaignTimeline
        kickoffAt={livePreviewStart}
        periods={livePeriods}
        productions={productions}
        entries={entries}
      />
      <CampaignPeriodsEditor
        campaignId={campaignId}
        initialPeriods={initialPeriods as TemplatePeriod[] | null | undefined}
        kickoffAt={kickoffAt}
        onPeriodsChange={setLivePeriods}
        onPreviewStartChange={setLivePreviewStart}
      />
    </>
  );
}
