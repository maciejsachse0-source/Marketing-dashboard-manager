'use client';

import { useRouter } from 'next/navigation';
import { InlineEdit } from '@/components/inline-edit';
import { updateCampaign } from '@/server/actions/campaigns';

export function CampaignNameField({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  return (
    <InlineEdit
      value={name}
      onSave={async (next) => {
        if (!next) throw new Error('Nazwa nie może być pusta');
        await updateCampaign(id, { name: next });
        router.refresh();
      }}
      placeholder="Nazwa kampanii"
    />
  );
}

export function CampaignGoalField({ id, goal }: { id: number; goal: string }) {
  const router = useRouter();
  return (
    <InlineEdit
      value={goal}
      onSave={async (next) => {
        if (!next) throw new Error('Cel nie może być pusty');
        await updateCampaign(id, { goal: next });
        router.refresh();
      }}
      placeholder="Cel kampanii"
      multiline
    />
  );
}

export function CampaignNotesField({ id, notes }: { id: number; notes: string | null }) {
  const router = useRouter();
  return (
    <InlineEdit
      value={notes ?? ''}
      onSave={async (next) => {
        await updateCampaign(id, { notes: next || null });
        router.refresh();
      }}
      placeholder="Notatki kampanii (opcjonalne)"
      emptyHint="+ Dodaj notatki"
      multiline
      className="text-sm"
    />
  );
}
