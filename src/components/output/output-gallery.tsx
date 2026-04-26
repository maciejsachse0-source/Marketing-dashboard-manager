'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Folder, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/copy-button';
import { PlatformPill } from '@/components/platforms-pills';
import { ProductionStatusPill, ProductionTypeBadge } from '@/components/productions/status-pill';
import { regenerateOutputFolder } from '@/server/actions/productions';
import type { Platform, ProductionStatus } from '../../../drizzle/schema';

export type OutputItem = {
  productionId: number;
  title: string;
  status: ProductionStatus;
  type: 'with-artist' | 'solo';
  t0At: string;
  folderPath: string;
  videoPath: string | null;
  thumbnailPath: string | null;
  platforms: Platform[];
  captions: Partial<Record<Platform, string>>;
};

export function OutputGallery({ items }: { items: OutputItem[] }) {
  const [selected, setSelected] = useState<OutputItem | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const regen = (id: number) => {
    startTransition(async () => {
      try {
        const r = await regenerateOutputFolder(id);
        toast.success('Folder zregenerowany', { description: r.folderPath });
        router.refresh();
      } catch (e) {
        toast.error('Błąd regeneracji', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 px-6 py-12 text-center">
        <div className="w-10 h-10 rounded-full bg-muted/40 grid place-items-center mx-auto mb-3">
          <Folder className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium">Brak folderów publikacyjnych</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Folder generuje się automatycznie po zmianie statusu produkcji na <code className="font-mono">approved</code>.
          Idź do <Link href="/productions" className="underline">produkcji</Link> i zaznacz jakąś jako gotową.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => (
          <button
            key={item.productionId}
            type="button"
            onClick={() => setSelected(item)}
            className="text-left rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition group"
          >
            <div className="aspect-video bg-muted/40 grid place-items-center text-muted-foreground/40 relative">
              {item.thumbnailPath ? (
                <span className="text-xs">[{item.thumbnailPath.split('/').pop()}]</span>
              ) : item.videoPath ? (
                <span className="text-xs flex flex-col items-center gap-1">
                  <Folder className="w-6 h-6" strokeWidth={1.5} />
                  {item.videoPath.split('/').pop()}
                </span>
              ) : (
                <span className="text-xs">brak wideo</span>
              )}
            </div>
            <div className="p-3 space-y-2">
              <div className="font-medium text-sm truncate">{item.title}</div>
              <div className="flex flex-wrap gap-1.5">
                <ProductionTypeBadge type={item.type} />
                <ProductionStatusPill status={item.status} />
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(item.t0At).toLocaleDateString('pl-PL', { dateStyle: 'medium' })}
              </div>
              <div className="flex flex-wrap gap-1">
                {item.platforms.map((p) => (
                  <PlatformPill key={p} platform={p} />
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => (!open ? setSelected(null) : null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 pr-8">
                  <span>{selected.title}</span>
                  <ProductionStatusPill status={selected.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="py-2 space-y-4">
                <section className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Folder
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono break-all flex-1">{selected.folderPath}</code>
                    <CopyButton text={selected.folderPath} label="Skopiuj ścieżkę" />
                  </div>
                  {selected.videoPath ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Wideo: <code className="font-mono">{selected.videoPath}</code>
                    </div>
                  ) : null}
                </section>

                {selected.platforms.map((platform) => {
                  const content = selected.captions[platform];
                  return (
                    <section key={platform} className="rounded-md border border-border bg-card overflow-hidden">
                      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/30">
                        <PlatformPill platform={platform} full />
                        {content ? (
                          <CopyButton text={content} label="Skopiuj caption + tagi" />
                        ) : null}
                      </div>
                      <div className="p-3 text-sm whitespace-pre-wrap">
                        {content ?? <span className="text-muted-foreground italic">brak caption.md</span>}
                      </div>
                    </section>
                  );
                })}

                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <Link
                    href={`/productions/${selected.productionId}`}
                    className="text-xs px-3 py-1.5 rounded border border-border hover:border-foreground/40 transition"
                  >
                    Pełny widok produkcji
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => regen(selected.productionId)}
                    disabled={pending}
                    className="ml-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
                    {pending ? 'Regenerowanie…' : 'Zregeneruj folder'}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
