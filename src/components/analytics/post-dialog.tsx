'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createPost } from '@/server/actions/posts';
import { PLATFORMS, type Platform } from '../../../drizzle/schema';
import { isoToInputLocal } from '@/lib/dates';

type FormState = {
  title: string;
  platform: Platform;
  publishedAt: string;
  caption: string;
  reach: string;
  engagementRate: string;
  completionRate: string;
  saves: string;
};

function initial(): FormState {
  return {
    title: '',
    platform: 'instagram',
    publishedAt: isoToInputLocal(new Date()),
    caption: '',
    reach: '',
    engagementRate: '',
    completionRate: '',
    saves: '',
  };
}

export function PostDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [form, setForm] = useState<FormState>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setForm(initial());
      setError(null);
    }
  }, [open]);

  const submit = () => {
    setError(null);
    if (!form.title.trim()) {
      setError('Tytuł nie może być pusty');
      return;
    }
    startTransition(async () => {
      try {
        const post = await createPost({
          title: form.title.trim(),
          platform: form.platform,
          publishedAt: new Date(form.publishedAt).toISOString(),
          caption: form.caption,
        });
        const metricsAny: {
          reach?: number;
          engagementRate?: number;
          completionRate?: number;
          saves?: number;
        } = {};
        if (form.reach) metricsAny.reach = Number(form.reach);
        if (form.engagementRate) metricsAny.engagementRate = Number(form.engagementRate);
        if (form.completionRate) metricsAny.completionRate = Number(form.completionRate);
        if (form.saves) metricsAny.saves = Number(form.saves);
        if (Object.keys(metricsAny).length > 0) {
          const { updatePostMetrics } = await import('@/server/actions/posts');
          await updatePostMetrics(post.id, metricsAny);
        }
        toast.success(`Dodano post #${post.id}`);
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error('Nie udało się dodać posta', { description: msg });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dodaj post manualnie</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="title">Tytuł / temat</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Platforma</Label>
              <div className="flex flex-wrap gap-1">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, platform: p })}
                    className={`px-2 py-1 text-xs rounded border transition ${
                      form.platform === p
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:border-foreground/40'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="publishedAt">Opublikowano</Label>
              <Input
                id="publishedAt"
                type="datetime-local"
                value={form.publishedAt}
                onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="caption">Caption (opcjonalnie)</Label>
            <Textarea
              id="caption"
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Reach</Label>
              <Input value={form.reach} onChange={(e) => setForm({ ...form, reach: e.target.value })} type="number" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">ER %</Label>
              <Input
                value={form.engagementRate}
                onChange={(e) => setForm({ ...form, engagementRate: e.target.value })}
                type="number"
                step="0.1"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Compl %</Label>
              <Input
                value={form.completionRate}
                onChange={(e) => setForm({ ...form, completionRate: e.target.value })}
                type="number"
                step="0.1"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Saves</Label>
              <Input value={form.saves} onChange={(e) => setForm({ ...form, saves: e.target.value })} type="number" />
            </div>
          </div>
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Anuluj
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? '...' : 'Zapisz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
