'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProductionWizard } from './production-wizard';
import { useShortcut } from '@/lib/use-shortcut';
import type { ProductionTemplate } from '@/lib/production-templates-types';

type ArtistOption = { id: number; name: string; handle: string | null };
type VideographerOption = { id: number; name: string; hourlyRate: number | null };

export function NewProductionButton({
  artists,
  videographers,
  templates,
  variant = 'default',
}: {
  artists: ArtistOption[];
  videographers: VideographerOption[];
  templates: ProductionTemplate[];
  variant?: 'default' | 'outline';
}) {
  const [open, setOpen] = useState(false);

  useShortcut('p', () => setOpen(true));

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        + Nowa produkcja
      </Button>
      <ProductionWizard
        open={open}
        onOpenChange={setOpen}
        artists={artists}
        videographers={videographers}
        templates={templates}
      />
    </>
  );
}
