import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { getProduction } from '@/server/actions/productions';
import {
  ProductionStatusPill,
  ProductionTypeBadge,
  STATUS_LABEL,
} from '@/components/productions/status-pill';
import {
  ProductionStatusButtons,
  ProductionStatusPicker,
} from '@/components/productions/status-buttons';
import { TYPE_LABEL } from '@/components/calendar/type-color';
import { PlatformPills, StatusPill } from '@/components/platforms-pills';

export const dynamic = 'force-dynamic';

export default async function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const productionId = Number(id);
  if (!Number.isFinite(productionId)) notFound();

  const data = await getProduction(productionId);
  if (!data) notFound();

  const { production, entries, packages, posts, artist, campaign } = data;

  const t0Days = Math.round((production.t0At.getTime() - Date.now()) / 86400000);

  return (
    <PageShell
      title={production.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <ProductionTypeBadge type={production.type} />
          <ProductionStatusPill status={production.status} />
          <span className="text-xs text-muted-foreground tabular-nums">
            T-0: {production.t0At.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })} (
            {t0Days >= 0 ? `T-${t0Days}` : `T+${Math.abs(t0Days)}`})
          </span>
          {production.templateSlug !== 'manual' ? (
            <span className="text-xs text-muted-foreground">template: {production.templateSlug}</span>
          ) : null}
        </span>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/productions" className="text-xs text-muted-foreground hover:text-foreground">
            ← wszystkie produkcje
          </Link>
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <ProductionStatusButtons id={production.id} current={production.status} />
          <div className="mt-3">
            <ProductionStatusPicker id={production.id} current={production.status} />
          </div>
        </section>

        {production.notes ? (
          <section>
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Notatki</h2>
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm whitespace-pre-wrap">
              {production.notes}
            </div>
          </section>
        ) : null}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          {artist ? (
            <Card label="Artysta">
              <Link href="/artists" className="hover:text-foreground">
                {artist.name}
                {artist.handle ? <span className="text-muted-foreground ml-2">{artist.handle}</span> : null}
              </Link>
            </Card>
          ) : null}
          {campaign ? (
            <Card label="Kampania">
              <Link href={`/campaigns/${campaign.id}`} className="hover:text-foreground">
                {campaign.name}
              </Link>
            </Card>
          ) : null}
          {production.platforms?.length ? (
            <Card label="Platformy">
              <PlatformPills platforms={production.platforms} />
            </Card>
          ) : null}
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Łańcuch wpisów ({entries.length})
          </h2>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Brak wpisów kalendarzowych. (Generowane z templateu — Faza B.)
            </p>
          ) : (
            <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {entries.map((e) => {
                const offsetMs = e.startsAt.getTime() - production.t0At.getTime();
                const offsetDays = Math.round(offsetMs / 86400000);
                const tLabel = offsetDays === 0 ? 'T-0' : offsetDays > 0 ? `T+${offsetDays}` : `T-${Math.abs(offsetDays)}`;
                return (
                  <li key={e.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-muted-foreground w-12 tabular-nums">{tLabel}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-24 shrink-0">
                      {TYPE_LABEL[e.type]}
                    </span>
                    <span className="flex-1 truncate">{e.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {e.startsAt.toLocaleString('pl-PL', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">{e.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {packages.length > 0 ? (
          <section>
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Pakiety ({packages.length})
            </h2>
            <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {packages.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <Link href="/packages" className="flex-1 truncate font-medium hover:text-foreground">
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
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Posty ({posts.length})
            </h2>
            <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {posts.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    [{p.platform}] {p.publishedAt.toLocaleDateString('pl-PL', { dateStyle: 'short' })}
                  </span>
                  <span className="text-xs tabular-nums">
                    {p.reach ? `reach ${p.reach.toLocaleString('pl-PL')}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}
