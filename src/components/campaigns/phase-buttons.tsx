'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { updateCampaign } from '@/server/actions/campaigns';
import { CAMPAIGN_PHASES, type CampaignPhase } from '../../../drizzle/schema';

export function PhaseButtons({ id, current }: { id: number; current: CampaignPhase }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = (phase: CampaignPhase) => {
    if (phase === current) return;
    start(async () => {
      await updateCampaign(id, { phase });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-xs text-muted-foreground self-center mr-1">Faza:</span>
      {CAMPAIGN_PHASES.map((p) => (
        <Button
          key={p}
          variant={current === p ? 'default' : 'outline'}
          size="sm"
          onClick={() => set(p)}
          disabled={pending || current === p}
          className="h-7 text-xs"
        >
          {p}
        </Button>
      ))}
    </div>
  );
}
