'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { applyTemplateToCampaign } from '@/server/actions/campaigns';
import type { MarketingTemplate } from '@/lib/campaign-templates-types';
import { resolvePeriods } from '@/lib/production-periods';
import { toneForIndex } from '@/lib/period-tones';

/**
 * "Zastosuj szablon" — gives a campaign that was created without a template
 * a narrative arc post-hoc. Renders only when the campaign has no template.
 * Clones periods + milestones identically to what the wizard would do at
 * creation. Refuses overwriting an existing template (server-side guard).
 */
export function ApplyTemplateButton({
  campaignId,
  templates,
}: {
  campaignId: number;
  templates: MarketingTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(
    templates[0]?.slug ?? null,
  );
  const [pending, startTransition] = useTransition();

  const apply = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await applyTemplateToCampaign(campaignId, selected);
        toast.success('Zastosowano szablon — kampania ma teraz narrację.');
        setOpen(false);
      } catch (e) {
        toast.error('Nie udało się zastosować szablonu', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3 text-xs text-amber-900">
        Brak szablonów kampanii. Utwórz pierwszy w{' '}
        <a href="/campaigns/templates/new" className="underline font-medium">
          /campaigns/templates/new
        </a>{' '}
        — bez szablonu kampania nie ma narracji.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3 flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
        <div className="flex-1 min-w-0 text-xs text-amber-900">
          <span className="font-semibold">Brak narracji.</span>{' '}
          Ta kampania powstała bez szablonu — nie ma nazwanych okresów ani
          milestone&apos;ów. Zastosuj szablon by dostać gotowy łuk narracyjny
          (build-up → premiera → afterglow itd.).
        </div>
        <Button
          type="button"
          size="xs"
          variant="default"
          onClick={() => setOpen(true)}
          disabled={pending}
        >
          Zastosuj szablon
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Zastosuj szablon do kampanii</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Szablon sklonuje swoje okresy (T1..Tn z nazwami) i milestone&apos;y
              do tej kampanii. Edytować będziesz mógł je sliderem na stronie
              kampanii — zmiana w szablonie nie wpłynie później na tę kampanię.
            </p>
            <div className="grid gap-2">
              {templates.map((t) => (
                <TemplateOption
                  key={t.slug}
                  template={t}
                  active={t.slug === selected}
                  onClick={() => setSelected(t.slug)}
                />
              ))}
            </div>
          </div>
          <DialogFooter className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Anuluj
            </Button>
            <Button onClick={apply} disabled={pending || !selected}>
              {pending ? 'Stosowanie…' : 'Zastosuj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplateOption({
  template,
  active,
  onClick,
}: {
  template: MarketingTemplate;
  active: boolean;
  onClick: () => void;
}) {
  const periods = resolvePeriods(template.periods);
  const totalSubs = template.milestones.reduce(
    (s, m) => s + m.submilestones.length,
    0,
  );
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-3.5 ui-transition ${
        active
          ? 'border-primary bg-primary/10 shadow-sm'
          : 'border-border hover:border-foreground/30 hover:bg-muted/30'
      }`}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="font-semibold text-sm tracking-tight">{template.name}</span>
        <span className="text-[10px] uppercase tracking-[0.12em] tabular-nums text-muted-foreground">
          {template.milestones.length} milestone&apos;ów · {totalSubs} sub.
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-snug mb-2">
        {template.summary}
      </p>
      <div className="flex flex-wrap gap-1">
        {periods.map((p, idx) => {
          const tone = toneForIndex(idx);
          return (
            <span
              key={p.code}
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${tone.bar} ${tone.ink}`}
            >
              <span className="font-bold tabular-nums tracking-wider">{p.code}</span>
              {p.name ? <span className="font-medium">{p.name}</span> : null}
            </span>
          );
        })}
      </div>
    </button>
  );
}
