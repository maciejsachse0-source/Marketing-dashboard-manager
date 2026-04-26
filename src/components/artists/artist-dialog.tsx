'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createArtist, updateArtist, deleteArtist } from '@/server/actions/artists';
import type { Artist } from '../../../drizzle/schema';

type FormState = {
  name: string;
  handle: string;
  email: string;
  phone: string;
  notes: string;
};

function initial(artist?: Artist | null): FormState {
  return {
    name: artist?.name ?? '',
    handle: artist?.handle ?? '',
    email: artist?.email ?? '',
    phone: artist?.phone ?? '',
    notes: artist?.notes ?? '',
  };
}

export function ArtistDialog({
  open,
  onOpenChange,
  artist,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  artist?: Artist | null;
}) {
  const [form, setForm] = useState<FormState>(() => initial(artist));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setForm(initial(artist));
      setError(null);
    }
  }, [open, artist]);

  const submit = () => {
    setError(null);
    const payload = {
      name: form.name.trim(),
      handle: form.handle.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (!payload.name) {
      setError('Imię nie może być puste');
      return;
    }
    startTransition(async () => {
      try {
        if (artist) {
          await updateArtist(artist.id, payload);
          toast.success('Zaktualizowano artystę');
        } else {
          const row = await createArtist(payload);
          toast.success(`Dodano artystę: ${row.name}`);
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
    if (!artist) return;
    if (!confirm(`Usunąć ${artist.name}?`)) return;
    startTransition(async () => {
      try {
        await deleteArtist(artist.id);
        toast.success(`Usunięto: ${artist.name}`);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{artist ? 'Edytuj artystę' : 'Nowy artysta'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Imię / Nazwa *</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="handle">Handle</Label>
            <Input id="handle" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="@nick" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notatki</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
        </div>
        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <div>
            {artist ? (
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
