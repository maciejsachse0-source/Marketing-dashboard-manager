'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  createProduction,
  createProductionFromTemplate,
} from '@/server/actions/productions';
import { PLATFORMS, type Platform, type ProductionType } from '../../../drizzle/schema';
import { isoToInputLocal } from '@/lib/dates';
import type { ProductionTemplate } from '@/lib/templates';

type ArtistOption = { id: number; name: string; handle: string | null };
type VideographerOption = { id: number; name: string; hourlyRate: number | null };

type Step = 1 | 2 | 3 | 4;

export function ProductionWizard({
  open,
  onOpenChange,
  templates,
  artists,
  videographers = [],
  defaultStart,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templates: ProductionTemplate[];
  artists: ArtistOption[];
  videographers?: VideographerOption[];
  defaultStart?: Date;
}) {
  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<ProductionType>('with-artist');
  const [templateSlug, setTemplateSlug] = useState<string>('manual');
  const [title, setTitle] = useState('');
  const [t0Local, setT0Local] = useState(() => isoToInputLocal(defaultStart ?? new Date()));
  const [artistId, setArtistId] = useState<number | null>(null);
  const [videographerId, setVideographerId] = useState<number | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.type === type),
    [templates, type],
  );

  const selectedTemplate = useMemo(
    () => (templateSlug === 'manual' ? null : templates.find((t) => t.slug === templateSlug) ?? null),
    [templates, templateSlug],
  );

  const reset = () => {
    setStep(1);
    setType('with-artist');
    setTemplateSlug('manual');
    setTitle('');
    setT0Local(isoToInputLocal(defaultStart ?? new Date()));
    setArtistId(null);
    setVideographerId(null);
    setPlatforms([]);
    setNotes('');
    setError(null);
  };

  const close = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const next = () => setStep((s) => Math.min(4, s + 1) as Step);
  const back = () => setStep((s) => Math.max(1, s - 1) as Step);

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const submit = () => {
    setError(null);
    if (!title.trim()) {
      setError('Tytuł nie może być pusty');
      setStep(3);
      return;
    }
    const t0Iso = new Date(t0Local).toISOString();

    startTransition(async () => {
      try {
        if (selectedTemplate) {
          const result = await createProductionFromTemplate({
            templateSlug: selectedTemplate.slug,
            title: title.trim(),
            t0At: t0Iso,
            artistId: type === 'with-artist' ? artistId : null,
            videographerId: type === 'with-artist' ? videographerId : null,
            platformsOverride: platforms.length > 0 ? platforms : null,
            notes: notes.trim() || null,
          });
          toast.success(`Utworzono produkcję #${result.production.id}`, {
            description: `${result.entriesCreated} wpisów w kalendarzu`,
          });
          router.push(`/productions/${result.production.id}`);
        } else {
          const prod = await createProduction({
            type,
            templateSlug: 'manual',
            title: title.trim(),
            t0At: t0Iso,
            artistId: type === 'with-artist' ? artistId : null,
            videographerId: type === 'with-artist' ? videographerId : null,
            platforms: platforms.length > 0 ? platforms : null,
            notes: notes.trim() || null,
            status: 'email-sent',
          });
          toast.success(`Utworzono produkcję #${prod.id}`);
          router.push(`/productions/${prod.id}`);
        }
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
            <span className="text-xs font-normal text-muted-foreground">krok {step}/4</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {step === 1 ? <StepType type={type} onChange={setType} /> : null}
          {step === 2 ? (
            <StepTemplate
              templates={filteredTemplates}
              selected={templateSlug}
              onSelect={setTemplateSlug}
              type={type}
            />
          ) : null}
          {step === 3 ? (
            <StepDetails
              type={type}
              title={title}
              setTitle={setTitle}
              t0Local={t0Local}
              setT0Local={setT0Local}
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
          {step === 4 ? (
            <StepReview
              type={type}
              template={selectedTemplate}
              title={title}
              t0Local={t0Local}
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
            {step < 4 ? (
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
  onChange,
}: {
  type: ProductionType;
  onChange: (t: ProductionType) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Typ produkcji</p>
      <div className="grid grid-cols-2 gap-3">
        <TypeCard
          active={type === 'with-artist'}
          onClick={() => onChange('with-artist')}
          title="Z artystą"
          description="Kolaba — outreach, briefing, nagranie z gościem, podziękowanie."
        />
        <TypeCard
          active={type === 'solo'}
          onClick={() => onChange('solo')}
          title="Solo"
          description="Twój content — szybki cykl, BTS, trending, refleksje."
        />
      </div>
    </div>
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

function StepTemplate({
  templates,
  selected,
  onSelect,
  type,
}: {
  templates: ProductionTemplate[];
  selected: string;
  onSelect: (slug: string) => void;
  type: ProductionType;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Wybierz template (kroki + offsety zostaną auto-wygenerowane jako wpisy kalendarza)
      </p>
      <div className="space-y-2">
        <TemplateOption
          active={selected === 'manual'}
          onClick={() => onSelect('manual')}
          name="Bez templateu (manual)"
          description="Pusta produkcja — dodasz wpisy kalendarza ręcznie."
          stepCount={0}
          duration={null}
        />
        {templates.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Brak templateów dla typu „{type}".
          </p>
        ) : null}
        {templates.map((t) => (
          <TemplateOption
            key={t.slug}
            active={selected === t.slug}
            onClick={() => onSelect(t.slug)}
            name={t.name}
            description={t.description}
            stepCount={t.steps.length}
            duration={t.durationDays}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateOption({
  active,
  onClick,
  name,
  description,
  stepCount,
  duration,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  description: string;
  stepCount: number;
  duration: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition ${
        active ? 'border-primary bg-primary/10' : 'border-border hover:border-foreground/30'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-sm">{name}</div>
        {stepCount > 0 ? (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {stepCount} kroków · {duration} dni
          </span>
        ) : null}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
    </button>
  );
}

function StepDetails({
  type,
  title,
  setTitle,
  t0Local,
  setT0Local,
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
  t0Local: string;
  setT0Local: (s: string) => void;
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
        <Label htmlFor="t0">T-0 (data nagrania / premiery)</Label>
        <Input
          id="t0"
          type="datetime-local"
          value={t0Local}
          onChange={(e) => setT0Local(e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          Wszystkie wpisy templateu liczone są od tej daty (T-21, T-0, T+12 itd.).
        </p>
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
        <Label>Platformy publikacji (opcjonalnie — nadpisuje template)</Label>
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
  t0Local,
  artist,
  videographer,
  platforms,
  notes,
}: {
  type: ProductionType;
  template: ProductionTemplate | null;
  title: string;
  t0Local: string;
  artist: ArtistOption | null;
  videographer: VideographerOption | null;
  platforms: Platform[];
  notes: string;
}) {
  const t0 = new Date(t0Local);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-3 text-sm space-y-1">
        <Row label="Tytuł" value={title || <span className="text-rose-600">brak (uzupełnij krok 3)</span>} />
        <Row
          label="Typ"
          value={type === 'with-artist' ? 'Z artystą' : 'Solo'}
        />
        <Row label="Template" value={template?.name ?? 'Bez templateu (manual)'} />
        <Row
          label="T-0"
          value={
            Number.isFinite(t0.getTime())
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
          value={
            platforms.length > 0
              ? platforms.join(', ')
              : template
                ? 'z templateu'
                : 'brak'
          }
        />
        {notes ? <Row label="Notatki" value={notes} /> : null}
      </div>

      {template ? (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Zostanie utworzonych <strong className="text-foreground">{template.steps.length}</strong> wpisów kalendarza:
          </p>
          <ul className="rounded-lg border border-border bg-card divide-y divide-border max-h-48 overflow-y-auto text-xs">
            {template.steps.map((s, i) => {
              const date = new Date(t0);
              date.setDate(date.getDate() + s.tDays);
              date.setHours(s.hourStart, 0, 0, 0);
              return (
                <li key={i} className="px-3 py-1.5 flex items-center gap-2">
                  <span className="font-mono text-muted-foreground w-10 tabular-nums shrink-0">
                    {s.tDays === 0 ? 'T-0' : s.tDays > 0 ? `T+${s.tDays}` : `T-${Math.abs(s.tDays)}`}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground w-16 shrink-0">{s.calendarType}</span>
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}{' '}
                    {String(s.hourStart).padStart(2, '0')}:00
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Brak templateu — utworzymy pustą produkcję, wpisy kalendarza dodasz ręcznie.
        </p>
      )}
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
