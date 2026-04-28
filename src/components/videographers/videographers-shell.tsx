'use client';

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { VideographerDialog } from './videographer-dialog';
import { PersonAvatar } from '@/components/productions/artist-avatar';
import { useShortcut } from '@/lib/use-shortcut';
import type { Videographer } from '../../../drizzle/schema';

export type VideographerRow = {
  videographer: Videographer;
  productionCount: number;
};

export function VideographersShell({ rows }: { rows: VideographerRow[] }) {
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

      {rows.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Brak kamerzystów w bazie"
          description="Dodaj kamerzystę, którego polecasz na nagrania kolab — przy tworzeniu produkcji wybierzesz go z listy."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Imię</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Kontakt</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground text-right">Stawka</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground text-right">Produkcje</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Sprzęt</th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">Dostępność</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ videographer: v, productionCount }) => (
                <tr key={v.id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-2.5 font-medium">
                    <span className="flex items-center gap-2.5">
                      <PersonAvatar name={v.name} imageUrl={v.avatarUrl} size="sm" kind="videographer" />
                      {v.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{v.contact ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {v.hourlyRate ? `${v.hourlyRate} zł/h` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {productionCount}
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
