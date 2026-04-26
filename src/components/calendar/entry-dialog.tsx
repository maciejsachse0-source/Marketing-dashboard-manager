'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  CALENDAR_TYPES,
  PLATFORMS,
  CALENDAR_STATUSES,
  type CalendarEntry,
  type CalendarType,
  type Platform,
  type CalendarStatus,
} from '../../../drizzle/schema';
import { TYPE_LABEL } from './type-color';
import {
  createCalendarEntry,
  updateCalendarEntry,
  deleteCalendarEntry,
} from '@/server/actions/calendar';
import { isoToInputLocal } from '@/lib/dates';

export type EntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: CalendarEntry | null;
  defaultStart?: Date;
};

type FormState = {
  type: CalendarType;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  platforms: Platform[];
  status: CalendarStatus;
};

function initial(entry?: CalendarEntry | null, defaultStart?: Date): FormState {
  if (entry) {
    return {
      type: entry.type,
      title: entry.title,
      description: entry.description ?? '',
      startsAt: isoToInputLocal(entry.startsAt),
      endsAt: isoToInputLocal(entry.endsAt),
      platforms: entry.platforms ?? [],
      status: entry.status,
    };
  }
  const start = defaultStart ?? new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    type: 'shoot',
    title: '',
    description: '',
    startsAt: isoToInputLocal(start),
    endsAt: isoToInputLocal(end),
    platforms: [],
    status: 'planned',
  };
}

export function EntryDialog({ open, onOpenChange, entry, defaultStart }: EntryDialogProps) {
  const [form, setForm] = useState<FormState>(() => initial(entry, defaultStart));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setForm(initial(entry, defaultStart));
      setError(null);
    }
  }, [open, entry, defaultStart]);

  const togglePlatform = (p: Platform) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p],
    }));
  };

  const submit = () => {
    setError(null);
    const payload = {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      platforms: form.platforms.length ? form.platforms : null,
      status: form.status,
    };
    if (!payload.title) {
      setError('Tytuł nie może być pusty');
      return;
    }
    if (Date.parse(payload.endsAt) <= Date.parse(payload.startsAt)) {
      setError('Koniec musi być po początku');
      return;
    }
    startTransition(async () => {
      try {
        if (entry) {
          await updateCalendarEntry({ id: entry.id, ...payload });
          toast.success('Zapisano zmiany');
        } else {
          const row = await createCalendarEntry(payload);
          toast.success(`Dodano wpis #${row.id}`);
        }
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error('Nie udało się zapisać', { description: msg });
      }
    });
  };

  const remove = () => {
    if (!entry) return;
    if (!confirm('Usunąć ten wpis?')) return;
    startTransition(async () => {
      try {
        await deleteCalendarEntry(entry.id);
        toast.success('Usunięto wpis');
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error('Nie udało się usunąć', { description: msg });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edytuj wpis' : 'Nowy wpis'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Typ</Label>
              <div className="flex flex-wrap gap-1">
                {CALENDAR_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`px-2.5 py-1 text-xs rounded border transition ${
                      form.type === t
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:border-foreground/40'
                    }`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <div className="flex gap-1">
                {CALENDAR_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={`px-2.5 py-1 text-xs rounded border transition ${
                      form.status === s
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:border-foreground/40'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="title">Tytuł</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Np. Nagranie BTS — sesja w studio"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="startsAt">Start</Label>
              <Input
                id="startsAt"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="endsAt">Koniec</Label>
              <Input
                id="endsAt"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Platformy {form.type === 'publish' ? '(wymagane dla publikacji)' : '(opcjonalnie)'}</Label>
            <div className="flex flex-wrap gap-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-2.5 py-1 text-xs rounded border transition ${
                    form.platforms.includes(p)
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
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Opcjonalny kontekst, lokacja, propsy..."
              rows={3}
            />
          </div>

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <div>
            {entry ? (
              <Button variant="ghost" onClick={remove} disabled={pending} className="text-rose-600 hover:text-rose-700">
                Usuń
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Anuluj
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
