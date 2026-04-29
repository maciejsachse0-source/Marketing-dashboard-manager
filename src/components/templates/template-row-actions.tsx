'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Trash2 } from 'lucide-react';
import { deleteTemplate, duplicateTemplate } from '@/server/actions/templates';

export function TemplateRowActions({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onDuplicate = () => {
    if (pending) return;
    startTransition(async () => {
      try {
        const t = await duplicateTemplate(slug);
        toast.success(`Sklonowano: "${t.name}"`);
        router.push(`/templates/${t.slug}/edit`);
      } catch (e) {
        toast.error('Nie udało się sklonować', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const onDelete = () => {
    if (pending) return;
    if (!confirm(`Usunąć szablon "${name}"?\n\nIstniejące produkcje nie zostaną zmienione.`))
      return;
    startTransition(async () => {
      try {
        await deleteTemplate(slug);
        toast.success('Szablon usunięty');
        router.refresh();
      } catch (e) {
        toast.error('Nie udało się usunąć', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onDuplicate}
        disabled={pending}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted ui-transition disabled:opacity-50"
        title="Sklonuj jako nowy szablon"
      >
        <Copy className="w-3 h-3" />
        Klonuj
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-muted-foreground hover:text-rose-700 hover:bg-rose-50 ui-transition disabled:opacity-50"
        title={`Usuń szablon "${name}"`}
      >
        <Trash2 className="w-3 h-3" />
        Usuń
      </button>
    </div>
  );
}
