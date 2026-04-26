'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProductionWizard } from './production-wizard';
import { useShortcut } from '@/lib/use-shortcut';
import type { ProductionTemplate } from '@/lib/templates';

type ArtistOption = { id: number; name: string; handle: string | null };

export function NewProductionButton({
  templates,
  artists,
  variant = 'default',
}: {
  templates: ProductionTemplate[];
  artists: ArtistOption[];
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
      />
    </>
  );
}
