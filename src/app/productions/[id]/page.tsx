import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mail, Phone, Sparkles, CalendarDays, Package, Megaphone, FileText } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { getProduction, listProductions } from '@/server/actions/productions';
import { listVideographers } from '@/server/actions/videographers';
import { listProductionAttachments } from '@/lib/production-files';
import { PersonAvatar } from '@/components/productions/artist-avatar';
import { StageTracker } from '@/components/productions/stage-tracker';
import { SubStageButton } from '@/components/productions/sub-stage-button';
import { StageDatePicker } from '@/components/productions/stage-date-picker';
import { FileZone } from '@/components/productions/file-zone';
import { VideographerPicker } from '@/components/productions/videographer-picker';
import { PlatformPills, StatusPill } from '@/components/platforms-pills';
import { TYPE_LABEL } from '@/components/calendar/type-color';
import { STAGE_LABEL, STAGE_HINT } from '@/lib/production-stages';
import {
  PRODUCTION_PROGRESSION,
  type ProductionStatus,
  type CalendarType,
} from '../../../../drizzle/schema';

export const dynamic = 'force-dynamic';

type DateMode = 'record' | 'calendar' | 'derived' | 'none';
type WeekPhase = 'T1' | 'T2' | 'T3';

type Category = {
  key: string;
  label: string;
  description: string;
  hint: string;
  /** What kinds of calendar entries belong here */
  entryTypes?: CalendarType[];
  stages: ProductionStatus[];
  /** How each stage's date is captured. Default: 'record'. */
  dateMode?: DateMode;
  /** Whether the date input includes time. Default: true. */
  withTime?: boolean;
  /** Label shown next to the date picker per stage. */
  dateLabel: string;
  /** Pipeline week — same buckets as gantt + stage tracker. */
  week: WeekPhase;
};

const CATEGORIES: Category[] = [
  {
    key: 'outreach',
    label: 'Outreach',
    description: 'Kontakt z artystą, akceptacja warunków, ustalenie daty z kamerzystą.',
    hint: 'wzorce maila, screen rozmowy, umowa.pdf',
    entryTypes: ['meeting'],
    stages: ['email-sent', 'terms-accepted', 'cam-meeting-set'],
    dateMode: 'record',
    withTime: false,
    dateLabel: 'kiedy się wydarzyło',
    week: 'T1',
  },
  {
    key: 'ustalenia',
    label: 'Ustalenia z kamerzystą',
    description: 'Przekazanie daty + omówienie i wysłanie scenariusza.',
    hint: 'scenariusz PDF, shotlist, packing list, callsheet',
    entryTypes: ['meeting', 'deadline'],
    stages: ['cam-date-shared', 'script-discussed', 'script-sent'],
    dateMode: 'calendar',
    withTime: true,
    dateLabel: 'termin',
    week: 'T1',
  },
  {
    key: 'nagrywanie',
    label: 'Nagrywanie',
    description: 'Nagrywki — w studio lub w terenie.',
    hint: 'surówki, BTS, audio raw',
    entryTypes: ['shoot'],
    stages: ['shooting'],
    dateMode: 'calendar',
    withTime: true,
    dateLabel: 'data nagrań',
    week: 'T2',
  },
  {
    key: 'obrobka',
    label: 'Obróbka',
    description: 'Montaż — następnego dnia po nagrywkach.',
    hint: 'wersje robocze, master video',
    entryTypes: ['edit'],
    stages: ['editing'],
    dateMode: 'derived',
    withTime: true,
    dateLabel: 'auto: dzień po nagrywkach',
    week: 'T2',
  },
  {
    key: 'publikacja',
    label: 'Publikacja',
    description: 'Upload na platformy.',
    hint: 'thumbs, exports per platforma',
    entryTypes: ['publish'],
    stages: ['publishing'],
    dateMode: 'none',
    dateLabel: '',
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

const STAGE_INDEX: Record<ProductionStatus, number> = Object.fromEntries(
  PRODUCTION_PROGRESSION.map((s, i) => [s, i]),
) as Record<ProductionStatus, number>;

function stageState(
  stage: ProductionStatus,
  current: ProductionStatus,
): 'passed' | 'active' | 'pending' {
  if (current === 'cancelled') return 'pending';
  const cur = STAGE_INDEX[current];
  const idx = STAGE_INDEX[stage];
  if (idx < cur) return 'passed';
  if (idx === cur) return 'active';
  return 'pending';
}

function deriveEditingIso(shootIso: string): string {
  const d = new Date(shootIso);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
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

  const { production, entries, packages, posts, artist, videographer, campaign } = data;
  const attachments = listProductionAttachments(production.slug);
  const allVideographers = await listVideographers();
  const videographerOptions = allVideographers.map((v) => ({
    id: v.id,
    name: v.name,
    contact: v.contact,
    hourlyRate: v.hourlyRate,
  }));

  // Count this artist's other productions (excluding cancelled) for the bio header
  const allProductions = artist
    ? await listProductions().then((rows) => rows.filter((r) => r.artistId === artist.id))
    : [];

  const t0Days = Math.round((production.t0At.getTime() - Date.now()) / 86400000);
  const tLabel = t0Days === 0 ? 'T-0' : t0Days > 0 ? `T-${t0Days}` : `T+${Math.abs(t0Days)}`;

  const displayTitle = artist ? artist.name : production.title;

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
          {production.templateSlug !== 'manual' ? (
            <span className="font-mono text-[10px] text-muted-foreground/80">
              template: {production.templateSlug}
            </span>
          ) : null}
        </span>
      }
    >
      <div className="space-y-8">
        <Link
          href="/productions"
          className="inline-flex text-xs text-muted-foreground hover:text-foreground"
        >
          ← wszystkie produkcje
        </Link>

        {/* Person header */}
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

        {/* Top-line stage tracker (compact 5-tick) */}
        <section className="card-editorial p-5">
          <div className="mb-3">
            <span className="pill-label pill-label-sm">Pipeline</span>
          </div>
          <StageTracker productionId={production.id} status={production.status} />
        </section>

        {/* Categories — grouped by pipeline week (T1 / T2 / T3) */}
        <section className="space-y-6">
          {WEEK_FRAMES.map((frame) => {
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
                    // Prefer the explicit `stage` set by templates; fall back to entry-type
                    // matching only for legacy entries that pre-date the stage column.
                    const relevantEntries = entries.filter((e) => {
                      if (e.stage) return e.stage === cat.key;
                      return cat.entryTypes?.includes(e.type) ?? false;
                    });
                    const relevantAttachments = attachments.filter(
                      (a) => a.stage === cat.key,
                    );

                    // Items pinned to specific category
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
                        category={cat}
                        currentStatus={production.status}
                        stepDates={production.stepDates ?? {}}
                        visibleEntries={relevantEntries}
                        t0={production.t0At}
                        attachments={relevantAttachments}
                        extras={extras}
                        bannerSlot={bannerSlot}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {/* Notes — at the bottom for context */}
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

type EntryRow = {
  id: number;
  type: CalendarType;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  productionId?: number | null;
};

function CategorySection({
  productionId,
  category,
  currentStatus,
  stepDates,
  visibleEntries,
  t0,
  attachments,
  extras,
  bannerSlot,
}: {
  productionId: number;
  category: Category;
  currentStatus: ProductionStatus;
  stepDates: Partial<Record<ProductionStatus, string>>;
  visibleEntries: EntryRow[];
  t0: Date;
  attachments: ReturnType<typeof listProductionAttachments>;
  extras: React.ReactNode[];
  bannerSlot?: React.ReactNode;
}) {
  const states = category.stages.map((s) => stageState(s, currentStatus));
  const allPassed = states.every((s) => s === 'passed');
  const anyActive = states.includes('active');
  const groupTone = allPassed ? 'passed' : anyActive ? 'active' : 'pending';

  return (
    <div
      className={`card-editorial overflow-hidden ${
        groupTone === 'active' ? 'border-foreground/40 shadow-sm' : ''
      }`}
    >
      {/* Section header */}
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
          {states.filter((s) => s === 'passed').length}/{category.stages.length} kroków
        </span>
      </div>

      {bannerSlot ? <div className="px-5 pt-5">{bannerSlot}</div> : null}

      <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">
        {/* Sub-stages column */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2 font-medium">
            Kroki
          </div>
          <div className="space-y-3">
            {category.stages.map((stage, idx) => {
              const dateMode = category.dateMode ?? 'none';
              const stepDateIso = stepDates[stage] ?? null;
              const derivedIso =
                stage === 'editing' && stepDates.shooting
                  ? deriveEditingIso(stepDates.shooting)
                  : null;
              return (
                <div key={stage} className="space-y-1.5">
                  <SubStageButton
                    productionId={productionId}
                    stage={stage}
                    label={STAGE_LABEL[stage]}
                    state={states[idx]}
                  />
                  {STAGE_HINT[stage] ? (
                    <p className="pl-7 text-[11px] text-muted-foreground/80 italic">
                      {STAGE_HINT[stage]}
                    </p>
                  ) : null}
                  <StageDatePicker
                    productionId={productionId}
                    stage={stage}
                    mode={dateMode}
                    currentIso={stepDateIso}
                    derivedIso={derivedIso}
                    withTime={category.withTime ?? true}
                    label={category.dateLabel}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Files + related items column */}
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

          {visibleEntries.length > 0 ? (
            <ItemList
              icon={CalendarDays}
              title={`Kalendarz (${visibleEntries.length})`}
              items={visibleEntries.map((e) => {
                const offsetDays = Math.round(
                  (e.startsAt.getTime() - t0.getTime()) / 86400000,
                );
                const t =
                  offsetDays === 0
                    ? 'T-0'
                    : offsetDays > 0
                      ? `T+${offsetDays}`
                      : `T-${Math.abs(offsetDays)}`;
                return {
                  key: `e-${e.id}`,
                  title: e.title,
                  meta: (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {TYPE_LABEL[e.type]} · {t}
                    </span>
                  ),
                  right: (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {e.startsAt.toLocaleDateString('pl-PL', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  ),
                };
              })}
            />
          ) : null}

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
