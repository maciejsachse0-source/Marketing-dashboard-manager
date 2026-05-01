import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mail, Phone, Sparkles, Package, Megaphone, FileText } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { getProduction, listProductions } from '@/server/actions/productions';
import { listArtists } from '@/server/actions/artists';
import { listVideographers } from '@/server/actions/videographers';
import { listProductionAttachments } from '@/lib/production-files';
import { PersonAvatar } from '@/components/productions/artist-avatar';
import { ProductionStepTrackerClient } from '@/components/productions/production-step-tracker-client';
import { ProductionStepRow } from '@/components/productions/production-step-row';
import { AddStepInline } from '@/components/productions/add-step-inline';
import { FileZone } from '@/components/productions/file-zone';
import { DeleteProductionButton } from '@/components/productions/delete-production-button';
import { CancelProductionButton } from '@/components/productions/cancel-production-button';
import { VideographerPicker } from '@/components/productions/videographer-picker';
import { ArtistPicker } from '@/components/productions/artist-picker';
import { PlatformPills, StatusPill } from '@/components/platforms-pills';
import type {
  ProductionStage,
  ProductionStep,
} from '../../../../drizzle/schema';

export const dynamic = 'force-dynamic';

type WeekPhase = 'T1' | 'T2' | 'T3';

type CategoryMeta = {
  key: ProductionStage;
  label: string;
  description: string;
  hint: string;
  week: WeekPhase;
};

const CATEGORIES: CategoryMeta[] = [
  {
    key: 'outreach',
    label: 'Outreach',
    description: 'Kontakt z artystą, akceptacja warunków, ustalenie daty z kamerzystą.',
    hint: 'wzorce maila, screen rozmowy, umowa.pdf',
    week: 'T1',
  },
  {
    key: 'ustalenia',
    label: 'Ustalenia + scenariusz',
    description: 'Przekazanie daty + omówienie i wysłanie scenariusza.',
    hint: 'scenariusz PDF, shotlist, packing list, callsheet',
    week: 'T1',
  },
  {
    key: 'nagrywanie',
    label: 'Nagrywanie',
    description: 'Nagrywki — w studio lub w terenie.',
    hint: 'surówki, BTS, audio raw',
    week: 'T2',
  },
  {
    key: 'obrobka',
    label: 'Obróbka',
    description: 'Montaż — następnego dnia po nagrywkach.',
    hint: 'wersje robocze, master video',
    week: 'T2',
  },
  {
    key: 'publikacja',
    label: 'Publikacja',
    description: 'Upload na platformy.',
    hint: 'thumbs, exports per platforma',
    week: 'T3',
  },
];

const WEEK_FRAMES: {
  code: WeekPhase;
  label: string;
  border: string;
  bg: string;
  badge: string;
  accent: string;
}[] = [
  {
    code: 'T1',
    label: 'Outreach + ustalenia z kamerzystą',
    border: 'border-amber-300/70',
    bg: 'bg-amber-50/40',
    badge: 'bg-amber-900 text-amber-50',
    accent: 'text-amber-900',
  },
  {
    code: 'T2',
    label: 'Nagrywka + obróbka',
    border: 'border-violet-300/70',
    bg: 'bg-violet-50/40',
    badge: 'bg-violet-900 text-violet-50',
    accent: 'text-violet-900',
  },
  {
    code: 'T3',
    label: 'Publikacja',
    border: 'border-emerald-300/70',
    bg: 'bg-emerald-50/40',
    badge: 'bg-emerald-900 text-emerald-50',
    accent: 'text-emerald-900',
  },
];

/** Step state derived from doneAt + position relative to first non-done step.
 *  - passed: doneAt is set
 *  - active: first non-done step in the whole production
 *  - pending: any other not-done step */
function buildStepStates(
  steps: ProductionStep[],
): Map<string, 'passed' | 'active' | 'pending'> {
  const states = new Map<string, 'passed' | 'active' | 'pending'>();
  let activeAssigned = false;
  for (const s of steps) {
    if (s.doneAt) {
      states.set(s.id, 'passed');
    } else if (!activeAssigned) {
      states.set(s.id, 'active');
      activeAssigned = true;
    } else {
      states.set(s.id, 'pending');
    }
  }
  return states;
}

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

  const { production, packages, posts, artist, videographer, campaign } = data;
  const attachments = listProductionAttachments(production.slug);
  const [allArtists, allVideographers] = await Promise.all([
    listArtists(),
    listVideographers(),
  ]);
  const artistOptions = allArtists.map((a) => ({
    id: a.id,
    name: a.name,
    handle: a.handle,
  }));
  const videographerOptions = allVideographers.map((v) => ({
    id: v.id,
    name: v.name,
    contact: v.contact,
    hourlyRate: v.hourlyRate,
  }));
  const orphanWithArtist = production.type === 'with-artist' && !artist;

  const allProductions = artist
    ? await listProductions().then((rows) => rows.filter((r) => r.artistId === artist.id))
    : [];

  const t0Days = Math.round((production.t0At.getTime() - Date.now()) / 86400000);
  const tLabel = t0Days === 0 ? 'T-0' : t0Days > 0 ? `T-${t0Days}` : `T+${Math.abs(t0Days)}`;

  const displayTitle = artist ? artist.name : production.title;

  const steps: ProductionStep[] = production.steps ?? [];
  const stepStates = buildStepStates(steps);
  const cancelled = !!production.cancelledAt;

  return (
    <PageShell
      title={displayTitle}
      eyebrow={production.type === 'with-artist' ? 'produkcja z artystą' : 'produkcja solo'}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">
            T-0: {production.t0At.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
          <span className="px-1.5 py-0.5 rounded font-medium tabular-nums bg-foreground text-background text-[11px]">
            {tLabel}
          </span>
          {cancelled ? (
            <span className="px-1.5 py-0.5 rounded font-medium bg-rose-100 text-rose-700 text-[11px] uppercase tracking-[0.12em]">
              Anulowana
            </span>
          ) : null}
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <CancelProductionButton productionId={production.id} cancelled={cancelled} />
          <DeleteProductionButton
            productionId={production.id}
            productionName={displayTitle}
          />
        </div>
      }
    >
      <div className="space-y-8">
        <Link
          href="/productions"
          className="group inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ui-transition w-fit"
        >
          <span className="inline-block ui-transition group-hover:-translate-x-0.5">←</span>
          wszystkie produkcje
        </Link>

        {orphanWithArtist ? (
          <ArtistPicker
            productionId={production.id}
            currentArtistId={production.artistId}
            artists={artistOptions}
            variant="warning"
          />
        ) : null}

        {artist ? (
          <PersonHeader
            kind="artist"
            name={artist.name}
            handle={artist.handle}
            email={artist.email}
            phone={artist.phone}
            bio={artist.notes}
            lastContactAt={artist.lastContactAt}
            productionCount={allProductions.length}
            campaignName={campaign?.name}
          />
        ) : videographer ? (
          <PersonHeader
            kind="videographer"
            name={videographer.name}
            email={videographer.contact}
            phone={null}
            handle={null}
            bio={videographer.notes}
            equipment={videographer.equipment}
            campaignName={campaign?.name}
          />
        ) : null}

        {/* Top-line pipeline progress */}
        <section className="card-editorial p-5">
          <div className="mb-3">
            <span className="pill-label pill-label-sm">Pipeline</span>
          </div>
          <ProductionStepTrackerClient
            productionId={production.id}
            steps={steps}
            cancelled={cancelled}
          />
        </section>

        {/* Categories — grouped by pipeline week (T1 / T2 / T3) */}
        <section className="space-y-6">
          {(() => {
            // Pre-compute global step numbering — running offset across categories
            // so each step gets a 1-based index spanning the whole pipeline.
            let runningOffset = 0;
            const offsetsByCat = new Map<ProductionStage, number>();
            for (const cat of CATEGORIES) {
              offsetsByCat.set(cat.key, runningOffset);
              runningOffset += steps.filter((s) => s.category === cat.key).length;
            }

            return WEEK_FRAMES.map((frame) => {
              const weekCategories = CATEGORIES.filter((c) => c.week === frame.code);
              return (
                <div
                  key={frame.code}
                  className={`relative rounded-2xl border ${frame.border} ${frame.bg} p-4 sm:p-5 space-y-4`}
                >
                  <header className="flex items-center gap-2.5 px-1">
                    <span
                      className={`inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md text-[11px] font-bold tracking-[0.18em] tabular-nums ${frame.badge}`}
                    >
                      {frame.code}
                    </span>
                    <span
                      className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${frame.accent}`}
                    >
                      {frame.label}
                    </span>
                    <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                      tydzień {frame.code.replace('T', '')}
                    </span>
                  </header>
                  <div className="space-y-4">
                    {weekCategories.map((cat) => {
                      const relevantAttachments = attachments.filter(
                        (a) => a.stage === cat.key,
                      );

                      const extras: React.ReactNode[] = [];
                      if (cat.key === 'publikacja') {
                        if (packages.length > 0) {
                          extras.push(
                            <ItemList
                              key="pkgs"
                              icon={Package}
                              title={`Pakiety (${packages.length})`}
                              items={packages.map((p) => ({
                                key: `pkg-${p.id}`,
                                title: p.title,
                                meta: <PlatformPills platforms={p.platforms} />,
                                right: <StatusPill status={p.status} />,
                                href: '/packages',
                              }))}
                            />,
                          );
                        }
                        if (posts.length > 0) {
                          extras.push(
                            <ItemList
                              key="posts"
                              icon={Megaphone}
                              title={`Posty (${posts.length})`}
                              items={posts.map((p) => ({
                                key: `post-${p.id}`,
                                title: p.title,
                                meta: (
                                  <span className="text-xs text-muted-foreground tabular-nums">
                                    [{p.platform}] {p.publishedAt.toLocaleDateString('pl-PL')}
                                  </span>
                                ),
                                right: (
                                  <span className="text-xs tabular-nums">
                                    {p.reach ? p.reach.toLocaleString('pl-PL') : '—'}
                                  </span>
                                ),
                              }))}
                            />,
                          );
                        }
                      }

                      const bannerSlot =
                        cat.key === 'ustalenia' ? (
                          <VideographerPicker
                            productionId={production.id}
                            currentVideographerId={production.videographerId}
                            videographers={videographerOptions}
                          />
                        ) : null;

                      return (
                        <CategorySection
                          key={cat.key}
                          productionId={production.id}
                          productionT0At={production.t0At}
                          productionPeriods={production.periods ?? null}
                          category={cat}
                          steps={steps}
                          stepStates={stepStates}
                          startNumber={(offsetsByCat.get(cat.key) ?? 0) + 1}
                          attachments={relevantAttachments}
                          extras={extras}
                          bannerSlot={bannerSlot}
                          cancelled={cancelled}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
        </section>

        {production.notes ? (
          <section>
            <div className="mb-3">
              <span className="pill-label pill-label-sm">
                <FileText className="w-3.5 h-3.5" strokeWidth={2} />
                Notatki
              </span>
            </div>
            <div className="card-editorial px-5 py-4 text-sm whitespace-pre-wrap leading-relaxed">
              {production.notes}
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}

function PersonHeader({
  kind,
  name,
  handle,
  email,
  phone,
  bio,
  equipment,
  lastContactAt,
  productionCount,
  campaignName,
}: {
  kind: 'artist' | 'videographer';
  name: string;
  handle?: string | null;
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  equipment?: string | null;
  lastContactAt?: Date | null;
  productionCount?: number;
  campaignName?: string;
}) {
  const fallbackBio =
    kind === 'artist'
      ? 'Artysta — talent, którego twarz / głos pojawia się w wideo. Brief produkcyjny opisuje czego od niego potrzebujemy.'
      : 'Kamerzysta — odpowiada za nagranie. Sprawdź dostępność i sprzęt przed potwierdzeniem terminu.';

  return (
    <section className="card-editorial p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, var(--accent-blue-soft) 0%, transparent 70%)',
          opacity: 0.4,
          filter: 'blur(24px)',
        }}
      />
      <div className="relative flex items-start gap-5">
        <PersonAvatar name={name} seed={handle ?? name} size="lg" kind={kind} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight">{name}</h2>
            {handle ? <span className="text-sm text-muted-foreground">{handle}</span> : null}
            <span className="ml-auto pill-label pill-label-sm pill-label-outline">
              {kind === 'artist' ? 'artysta' : 'kamerzysta'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            {bio ?? fallbackBio}
          </p>
          {equipment ? (
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-medium text-foreground">Sprzęt:</span> {equipment}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs">
            {email ? (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition"
              >
                <Mail className="w-3 h-3" />
                {email}
              </a>
            ) : null}
            {phone ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3 h-3" />
                {phone}
              </span>
            ) : null}
            {productionCount != null ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                {productionCount} {productionCount === 1 ? 'produkcja' : 'produkcji'} łącznie
              </span>
            ) : null}
            {lastContactAt ? (
              <span className="text-muted-foreground">
                ostatni kontakt: {lastContactAt.toLocaleDateString('pl-PL')}
              </span>
            ) : null}
            {campaignName ? (
              <Link
                href="/campaigns"
                className="inline-flex items-center gap-1.5 text-[var(--accent-blue)] hover:underline"
              >
                <Megaphone className="w-3 h-3" />
                {campaignName}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function CategorySection({
  productionId,
  productionT0At,
  productionPeriods,
  category,
  steps,
  stepStates,
  startNumber,
  attachments,
  extras,
  bannerSlot,
  cancelled,
}: {
  productionId: number;
  productionT0At: Date;
  productionPeriods: import('../../../../drizzle/schema').ProductionPeriods | null;
  category: CategoryMeta;
  steps: ProductionStep[];
  stepStates: Map<string, 'passed' | 'active' | 'pending'>;
  startNumber: number;
  attachments: ReturnType<typeof listProductionAttachments>;
  extras: React.ReactNode[];
  bannerSlot?: React.ReactNode;
  cancelled: boolean;
}) {
  const stepsInCat = steps.filter((s) => s.category === category.key);
  const passedCount = stepsInCat.filter((s) => !!s.doneAt).length;
  const groupTone = stepsInCat.length > 0 && passedCount === stepsInCat.length
    ? 'passed'
    : stepsInCat.some((s) => stepStates.get(s.id) === 'active')
      ? 'active'
      : 'pending';

  return (
    <div
      className={`card-editorial overflow-hidden ${
        groupTone === 'active' ? 'border-foreground/40 shadow-sm' : ''
      }`}
    >
      <div className="px-5 py-4 border-b border-border flex items-center gap-3 flex-wrap bg-muted/30">
        <span
          className={`pill-label pill-label-sm ${
            groupTone === 'passed' ? 'pill-label-blue' : ''
          }`}
        >
          {category.label}
        </span>
        <span className="text-sm text-muted-foreground">{category.description}</span>
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums font-medium">
          {passedCount}/{stepsInCat.length} kroków
        </span>
      </div>

      {bannerSlot ? <div className="px-5 pt-5">{bannerSlot}</div> : null}

      <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2 font-medium">
            Kroki
          </div>
          <div className="space-y-3">
            {stepsInCat.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-4 text-center text-[11px] text-muted-foreground">
                Brak kroków w tej kategorii.
              </div>
            ) : (
              stepsInCat.map((step, posInCat) => {
                const canMoveUp = posInCat > 0;
                const canMoveDown = posInCat < stepsInCat.length - 1;
                return (
                  <ProductionStepRow
                    key={step.id}
                    productionId={productionId}
                    productionT0At={productionT0At}
                    productionPeriods={productionPeriods}
                    step={step}
                    state={stepStates.get(step.id) ?? 'pending'}
                    displayNumber={startNumber + posInCat}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    productionCancelled={cancelled}
                  />
                );
              })
            )}
            <div className="pt-1">
              <AddStepInline productionId={productionId} category={category.key} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
                Pliki
              </span>
              <span className="text-[10px] text-muted-foreground/80 italic truncate ml-2">
                {category.hint}
              </span>
            </div>
            <FileZone
              productionId={productionId}
              stage={category.key}
              attachments={attachments}
            />
          </div>

          {extras}
        </div>
      </div>
    </div>
  );
}

function ItemList({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  items: {
    key: string;
    title: string;
    meta?: React.ReactNode;
    right?: React.ReactNode;
    href?: string;
  }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2 font-medium">
        <Icon className="w-3 h-3" strokeWidth={1.75} />
        {title}
      </div>
      <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {items.map((it) => {
          const inner = (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate font-medium">{it.title}</div>
                {it.meta ? <div className="mt-0.5">{it.meta}</div> : null}
              </div>
              {it.right ? <div className="shrink-0">{it.right}</div> : null}
            </>
          );
          return (
            <li
              key={it.key}
              className="px-3 py-2 flex items-center gap-3 text-sm hover:bg-muted/30 transition"
            >
              {it.href ? (
                <Link href={it.href} className="flex items-center gap-3 flex-1 min-w-0">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
