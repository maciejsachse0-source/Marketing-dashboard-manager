'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProductionWizard } from './production-wizard';
import { useShortcut } from '@/lib/use-shortcut';
import type { ProductionTemplate } from '@/lib/templates';

type ArtistOption = { id: number; name: string; handle: string | null };
type VideographerOption = { id: number; name: string; hourlyRate: number | null };

export function NewProductionButton({
  templates,
  artists,
  videographers,
  variant = 'default',
}: {
  templates: ProductionTemplate[];
  artists: ArtistOption[];
  videographers: VideographerOption[];
  variant?: 'default' | 'outline';
}) {
  const [open, setOpen] = useState(false);

  useShortcut('p', () => setOpen(true), []);

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        + Nowa produkcja
      </Button>
      <ProductionWizard
        open={open}
        onOpenChange={setOpen}
        templates={templates}
        artists={artists}
        videographers={videographers}
      />
    </>
  );
}
