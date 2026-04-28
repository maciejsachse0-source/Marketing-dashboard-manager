'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Phone, AtSign, Calendar, FileText, Pencil, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArtistDialog } from './artist-dialog';
import type { Artist } from '../../../drizzle/schema';
import { useShortcut } from '@/lib/use-shortcut';
import { InlineEdit } from '@/components/inline-edit';
import { updateArtist } from '@/server/actions/artists';
import { PersonAvatar } from '@/components/productions/artist-avatar';

export type ArtistRow = {
  artist: Artist;
  collabCount: number;
  outreachFiles: { filename: string; path: string; modifiedAt: string }[];
};

export function ArtistsShell({ rows }: { rows: ArtistRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Artist | null>(null);
  const [query, setQuery] = useState('');
  const router = useRouter();

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (artist: Artist) => {
    setEditing(artist);
    setDialogOpen(true);
  };

  useShortcut('n', () => openCreate(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ artist }) => {
      return (
        artist.name.toLowerCase().includes(q) ||
        artist.handle?.toLowerCase().includes(q) ||
        artist.email?.toLowerCase().includes(q) ||
        artist.notes?.toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie, handlu, emailu..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button size="sm" onClick={openCreate}>
          + Dodaj artystę
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Brak artystów. Dodaj pierwszego ręcznie albo przez{' '}
          <Link href="/agents/artist-outreach" className="underline">
            artist-outreach agenta
          </Link>
          .
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Brak wyników dla „{query}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ artist, collabCount, outreachFiles }) => (
            <ArtistCard
              key={artist.id}
              artist={artist}
              collabCount={collabCount}
              outreachFiles={outreachFiles}
              onEdit={() => openEdit(artist)}
              onSaveNotes={async (next) => {
                await updateArtist(artist.id, { notes: next || null });
                router.refresh();
              }}
            />
          ))}
        </div>
      )}

      <ArtistDialog open={dialogOpen} onOpenChange={setDialogOpen} artist={editing} />
    </div>
  );
}

function ArtistCard({
  artist,
  collabCount,
  outreachFiles,
  onEdit,
  onSaveNotes,
}: {
  artist: Artist;
  collabCount: number;
  outreachFiles: ArtistRow['outreachFiles'];
  onEdit: () => void;
  onSaveNotes: (next: string) => Promise<void>;
}) {
  const lastContact = artist.lastContactAt
    ? artist.lastContactAt.toLocaleDateString('pl-PL', { dateStyle: 'medium' })
    : null;

  return (
    <div className="group rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-foreground/20 transition flex flex-col">
      <div className="flex items-start gap-3">
        <PersonAvatar
          name={artist.name}
          seed={artist.handle ?? artist.name}
          imageUrl={artist.avatarUrl}
          size="xl"
          showBadge={false}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight truncate">{artist.name}</h3>
              {artist.handle ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                  <AtSign className="w-3 h-3 shrink-0" />
                  <span className="truncate">{artist.handle.replace(/^@/, '')}</span>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edytuj artystę"
              className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-foreground/85 leading-relaxed">
        <InlineEdit
          value={artist.notes ?? ''}
          multiline
          emptyHint="+ Dodaj opis"
          className="text-xs"
          onSave={onSaveNotes}
        />
      </div>

      {(artist.email || artist.phone) ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {artist.email ? (
            <a
              href={`mailto:${artist.email}`}
              className="flex items-center gap-1.5 hover:text-foreground truncate"
            >
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{artist.email}</span>
            </a>
          ) : null}
          {artist.phone ? (
            <a
              href={`tel:${artist.phone}`}
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <Phone className="w-3 h-3 shrink-0" />
              <span>{artist.phone}</span>
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 pt-3 border-t border-border flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1" title="Liczba kolaborów w kalendarzu">
          <Users className="w-3 h-3" />
          <span className="tabular-nums font-medium text-foreground">{collabCount}</span>
          <span>kolab</span>
        </span>
        <span className="flex items-center gap-1" title="Drafty outreach">
          <FileText className="w-3 h-3" />
          <span className="tabular-nums font-medium text-foreground">{outreachFiles.length}</span>
          <span>outreach</span>
        </span>
        {lastContact ? (
          <span className="flex items-center gap-1 ml-auto" title="Ostatni kontakt">
            <Calendar className="w-3 h-3" />
            <span>{lastContact}</span>
          </span>
        ) : null}
      </div>

      {outreachFiles.length > 0 ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            Drafty outreach ({outreachFiles.length})
          </summary>
          <ul className="mt-2 space-y-1 pl-1">
            {outreachFiles.slice(0, 5).map((f) => (
              <li key={f.filename} className="font-mono text-[11px] text-muted-foreground truncate">
                {f.filename}{' '}
                <span className="text-muted-foreground/70">
                  ({new Date(f.modifiedAt).toLocaleDateString('pl-PL')})
                </span>
              </li>
            ))}
            {outreachFiles.length > 5 ? (
              <li className="text-[11px] text-muted-foreground/70">
                + {outreachFiles.length - 5} więcej
              </li>
            ) : null}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
