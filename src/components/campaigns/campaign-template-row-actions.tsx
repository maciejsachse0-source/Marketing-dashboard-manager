'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Trash2 } from 'lucide-react';
import {
  deleteMarketingTemplate,
  duplicateMarketingTemplate,
} from '@/server/actions/campaign-templates';
import { Button } from '@/components/ui/button';

export function CampaignTemplateRowActions({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onDuplicate = () => {
    if (pending) return;
    startTransition(async () => {
      try {
        const t = await duplicateMarketingTemplate(slug);
        toast.success(`Sklonowano: "${t.name}"`);
        router.push(`/campaigns/templates/${t.slug}/edit`);
      } catch (e) {
        toast.error('Nie udało się sklonować', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const onDelete = () => {
    if (pending) return;
    if (!confirm(`Usunąć szablon "${name}"?\n\nIstniejące kampanie nie zostaną zmienione.`))
      return;
    startTransition(async () => {
      try {
        await deleteMarketingTemplate(slug);
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
      <Button
        variant="ghost"
        onClick={onDuplicate}
        disabled={pending}
        className="h-auto border-0 gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted ui-transition disabled:opacity-50"
        title="Sklonuj jako nowy szablon"
      >
        <Copy className="size-3" />
        Klonuj
      </Button>
      <Button
        variant="ghost"
        onClick={onDelete}
        disabled={pending}
        className="h-auto border-0 gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-muted-foreground hover:text-rose-700 hover:bg-rose-50 ui-transition disabled:opacity-50"
        title={`Usuń szablon "${name}"`}
      >
        <Trash2 className="size-3" />
        Usuń
      </Button>
    </div>
  );
}
