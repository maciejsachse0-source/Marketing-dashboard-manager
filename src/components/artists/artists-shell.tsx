'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArtistDialog } from './artist-dialog';
import type { Artist } from '../../../drizzle/schema';
import { useShortcut } from '@/lib/use-shortcut';

export type ArtistRow = {
  artist: Artist;
  collabCount: number;
  outreachFiles: { filename: string; path: string; modifiedAt: string }[];
};

export function ArtistsShell({ rows }: { rows: ArtistRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Artist | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (artist: Artist) => {
    setEditing(artist);
    setDialogOpen(true);
  };

  useShortcut('n', () => openCreate(), []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/30 border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">
                  Imię
                </th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">
                  Handle
                </th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground">
                  Ostatni kontakt
                </th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground text-right">
                  Kolaby
                </th>
                <th className="px-4 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground text-right">
                  Outreach
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ artist, collabCount, outreachFiles }) => {
                const isExpanded = expanded === artist.id;
                return (
                  <Fragment key={artist.id}>
                    <tr
                      className="hover:bg-muted/20 transition cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : artist.id)}
                    >
                      <td className="px-4 py-2 font-medium">{artist.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{artist.handle ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{artist.email ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {artist.lastContactAt
                          ? artist.lastContactAt.toLocaleDateString('pl-PL', { dateStyle: 'medium' })
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{collabCount}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{outreachFiles.length}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(artist);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          edytuj
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="bg-muted/10">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="font-medium text-muted-foreground uppercase tracking-wider mb-1.5 text-[10px]">
                                Notatki
                              </div>
                              <p className="whitespace-pre-wrap text-foreground/85">
                                {artist.notes ?? <span className="text-muted-foreground">brak</span>}
                              </p>
                              {artist.phone ? (
                                <p className="mt-2 text-muted-foreground">📞 {artist.phone}</p>
                              ) : null}
                            </div>
                            <div>
                              <div className="font-medium text-muted-foreground uppercase tracking-wider mb-1.5 text-[10px]">
                                Drafty outreach ({outreachFiles.length})
                              </div>
                              {outreachFiles.length === 0 ? (
                                <p className="text-muted-foreground">
                                  Brak. Wygeneruj przez{' '}
                                  <Link href="/agents/artist-outreach" className="underline">
                                    artist-outreach
                                  </Link>
                                  .
                                </p>
                              ) : (
                                <ul className="space-y-1">
                                  {outreachFiles.map((f) => (
                                    <li key={f.filename} className="font-mono text-[11px]">
                                      {f.filename}{' '}
                                      <span className="text-muted-foreground">
                                        ({new Date(f.modifiedAt).toLocaleDateString('pl-PL')})
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ArtistDialog open={dialogOpen} onOpenChange={setDialogOpen} artist={editing} />
    </div>
  );
}
