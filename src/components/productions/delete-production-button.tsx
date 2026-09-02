'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteProduction } from '@/server/actions/productions';
import { Button } from '@/components/ui/button';

export function DeleteProductionButton({
  productionId,
  productionName,
  redirectTo = '/productions',
}: {
  productionId: number;
  productionName: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (pending) return;
    const ok = confirm(
      `Usunąć produkcję "${productionName}"?\n\nTej operacji nie można cofnąć. Powiązane wpisy w kalendarzu i posty zostaną odpięte (nie usunięte).`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteProduction(productionId);
        router.push(redirectTo);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[delete-production] failed', e);
        alert(`Nie udało się usunąć produkcji: ${msg}`);
      }
    });
  };

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={pending}
      className="h-auto bg-clip-border hover:text-inherit group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-200 bg-white text-rose-700 text-sm font-semibold hover:bg-rose-50 hover:border-rose-400 hover:shadow-sm hover:shadow-rose-200/50 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ui-transition"
      title={`Usuń produkcję "${productionName}"`}
    >
      <Trash2
        className="size-3.5 ui-transition group-hover:rotate-[-6deg] group-hover:scale-110"
        strokeWidth={2.25}
      />
      {pending ? 'Usuwam…' : 'Usuń produkcję'}
    </Button>
  );
}
