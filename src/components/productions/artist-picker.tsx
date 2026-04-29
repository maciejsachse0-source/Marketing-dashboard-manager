'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Mic, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { updateProduction } from '@/server/actions/productions';

export type ArtistOption = {
  id: number;
  name: string;
  handle: string | null;
};

export function ArtistPicker({
  productionId,
  currentArtistId,
  artists,
  variant = 'default',
}: {
  productionId: number;
  currentArtistId: number | null;
  artists: ArtistOption[];
  /** "warning" surfaces a high-contrast "missing artist" banner. */
  variant?: 'default' | 'warning';
}) {
  const [open, setOpen] = useState(variant === 'warning');
  const [pending, startTransition] = useTransition();

  const current = artists.find((a) => a.id === currentArtistId) ?? null;

  const assign = (artistId: number | null) => {
    if (artistId === currentArtistId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      try {
        await updateProduction(productionId, { artistId });
        toast.success(
          artistId
            ? `Przypisano artystę: ${artists.find((a) => a.id === artistId)?.name ?? ''}`
            : 'Usunięto przypisanie artysty',
        );
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error('Nie udało się zapisać', { description: msg });
      }
    });
  };

  const wrapperCls =
    variant === 'warning'
      ? 'rounded-xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3'
      : 'rounded-xl border border-border bg-card/60 p-4 space-y-3';

  return (
    <div className={wrapperCls}>
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-medium ${
            variant === 'warning' ? 'text-amber-900' : 'text-muted-foreground'
          }`}
        >
          <Mic className="w-3.5 h-3.5" strokeWidth={1.75} />
          Artysta
          {variant === 'warning' && !current ? (
            <span className="ml-1 text-[10px] uppercase tracking-[0.14em] text-amber-900 font-bold">
              · brak — przypisz
            </span>
          ) : null}
        </span>

        {current ? (
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--accent-blue-tint)] text-[var(--accent-blue)] text-xs font-medium">
            <span>{current.name}</span>
            {current.handle ? (
              <span className="opacity-70">{current.handle}</span>
            ) : null}
            <button
              type="button"
              onClick={() => assign(null)}
              disabled={pending}
              title="Usuń przypisanie"
              className="opacity-60 hover:opacity-100 transition disabled:opacity-30"
            >
              <X className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <span
            className={`text-xs italic ${
              variant === 'warning' ? 'text-amber-900' : 'text-muted-foreground'
            }`}
          >
            nie przypisano
          </span>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={pending}
          className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition disabled:opacity-50 ${
            variant === 'warning'
              ? 'border-amber-600 bg-amber-100 text-amber-900 hover:bg-amber-200'
              : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
          }`}
        >
          {current ? (
            <>
              zmień
              <ChevronDown
                className={`w-3 h-3 transition ${open ? 'rotate-180' : ''}`}
                strokeWidth={2}
              />
            </>
          ) : (
            <>
              <Plus className="w-3 h-3" strokeWidth={2.5} />
              przypisz
            </>
          )}
        </button>
      </div>

      {open ? (
        artists.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            Brak artystów w bazie.{' '}
            <Link
              href="/artists"
              className="text-[var(--accent-blue)] hover:underline font-medium"
            >
              Dodaj w /artists
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {artists.map((a) => {
                const active = a.id === currentArtistId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => assign(a.id)}
                    disabled={pending}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition disabled:opacity-50 ${
                      active
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                    }`}
                  >
                    {active ? <Check className="w-3 h-3" strokeWidth={2.5} /> : null}
                    <span>{a.name}</span>
                    {a.handle ? (
                      <span className="opacity-60">{a.handle}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-muted-foreground/80">
              Brakuje? Dodaj w{' '}
              <Link
                href="/artists"
                className="font-mono hover:text-foreground hover:underline"
              >
                /artists
              </Link>
              .
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
