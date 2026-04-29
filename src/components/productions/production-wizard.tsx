'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createProduction } from '@/server/actions/productions';
import { applyTemplateSteps } from '@/server/actions/production-custom-steps';
import { PLATFORMS, type Platform, type ProductionType } from '../../../drizzle/schema';
import { isoWeekToMonday, toIsoWeekString } from '@/lib/dates';
import type { ProductionTemplate } from '@/lib/production-templates-types';

type ArtistOption = { id: number; name: string; handle: string | null };
type VideographerOption = { id: number; name: string; hourlyRate: number | null };

type Step = 1 | 2 | 3;

/**
 * Default T1 ISO week. T1 = the week the collaboration starts (outreach +
 * ustalenia); T-0 sits 2 weeks later. Defaults to the current ISO week so a
 * new production starts "this week" with publication in 2 weeks. If a hint is
 * provided AND it's in the future, treat it as the desired T-0 and step back.
 */
function defaultT1Week(hint?: Date): string {
  const now = new Date();
  if (hint && hint.getTime() > now.getTime() + 7 * 24 * 3600 * 1000) {
    const t1 = new Date(hint);
    t1.setDate(t1.getDate() - 14);
    return toIsoWeekString(t1);
  }
  return toIsoWeekString(now);
}

/**
 * T-0 derived from T1 week: Monday of T1 + 14 days = Monday of T3 (publication
 * week), set to noon local. User can refine the exact day/time later on the
 * production page.
 */
function deriveT0FromT1(week: string): Date | null {
  const mon = isoWeekToMonday(week);
  if (!mon) return null;
  const t0 = new Date(mon);
  t0.setDate(t0.getDate() + 14);
  t0.setHours(12, 0, 0, 0);
  return t0;
}

export function ProductionWizard({
  open,
  onOpenChange,
  artists,
  videographers = [],
  templates,
  defaultStart,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  artists: ArtistOption[];
  videographers?: VideographerOption[];
  templates: ProductionTemplate[];
  defaultStart?: Date;
}) {
  // Local helpers — the templates list now arrives as a prop (server-loaded
  // upstream) so the wizard stays a pure client component.
  const templatesForType = (t: ProductionType) => templates.filter((x) => x.type === t);
  const defaultTemplateFor = (t: ProductionType) => templatesForType(t)[0];
  const getTemplate = (slug: string) => templates.find((t) => t.slug === slug);

  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<ProductionType>('with-artist');
  const [templateSlug, setTemplateSlug] = useState<string>(
    () => defaultTemplateFor('with-artist')?.slug ?? '',
  );
  const [title, setTitle] = useState('');
  const [t1Week, setT1Week] = useState(() => defaultT1Week(defaultStart));
  const [artistId, setArtistId] = useState<number | null>(null);
  const [videographerId, setVideographerId] = useState<number | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const reset = () => {
    setStep(1);
    setType('with-artist');
    setTemplateSlug(defaultTemplateFor('with-artist')?.slug ?? '');
    setTitle('');
    setT1Week(defaultT1Week(defaultStart));
    setArtistId(null);
    setVideographerId(null);
    setPlatforms([]);
    setNotes('');
    setError(null);
  };

  // When the user flips type, ensure the selected template still belongs to
  // that type — otherwise reset to the default template for the new type.
  const onChangeType = (t: ProductionType) => {
    setType(t);
    const current = getTemplate(templateSlug);
    if (!current || current.type !== t) {
      setTemplateSlug(defaultTemplateFor(t)?.slug ?? '');
    }
  };

  const close = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const next = () => setStep((s) => Math.min(3, s + 1) as Step);
  const back = () => setStep((s) => Math.max(1, s - 1) as Step);

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const submit = () => {
    setError(null);
    if (!title.trim()) {
      setError('Tytuł nie może być pusty');
      setStep(2);
      return;
    }
    const t0 = deriveT0FromT1(t1Week);
    if (!t0) {
      setError('Wybierz tydzień startowy (T-1)');
      setStep(2);
      return;
    }
    const t0Iso = t0.toISOString();

    const template = getTemplate(templateSlug);

    startTransition(async () => {
      try {
        const prod = await createProduction({
          type,
          title: title.trim(),
          t0At: t0Iso,
          artistId: type === 'with-artist' ? artistId : null,
          videographerId: type === 'with-artist' ? videographerId : null,
          platforms: platforms.length > 0 ? platforms : null,
          notes: notes.trim() || null,
          status: 'email-sent',
        });
        // Apply template's custom steps in a single follow-up write. Failure
        // here shouldn't block production creation — surface a soft warning.
        if (template && template.customSteps.length > 0) {
          const res = await applyTemplateSteps(prod.id, template.customSteps);
          if (!res.ok) {
            toast.warning('Produkcja utworzona, ale nie udało się dodać kroków z szablonu', {
              description: res.error,
            });
          }
        }
        toast.success(
          `Utworzono produkcję #${prod.id}${template ? ` · szablon: ${template.name}` : ''}`,
        );
        router.push(`/productions/${prod.id}`);
        close(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error('Nie udało się utworzyć', { description: msg });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Nowa produkcja</span>
            <span className="text-xs font-normal text-muted-foreground">krok {step}/3</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {step === 1 ? (
            <StepType
              type={type}
              onChangeType={onChangeType}
              templateSlug={templateSlug}
              onChangeTemplate={setTemplateSlug}
              templates={templatesForType(type)}
            />
          ) : null}
          {step === 2 ? (
            <StepDetails
              type={type}
              title={title}
              setTitle={setTitle}
              t1Week={t1Week}
              setT1Week={setT1Week}
              artistId={artistId}
              setArtistId={setArtistId}
              artists={artists}
              videographerId={videographerId}
              setVideographerId={setVideographerId}
              videographers={videographers}
              platforms={platforms}
              togglePlatform={togglePlatform}
              notes={notes}
              setNotes={setNotes}
            />
          ) : null}
          {step === 3 ? (
            <StepReview
              type={type}
              template={getTemplate(templateSlug) ?? null}
              title={title}
              t1Week={t1Week}
              artist={artists.find((a) => a.id === artistId) ?? null}
              videographer={videographers.find((v) => v.id === videographerId) ?? null}
              platforms={platforms}
              notes={notes}
            />
          ) : null}
          {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <Button variant="outline" onClick={back} disabled={step === 1 || pending}>
            ← Wstecz
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => close(false)} disabled={pending}>
              Anuluj
            </Button>
            {step < 3 ? (
              <Button onClick={next} disabled={pending}>
                Dalej →
              </Button>
            ) : (
              <Button onClick={submit} disabled={pending}>
                {pending ? 'Tworzenie…' : 'Utwórz produkcję'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepType({
  type,
  onChangeType,
  templateSlug,
  onChangeTemplate,
  templates,
}: {
  type: ProductionType;
  onChangeType: (t: ProductionType) => void;
  templateSlug: string;
  onChangeTemplate: (slug: string) => void;
  templates: ProductionTemplate[];
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Typ produkcji</p>
        <div className="grid grid-cols-2 gap-3">
          <TypeCard
            active={type === 'with-artist'}
            onClick={() => onChangeType('with-artist')}
            title="Z artystą"
            description="Kolaba — outreach, briefing, nagranie z gościem, podziękowanie."
          />
          <TypeCard
            active={type === 'solo'}
            onClick={() => onChangeType('solo')}
            title="Solo"
            description="Twój content — szybki cykl, BTS, trending, refleksje."
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground">Szablon kroków</p>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 tabular-nums">
            {templates.length} {templates.length === 1 ? 'szablon' : 'szablony'}
          </span>
        </div>
        <div className="grid gap-2">
          {templates.map((t) => (
            <TemplateCard
              key={t.slug}
              template={t}
              active={t.slug === templateSlug}
              onClick={() => onChangeTemplate(t.slug)}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Każdy szablon to ten sam fundament 9-krokowy + opcjonalne kroki dodatkowe. Możesz je później zmieniać w produkcji.
        </p>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  active,
  onClick,
}: {
  template: ProductionTemplate;
  active: boolean;
  onClick: () => void;
}) {
  const extra = template.customSteps.length;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left rounded-lg border p-3.5 ui-transition ${
        active
          ? 'border-primary bg-primary/10 shadow-sm'
          : 'border-border hover:border-foreground/30 hover:bg-muted/30'
      }`}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="font-semibold text-sm tracking-tight">{template.name}</span>
        <span
          className={`text-[10px] uppercase tracking-[0.12em] tabular-nums shrink-0 ${
            active ? 'text-primary font-bold' : 'text-muted-foreground'
          }`}
        >
          9 + {extra} {extra === 1 ? 'krok' : 'kroków'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-snug">{template.summary}</p>
      {extra > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {template.customSteps.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted/60 text-muted-foreground"
            >
              + {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function TypeCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-4 transition ${
        active ? 'border-primary bg-primary/10' : 'border-border hover:border-foreground/30'
      }`}
    >
      <div className="font-medium mb-1">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

function StepDetails({
  type,
  title,
  setTitle,
  t1Week,
  setT1Week,
  artistId,
  setArtistId,
  artists,
  videographerId,
  setVideographerId,
  videographers,
  platforms,
  togglePlatform,
  notes,
  setNotes,
}: {
  type: ProductionType;
  title: string;
  setTitle: (s: string) => void;
  t1Week: string;
  setT1Week: (s: string) => void;
  artistId: number | null;
  setArtistId: (v: number | null) => void;
  artists: ArtistOption[];
  videographerId: number | null;
  setVideographerId: (v: number | null) => void;
  videographers: VideographerOption[];
  platforms: Platform[];
  togglePlatform: (p: Platform) => void;
  notes: string;
  setNotes: (s: string) => void;
}) {
  const t1Mon = isoWeekToMonday(t1Week);
  const t1Sun = t1Mon ? new Date(t1Mon) : null;
  if (t1Sun) t1Sun.setDate(t1Sun.getDate() + 6);
  const t0 = deriveT0FromT1(t1Week);
  const t3Sun = t0 ? new Date(t0) : null;
  if (t3Sun) t3Sun.setDate(t3Sun.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  const fmtFull = (d: Date) => d.toLocaleDateString('pl-PL', { dateStyle: 'medium' });
  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label htmlFor="title">Tytuł produkcji</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Np. Kolaba z Anią — singiel Świt"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="t1week">Tydzień startowy (T-1) — outreach + ustalenia</Label>
        <Input
          id="t1week"
          type="week"
          value={t1Week}
          onChange={(e) => setT1Week(e.target.value)}
        />
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
          {t1Mon && t1Sun ? (
            <p className="tabular-nums">
              <span className="font-bold text-amber-700">T-1</span> {fmt(t1Mon)}–{fmt(t1Sun)}
              <span className="opacity-70"> · outreach + ustalenia z kamerzystą</span>
            </p>
          ) : (
            <p className="text-rose-600">Wybierz tydzień kalendarzowy.</p>
          )}
          {t0 && t3Sun ? (
            <p className="tabular-nums">
              <span className="font-bold text-emerald-700">T-0</span> {fmtFull(t0)}
              <span className="opacity-70"> · publikacja w tygodniu {fmt(t0)}–{fmt(t3Sun)}</span>
            </p>
          ) : null}
        </div>
      </div>
      {type === 'with-artist' ? (
        <div className="grid gap-1.5">
          <Label>Artysta</Label>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setArtistId(null)}
              className={`px-2.5 py-1 text-xs rounded border transition ${
                artistId === null
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40'
              }`}
            >
              brak
            </button>
            {artists.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setArtistId(a.id)}
                className={`px-2.5 py-1 text-xs rounded border transition ${
                  artistId === a.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/40'
                }`}
              >
                {a.name}
                {a.handle ? <span className="opacity-60 ml-1">{a.handle}</span> : null}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Brakuje? Dodaj w <span className="font-mono">/artists</span> i wróć tutaj.
          </p>
        </div>
      ) : null}
      {type === 'with-artist' ? (
        <div className="grid gap-1.5">
          <Label>Kamerzysta</Label>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setVideographerId(null)}
              className={`px-2.5 py-1 text-xs rounded border transition ${
                videographerId === null
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40'
              }`}
            >
              brak / solo cam
            </button>
            {videographers.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVideographerId(v.id)}
                className={`px-2.5 py-1 text-xs rounded border transition ${
                  videographerId === v.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/40'
                }`}
              >
                {v.name}
                {v.hourlyRate ? <span className="opacity-60 ml-1">{v.hourlyRate}zł/h</span> : null}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Brakuje? Dodaj w <span className="font-mono">/videographers</span>.
          </p>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label>Platformy publikacji (opcjonalnie)</Label>
        <div className="flex flex-wrap gap-1">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`px-2.5 py-1 text-xs rounded border transition ${
                platforms.includes(p)
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notatki (opcjonalnie)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Cel produkcji, brand voice, zdarzenia powiązane..."
        />
      </div>
    </div>
  );
}

function StepReview({
  type,
  template,
  title,
  t1Week,
  artist,
  videographer,
  platforms,
  notes,
}: {
  type: ProductionType;
  template: ProductionTemplate | null;
  title: string;
  t1Week: string;
  artist: ArtistOption | null;
  videographer: VideographerOption | null;
  platforms: Platform[];
  notes: string;
}) {
  const t1Mon = isoWeekToMonday(t1Week);
  const t1Sun = t1Mon ? new Date(t1Mon) : null;
  if (t1Sun) t1Sun.setDate(t1Sun.getDate() + 6);
  const t0 = deriveT0FromT1(t1Week);
  const fmt = (d: Date) => d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-3 text-sm space-y-1">
        <Row label="Tytuł" value={title || <span className="text-rose-600">brak (uzupełnij krok 2)</span>} />
        <Row
          label="Typ"
          value={type === 'with-artist' ? 'Z artystą' : 'Solo'}
        />
        <Row
          label="Szablon"
          value={
            template ? (
              <span>
                {template.name}
                <span className="text-muted-foreground ml-1.5 tabular-nums">
                  · 9 + {template.customSteps.length}{' '}
                  {template.customSteps.length === 1 ? 'krok' : 'kroków'}
                </span>
              </span>
            ) : (
              'standard'
            )
          }
        />
        <Row
          label="T-1 (start)"
          value={
            t1Mon && t1Sun
              ? `${fmt(t1Mon)}–${fmt(t1Sun)} · outreach + ustalenia`
              : <span className="text-rose-600">brak</span>
          }
        />
        <Row
          label="T-0"
          value={
            t0
              ? t0.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })
              : '—'
          }
        />
        {type === 'with-artist' ? (
          <Row label="Artysta" value={artist ? `${artist.name}${artist.handle ? ' · ' + artist.handle : ''}` : 'brak'} />
        ) : null}
        {type === 'with-artist' ? (
          <Row
            label="Kamerzysta"
            value={
              videographer
                ? `${videographer.name}${videographer.hourlyRate ? ` · ${videographer.hourlyRate}zł/h` : ''}`
                : 'brak / solo cam'
            }
          />
        ) : null}
        <Row
          label="Platformy"
          value={platforms.length > 0 ? platforms.join(', ') : 'brak'}
        />
        {notes ? <Row label="Notatki" value={notes} /> : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Pusta produkcja zostanie utworzona — wpisy kalendarza dodasz ręcznie z poziomu kalendarza lub strony produkcji.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-24 shrink-0">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
