'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteProduction } from '@/server/actions/productions';

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
        console.error('[delete-production] failed', e);
        alert('Nie udało się usunąć produkcji. Spróbuj ponownie.');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-200 bg-white text-rose-700 text-sm font-semibold hover:bg-rose-50 hover:border-rose-400 hover:shadow-sm hover:shadow-rose-200/50 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ui-transition"
      title={`Usuń produkcję "${productionName}"`}
    >
      <Trash2
        className="w-3.5 h-3.5 ui-transition group-hover:rotate-[-6deg] group-hover:scale-110"
        strokeWidth={2.25}
      />
      {pending ? 'Usuwam…' : 'Usuń produkcję'}
    </button>
  );
}
