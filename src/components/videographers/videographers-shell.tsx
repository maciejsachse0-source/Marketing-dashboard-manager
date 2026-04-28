'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Wallet, Calendar, Pencil, Search, Film, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/empty-state';
import { VideographerDialog } from './videographer-dialog';
import { PersonAvatar } from '@/components/productions/artist-avatar';
import { InlineEdit } from '@/components/inline-edit';
import { useShortcut } from '@/lib/use-shortcut';
import { updateVideographer } from '@/server/actions/videographers';
import type { Videographer } from '../../../drizzle/schema';

export type VideographerRow = {
  videographer: Videographer;
  productionCount: number;
};

export function VideographersShell({ rows }: { rows: VideographerRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Videographer | null>(null);
  const [query, setQuery] = useState('');
  const router = useRouter();

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (v: Videographer) => {
    setEditing(v);
    setDialogOpen(true);
  };

  useShortcut('n', () => openCreate(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ videographer: v }) => {
      return (
        v.name.toLowerCase().includes(q) ||
        v.contact?.toLowerCase().includes(q) ||
        v.equipment?.toLowerCase().includes(q) ||
        v.availabilityNotes?.toLowerCase().includes(q) ||
        v.notes?.toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie, kontakcie, sprzęcie..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
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
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Brak wyników dla „{query}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ videographer, productionCount }) => (
            <VideographerCard
              key={videographer.id}
              videographer={videographer}
              productionCount={productionCount}
              onEdit={() => openEdit(videographer)}
              onSaveNotes={async (next) => {
                await updateVideographer(videographer.id, { notes: next || null });
                router.refresh();
              }}
            />
          ))}
        </div>
      )}

      <VideographerDialog open={dialogOpen} onOpenChange={setDialogOpen} videographer={editing} />
    </div>
  );
}

function VideographerCard({
  videographer: v,
  productionCount,
  onEdit,
  onSaveNotes,
}: {
  videographer: Videographer;
  productionCount: number;
  onEdit: () => void;
  onSaveNotes: (next: string) => Promise<void>;
}) {
  const isEmail = v.contact?.includes('@');
  const ContactIcon = isEmail ? Mail : Camera;

  return (
    <div className="group rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-foreground/20 transition flex flex-col">
      <div className="flex items-start gap-3">
        <PersonAvatar
          name={v.name}
          imageUrl={v.avatarUrl}
          size="xl"
          kind="videographer"
          showBadge={false}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight truncate">{v.name}</h3>
              {v.hourlyRate ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Wallet className="w-3 h-3 shrink-0" />
                  <span className="tabular-nums">{v.hourlyRate} zł/h</span>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edytuj kamerzystę"
              className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-foreground/85 leading-relaxed">
        <InlineEdit
          value={v.notes ?? ''}
          multiline
          emptyHint="+ Dodaj opis"
          className="text-xs"
          onSave={onSaveNotes}
        />
      </div>

      {v.contact ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 truncate">
            <ContactIcon className="w-3 h-3 shrink-0" />
            <span className="truncate">{v.contact}</span>
          </span>
        </div>
      ) : null}

      {v.equipment ? (
        <div className="mt-3 text-xs">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">Sprzęt</p>
          <p className="text-foreground/85 leading-relaxed line-clamp-2">{v.equipment}</p>
        </div>
      ) : null}

      {v.availabilityNotes ? (
        <div className="mt-3 text-xs">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Dostępność
          </p>
          <p className="text-foreground/85 leading-relaxed line-clamp-2">{v.availabilityNotes}</p>
        </div>
      ) : null}

      <div className="mt-4 pt-3 border-t border-border flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title="Liczba produkcji">
          <Film className="w-3 h-3" />
          <span className="tabular-nums font-medium text-foreground">{productionCount}</span>
          <span>produkcji</span>
        </span>
      </div>
    </div>
  );
}
