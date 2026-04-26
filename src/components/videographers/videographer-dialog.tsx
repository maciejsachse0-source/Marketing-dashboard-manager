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
  createVideographer,
  updateVideographer,
  deleteVideographer,
} from '@/server/actions/videographers';
import type { Videographer } from '../../../drizzle/schema';

type FormState = {
  name: string;
  contact: string;
  hourlyRate: string;
  equipment: string;
  availabilityNotes: string;
  notes: string;
};

function initial(v?: Videographer | null): FormState {
  return {
    name: v?.name ?? '',
    contact: v?.contact ?? '',
    hourlyRate: v?.hourlyRate?.toString() ?? '',
    equipment: v?.equipment ?? '',
    availabilityNotes: v?.availabilityNotes ?? '',
    notes: v?.notes ?? '',
  };
}

export function VideographerDialog({
  open,
  onOpenChange,
  videographer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  videographer?: Videographer | null;
}) {
  const [form, setForm] = useState<FormState>(() => initial(videographer));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setForm(initial(videographer));
      setError(null);
    }
  }, [open, videographer]);

  const submit = () => {
    setError(null);
    const payload = {
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
      equipment: form.equipment.trim() || null,
      availabilityNotes: form.availabilityNotes.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (!payload.name) {
      setError('Imię nie może być puste');
      return;
    }
    if (form.hourlyRate && !Number.isFinite(Number(form.hourlyRate))) {
      setError('Stawka godzinowa musi być liczbą');
      return;
    }
    startTransition(async () => {
      try {
        if (videographer) {
          await updateVideographer(videographer.id, payload);
          toast.success('Zaktualizowano kamerzystę');
        } else {
          const row = await createVideographer(payload);
          toast.success(`Dodano: ${row.name}`);
        }
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error('Błąd', { description: msg });
      }
    });
  };

  const remove = () => {
    if (!videographer) return;
    if (!confirm(`Usunąć ${videographer.name}?`)) return;
    startTransition(async () => {
      try {
        await deleteVideographer(videographer.id);
        toast.success(`Usunięto: ${videographer.name}`);
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error('Błąd', { description: e instanceof Error ? e.message : String(e) });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{videographer ? 'Edytuj kamerzystę' : 'Nowy kamerzysta'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Imię / Nazwa *</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contact">Kontakt</Label>
            <Input
              id="contact"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="email / telefon / IG handle"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rate">Stawka godzinowa (PLN)</Label>
            <Input
              id="rate"
              type="number"
              step="10"
              value={form.hourlyRate}
              onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
              placeholder="np. 250"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="equipment">Sprzęt</Label>
            <Textarea
              id="equipment"
              value={form.equipment}
              onChange={(e) => setForm({ ...form, equipment: e.target.value })}
              rows={2}
              placeholder="Sony A7IV, gimbal, RØDE NTG5..."
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="avail">Dostępność</Label>
            <Textarea
              id="avail"
              value={form.availabilityNotes}
              onChange={(e) => setForm({ ...form, availabilityNotes: e.target.value })}
              rows={2}
              placeholder="np. weekendy + środy po 18:00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notatki</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
        </div>
        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <div>
            {videographer ? (
              <Button variant="ghost" onClick={remove} disabled={pending} className="text-rose-400 hover:text-rose-300">
                Usuń
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Anuluj
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? '...' : 'Zapisz'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
