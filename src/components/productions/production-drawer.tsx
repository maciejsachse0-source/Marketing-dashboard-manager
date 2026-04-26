'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import {
  ProductionStatusPill,
  ProductionTypeBadge,
} from './status-pill';
import { ProductionStatusButtons, ProductionStatusPicker } from './status-buttons';
import { TYPE_LABEL } from '../calendar/type-color';
import { PlatformPills, StatusPill } from '@/components/platforms-pills';
import { getProductionByEntryId } from '@/server/actions/productions';
import type {
  CalendarEntry,
  Production,
  Package,
  Post,
  Artist,
  Campaign,
} from '../../../drizzle/schema';

type Bundle = {
  production: Production;
  entries: CalendarEntry[];
  packages: Package[];
  posts: Post[];
  artist: Artist | null | undefined;
  campaign: Campaign | null | undefined;
};

export function ProductionDrawer({
  entryId,
  open,
  onClose,
}: {
  entryId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!open || entryId === null) {
      setData(null);
      setNotFound(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    getProductionByEntryId(entryId)
      .then((bundle) => {
        if (!bundle) {
          setNotFound(true);
        } else {
          setData(bundle as Bundle);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [open, entryId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-xl bg-background border-l border-border shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Produkcja</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition"
            aria-label="Zamknij"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Ładowanie…</div>
        ) : notFound ? (
          <div className="p-8 text-sm text-muted-foreground">
            Ten wpis nie ma przypisanej produkcji (orphan). Edytuj go w dialogu.
          </div>
        ) : data ? (
          <DrawerContent data={data} />
        ) : null}
      </aside>
    </>
  );
}

function DrawerContent({ data }: { data: Bundle }) {
  const { production, entries, packages, posts, artist, campaign } = data;
  const t0Days = Math.round((production.t0At.getTime() - Date.now()) / 86400000);

  return (
    <div className="px-5 py-4 space-y-5">
      <header>
        <Link
          href={`/productions/${production.id}`}
          className="text-lg font-semibold tracking-tight hover:text-foreground/80 transition"
        >
          {production.title}
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <ProductionTypeBadge type={production.type} />
          <ProductionStatusPill status={production.status} />
          <span className="text-xs text-muted-foreground tabular-nums">
            T-0: {production.t0At.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })} (
            {t0Days >= 0 ? `T-${t0Days}` : `T+${Math.abs(t0Days)}`})
          </span>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card p-3">
        <ProductionStatusButtons id={production.id} current={production.status} />
        <div className="mt-2.5">
          <ProductionStatusPicker id={production.id} current={production.status} />
        </div>
      </section>

      {production.notes ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Notatki</h3>
          <div className="rounded-md border border-border bg-card px-3 py-2 text-sm whitespace-pre-wrap">
            {production.notes}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2 text-xs">
        {artist ? (
          <InfoCard label="Artysta">
            {artist.name}
            {artist.handle ? <span className="text-muted-foreground ml-1">{artist.handle}</span> : null}
          </InfoCard>
        ) : null}
        {campaign ? (
          <InfoCard label="Kampania">
            <Link href={`/campaigns/${campaign.id}`} className="hover:text-foreground">
              {campaign.name}
            </Link>
          </InfoCard>
        ) : null}
        {production.platforms?.length ? (
          <InfoCard label="Platformy">
            <PlatformPills platforms={production.platforms} />
          </InfoCard>
        ) : null}
      </section>

      <section>
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Łańcuch wpisów ({entries.length})
        </h3>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">Brak wpisów.</p>
        ) : (
          <ul className="space-y-1">
            {entries.map((e) => {
              const offsetDays = Math.round(
                (e.startsAt.getTime() - production.t0At.getTime()) / 86400000,
              );
              const tLabel =
                offsetDays === 0 ? 'T-0' : offsetDays > 0 ? `T+${offsetDays}` : `T-${Math.abs(offsetDays)}`;
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-border bg-card text-xs"
                >
                  <span className="font-mono text-muted-foreground w-10 tabular-nums shrink-0">
                    {tLabel}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground w-20 shrink-0">
                    {TYPE_LABEL[e.type]}
                  </span>
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {e.startsAt.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {packages.length > 0 ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Pakiety ({packages.length})
          </h3>
          <ul className="space-y-1">
            {packages.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-border bg-card text-xs">
                <Link href="/packages" className="flex-1 truncate hover:text-foreground">
                  {p.title}
                </Link>
                <PlatformPills platforms={p.platforms} />
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {posts.length > 0 ? (
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Posty ({posts.length})
          </h3>
          <ul className="space-y-1">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-border bg-card text-xs">
                <span className="flex-1 truncate">{p.title}</span>
                <span className="text-muted-foreground tabular-nums">
                  [{p.platform}] {p.publishedAt.toLocaleDateString('pl-PL', { dateStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="pt-3 border-t border-border">
        <Link
          href={`/productions/${production.id}`}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Pełny widok produkcji →
        </Link>
      </div>
    </div>
  );
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
