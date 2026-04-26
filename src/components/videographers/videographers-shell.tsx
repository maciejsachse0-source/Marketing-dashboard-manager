'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { VideographerDialog } from './videographer-dialog';
import { useShortcut } from '@/lib/use-shortcut';
import type { Videographer } from '../../../drizzle/schema';

export function VideographersShell({ videographers }: { videographers: Videographer[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Videographer | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (v: Videographer) => {
    setEditing(v);
    setDialogOpen(true);
  };

  useShortcut('n', () => openCreate(), []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          + Dodaj kamerzystę
        </Button>
      </div>

      {videographers.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Brak kamerzystów w bazie"
          description="Dodaj kamerzystę, którego polecasz na nagrania kolab — przy tworzeniu produkcji wybierzesz go z listy."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Imię</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Kontakt</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground text-right">Stawka</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Sprzęt</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Dostępność</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {videographers.map((v) => (
                <tr key={v.id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-2.5 font-medium">{v.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{v.contact ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {v.hourlyRate ? `${v.hourlyRate} zł/h` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-xs">
                    {v.equipment ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-xs">
                    {v.availabilityNotes ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(v)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      edytuj
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VideographerDialog open={dialogOpen} onOpenChange={setDialogOpen} videographer={editing} />
    </div>
  );
}
