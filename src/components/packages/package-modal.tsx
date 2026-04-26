'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/copy-button';
import { PlatformPill, StatusPill } from '@/components/platforms-pills';
import type { Package, Platform } from '../../../drizzle/schema';
import { updatePackage, deletePackage } from '@/server/actions/packages';

export function PackageModal({
  pkg,
  open,
  onOpenChange,
}: {
  pkg: Package | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!pkg) return null;

  const setStatus = (status: 'draft' | 'ready' | 'published') => {
    startTransition(async () => {
      try {
        await updatePackage(pkg.id, { status });
        toast.success(`Status: ${status}`);
        router.refresh();
      } catch (e) {
        toast.error('Nie udało się zmienić statusu', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const remove = () => {
    if (!confirm(`Usunąć pakiet "${pkg.title}"?`)) return;
    startTransition(async () => {
      try {
        await deletePackage(pkg.id);
        toast.success(`Usunięto pakiet "${pkg.title}"`);
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Nie udało się usunąć', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{pkg.title}</span>
            <StatusPill status={pkg.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {pkg.cta ? (
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">CTA</div>
              <div className="text-sm">{pkg.cta}</div>
            </div>
          ) : null}

          {pkg.platforms.map((platform) => (
            <PlatformBlock
              key={platform}
              platform={platform}
              caption={pkg.captions[platform]}
              hashtags={pkg.hashtags[platform]}
            />
          ))}

          {pkg.assetPath ? (
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Asset
              </div>
              <code className="text-xs font-mono">{pkg.assetPath}</code>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground mr-2">Zmień status:</span>
            {(['draft', 'ready', 'published'] as const).map((s) => (
              <Button
                key={s}
                variant={pkg.status === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatus(s)}
                disabled={pending || pkg.status === s}
              >
                {s}
              </Button>
            ))}
            <a
              href={`/api/packages/${pkg.id}/zip`}
              download
              className="ml-auto inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-border hover:border-primary/40 hover:bg-primary/5 transition"
            >
              ⬇ Pobierz ZIP
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={pending}
              className="text-rose-400 hover:text-rose-300"
            >
              Usuń pakiet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlatformBlock({
  platform,
  caption,
  hashtags,
}: {
  platform: Platform;
  caption?: string;
  hashtags?: string[];
}) {
  const captionText = caption ?? '';
  const tagsText = hashtags?.length ? hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ') : '';
  const fullText = [captionText, tagsText].filter(Boolean).join('\n\n');

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/30">
        <PlatformPill platform={platform} full />
        <CopyButton text={fullText} label="Skopiuj caption + tagi" />
      </div>
      <div className="p-3 space-y-2">
        {captionText ? (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Caption ({captionText.length} znaków)
            </div>
            <p className="text-sm whitespace-pre-wrap">{captionText}</p>
          </div>
        ) : null}
        {tagsText ? (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Hashtagi ({hashtags?.length})
            </div>
            <p className="text-xs font-mono text-muted-foreground">{tagsText}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
