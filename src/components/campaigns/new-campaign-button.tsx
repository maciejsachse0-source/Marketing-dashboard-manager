'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CampaignWizard } from './campaign-wizard';
import type { MarketingTemplate } from '@/lib/campaign-templates-types';

export function NewCampaignButton({
  templates,
  variant = 'default',
}: {
  templates: MarketingTemplate[];
  variant?: 'default' | 'outline';
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" /> Nowa kampania
      </Button>
      <CampaignWizard open={open} onOpenChange={setOpen} templates={templates} />
    </>
  );
}
