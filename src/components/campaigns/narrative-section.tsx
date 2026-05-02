'use client';

import { useState } from 'react';
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
 * periods editor below it via shared state. The slider mutations propagate
 * upward through `onPeriodsChange`, so the top narrative strip reflects each
 * drag in real time. The editor's "kotwica osi" date input is also lifted
 * here, so retargeting the kickoff anchor reflows the bands above without
 * a save round-trip.
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
        onPreviewStartChange={setPreviewStart}
      />
    </>
  );
}
