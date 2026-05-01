'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createCampaign } from '@/server/actions/campaigns';
import type { MarketingTemplate } from '@/lib/campaign-templates-types';
import { toneForIndex } from '@/lib/period-tones';
import { resolvePeriods } from '@/lib/production-periods';

type Step = 1 | 2 | 3;

function defaultKickoffAt(): string {
  // Default kickoff = next Monday at 09:00, so the campaign's narrative arc
  // starts on a clean week boundary. Used as the date axis anchor for
  // periods + the campaign's `releaseAt` field (which we now treat as
  // "kickoff" semantically — the field name is legacy).
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  const dowMon = (d.getDay() + 6) % 7;
  const offset = dowMon === 0 ? 0 : 7 - dowMon;
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignWizard({
  open,
  onOpenChange,
  templates,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templates: MarketingTemplate[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [templateSlug, setTemplateSlug] = useState<string | null>(
    templates[0]?.slug ?? null,
  );
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [kickoffAt, setKickoffAt] = useState(defaultKickoffAt());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const reset = () => {
    setStep(1);
    setTemplateSlug(templates[0]?.slug ?? null);
    setName('');
    setGoal('');
    setKickoffAt(defaultKickoffAt());
    setNotes('');
    setError(null);
  };

  const close = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const next = () => setStep((s) => Math.min(3, s + 1) as Step);
  const back = () => setStep((s) => Math.max(1, s - 1) as Step);

  const selectedTemplate = templates.find((t) => t.slug === templateSlug) ?? null;

  const submit = () => {
    setError(null);
    if (!templateSlug) {
      setError('Wybierz szablon kampanii.');
      setStep(1);
      return;
    }
    if (!name.trim()) {
      setError('Nazwa kampanii nie może być pusta.');
      setStep(2);
      return;
    }
    if (!goal.trim()) {
      setError('Uzupełnij wizję / cel kampanii.');
      setStep(2);
      return;
    }
    const t0 = new Date(kickoffAt);
    if (Number.isNaN(t0.getTime())) {
      setError('Wybierz prawidłową datę startu kampanii.');
      setStep(2);
      return;
    }

    startTransition(async () => {
      try {
        const row = await createCampaign({
          name: name.trim(),
          goal: goal.trim(),
          releaseAt: t0.toISOString(),
          notes: notes.trim() || null,
          templateSlug,
        });
        toast.success(
          `Utworzono kampanię #${row.id}${selectedTemplate ? ` · szablon: ${selectedTemplate.name}` : ''}`,
        );
        router.push(`/campaigns/${row.id}`);
        close(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error('Nie udało się utworzyć kampanii', { description: msg });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Nowa kampania marketingowa</span>
            <span className="text-xs font-normal text-muted-foreground">krok {step}/3</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {step === 1 ? (
            <StepTemplate
              templates={templates}
              selected={templateSlug}
              onSelect={setTemplateSlug}
            />
          ) : null}
          {step === 2 ? (
            <StepDetails
              name={name}
              setName={setName}
              goal={goal}
              setGoal={setGoal}
              kickoffAt={kickoffAt}
              setKickoffAt={setKickoffAt}
              notes={notes}
              setNotes={setNotes}
            />
          ) : null}
          {step === 3 ? (
            <StepReview
              template={selectedTemplate}
              name={name}
              goal={goal}
              kickoffAt={kickoffAt}
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
              <Button
                onClick={next}
                disabled={pending || (step === 1 && !templateSlug)}
              >
                Dalej →
              </Button>
            ) : (
              <Button onClick={submit} disabled={pending}>
                {pending ? 'Tworzenie…' : 'Utwórz kampanię'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepTemplate({
  templates,
  selected,
  onSelect,
}: {
  templates: MarketingTemplate[];
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
        Brak szablonów kampanii. Utwórz pierwszy w{' '}
        <a
          href="/campaigns/templates/new"
          className="underline text-foreground hover:text-[var(--accent-blue)]"
        >
          /campaigns/templates/new
        </a>
        .
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Szablon kampanii</p>
        <p className="text-[11px] text-muted-foreground/80">
          Wybór jest ograniczony do <strong>jednego</strong> szablonu — staje się on
          kręgosłupem narracji. Periody i milestone&apos;y możesz dalej kształtować
          sliderem na stronie kampanii.
        </p>
      </div>
      <div className="grid gap-2">
        {templates.map((t) => (
          <TemplateCard
            key={t.slug}
            template={t}
            active={t.slug === selected}
            onClick={() => onSelect(t.slug)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  active,
  onClick,
}: {
  template: MarketingTemplate;
  active: boolean;
  onClick: () => void;
}) {
  const totalSubs = template.milestones.reduce((s, m) => s + m.submilestones.length, 0);
  const periods = resolvePeriods(template.periods);
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
          {template.milestones.length} milestone&apos;ów · {totalSubs} sub.
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-snug mb-2">{template.summary}</p>
      <div className="flex flex-wrap gap-1">
        {periods.map((p, idx) => {
          const cnt = template.milestones.filter((m) => m.period === p.code).length;
          const tone = toneForIndex(idx);
          const length = p.endOffsetDays - p.startOffsetDays + 1;
          return (
            <span
              key={p.code}
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${tone.bar} ${tone.ink}`}
            >
              <span className="font-bold tabular-nums tracking-wider">{p.code}</span>
              <span className="opacity-80">×{cnt}</span>
              <span className="opacity-60 text-[9px]">· {length}d</span>
            </span>
          );
        })}
      </div>
    </button>
  );
}

function StepDetails({
  name,
  setName,
  goal,
  setGoal,
  kickoffAt,
  setKickoffAt,
  notes,
  setNotes,
}: {
  name: string;
  setName: (s: string) => void;
  goal: string;
  setGoal: (s: string) => void;
  kickoffAt: string;
  setKickoffAt: (s: string) => void;
  notes: string;
  setNotes: (s: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label htmlFor="cname">Nazwa kampanii</Label>
        <Input
          id="cname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Np. Wizja jesień&apos;26 — opowieść artystów"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cgoal">Wizja / cel narracji</Label>
        <Textarea
          id="cgoal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          placeholder="Co opowiadasz przez tę kampanię? Jaka emocja ma towarzyszyć widzowi od T1 do końca? Jak buduje się napięcie?"
          maxLength={500}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ct0">Start kampanii (kickoff)</Label>
        <Input
          id="ct0"
          type="datetime-local"
          value={kickoffAt}
          onChange={(e) => setKickoffAt(e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          To data 0 osi czasu. Wszystkie okresy kampanii są od niej liczone — nie jest
          to data premiery, tylko moment, w którym ruszasz z narracją.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cnotes">Notatki (opcjonalnie)</Label>
        <Textarea
          id="cnotes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Brand voice, kluczowi partnerzy, ograniczenia..."
          maxLength={2000}
        />
      </div>
    </div>
  );
}

function StepReview({
  template,
  name,
  goal,
  kickoffAt,
  notes,
}: {
  template: MarketingTemplate | null;
  name: string;
  goal: string;
  kickoffAt: string;
  notes: string;
}) {
  const t0 = kickoffAt ? new Date(kickoffAt) : null;
  const totalSubs = template
    ? template.milestones.reduce((s, m) => s + m.submilestones.length, 0)
    : 0;
  const periods = template ? resolvePeriods(template.periods) : [];
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card p-3 text-sm space-y-1">
        <Row
          label="Nazwa"
          value={name || <span className="text-rose-600">brak (uzupełnij krok 2)</span>}
        />
        <Row
          label="Wizja"
          value={goal || <span className="text-rose-600">brak</span>}
        />
        <Row
          label="Start"
          value={
            t0 && !Number.isNaN(t0.getTime())
              ? t0.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })
              : <span className="text-rose-600">brak</span>
          }
        />
        <Row
          label="Szablon"
          value={
            template ? (
              <span>
                {template.name}
                <span className="text-muted-foreground ml-1.5 tabular-nums">
                  · {template.milestones.length} milestone&apos;ów · {totalSubs} sub.
                </span>
              </span>
            ) : (
              <span className="text-rose-600">brak</span>
            )
          }
        />
        {notes ? <Row label="Notatki" value={notes} /> : null}
      </div>

      {template ? (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-bold">
            Co zostanie sklonowane
          </p>
          {periods.map((p, idx) => {
            const inP = template.milestones.filter((m) => m.period === p.code);
            if (inP.length === 0) return null;
            const tone = toneForIndex(idx);
            const length = p.endOffsetDays - p.startOffsetDays + 1;
            return (
              <div key={p.code} className="text-xs flex items-baseline gap-2">
                <span
                  className={`inline-flex items-center justify-center min-w-[1.5rem] h-4 px-1 rounded text-[9px] font-bold tracking-[0.16em] tabular-nums shrink-0 ${tone.bar} ${tone.ink}`}
                >
                  {p.code}
                </span>
                <span className="text-muted-foreground/70 text-[10px] tabular-nums shrink-0">
                  {length}d
                </span>
                <span className="text-muted-foreground">
                  {inP.map((m) => m.label).join(' · ')}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
