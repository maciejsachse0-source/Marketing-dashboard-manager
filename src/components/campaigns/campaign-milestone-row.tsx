'use client';

/** Wiersz jednego kamienia milowego szablonu kampanii wraz z listą submilestone'ów.
 *  Wydzielony z `campaign-template-form.tsx` przy rozbiciu pliku (F3-08),
 *  treść bez zmian. */
import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  MarketingMilestone,
  MarketingSubmilestone,
} from '@/lib/campaign-templates-types';

export function MilestoneRow({
  milestone,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddSub,
  onUpdateSub,
  onRemoveSub,
  onMoveSub,
}: {
  milestone: MarketingMilestone;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (patch: Partial<MarketingMilestone>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddSub: () => void;
  onUpdateSub: (sIdx: number, patch: Partial<MarketingSubmilestone>) => void;
  onRemoveSub: (sIdx: number) => void;
  onMoveSub: (sIdx: number, dir: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-xl border-2 border-border bg-card transition">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="grid place-items-center w-2.5 h-2.5 rounded-full shrink-0 bg-foreground/40" />
        <Input
          value={milestone.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Etykieta milestone'u - np. Build-up: zapowiedź"
          maxLength={120}
          className="flex-1 bg-card h-8 text-sm font-semibold"
        />
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
          {milestone.submilestones.length} sub.
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="h-auto border-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
            title="Przesuń wyżej"
            aria-label="Przesuń wyżej"
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="h-auto border-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
            title="Przesuń niżej"
            aria-label="Przesuń niżej"
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            onClick={onRemove}
            className="h-auto border-0 p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 ui-transition"
            title="Usuń milestone"
            aria-label="Usuń milestone"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="h-auto border-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted ui-transition"
            aria-expanded={expanded}
            title={expanded ? 'Zwiń' : 'Rozwiń'}
          >
            <ChevronDown className={`size-3.5 ui-transition ${expanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-border/60 px-3 py-3 space-y-3 text-xs">
          <div className="grid gap-1.5">
            <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Opis (opcjonalnie)
            </Label>
            <Textarea
              value={milestone.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Co konkretnie ten milestone reprezentuje, co musi być gotowe…"
              maxLength={1000}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Submilestone&apos;y
              </Label>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={onAddSub}
                className="bg-card"
              >
                <Plus className="w-3 h-3 mr-1" /> Dodaj sub
              </Button>
            </div>

            {milestone.submilestones.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-3 text-center text-[11px] text-muted-foreground">
                Brak submilestone&apos;ów. Możesz zostawić tak - milestone będzie pojedynczym checkboxem.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {milestone.submilestones.map((s, sIdx) => (
                  <li key={s.id} className="rounded-md border border-border bg-background">
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <span className="text-[10px] text-muted-foreground tabular-nums w-5 shrink-0 text-center">
                        {sIdx + 1}.
                      </span>
                      <Input
                        value={s.label}
                        onChange={(e) => onUpdateSub(sIdx, { label: e.target.value })}
                        placeholder="Submilestone - np. Snippet audio gotowy"
                        maxLength={120}
                        className="flex-1 h-7 text-xs"
                      />
                      <Button
                        variant="ghost"
                        onClick={() => onMoveSub(sIdx, -1)}
                        disabled={sIdx === 0}
                        className="h-auto border-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
                        title="Przesuń wyżej"
                        aria-label="Przesuń wyżej"
                      >
                        <ArrowUp className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => onMoveSub(sIdx, 1)}
                        disabled={sIdx === milestone.submilestones.length - 1}
                        className="h-auto border-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
                        title="Przesuń niżej"
                        aria-label="Przesuń niżej"
                      >
                        <ArrowDown className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => onRemoveSub(sIdx)}
                        className="h-auto border-0 p-0.5 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 ui-transition"
                        title="Usuń submilestone"
                        aria-label="Usuń submilestone"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <Textarea
                      value={s.description ?? ''}
                      onChange={(e) => onUpdateSub(sIdx, { description: e.target.value })}
                      placeholder="Opis (opcjonalnie)…"
                      rows={1}
                      maxLength={1000}
                      className="text-[11px] mx-2 mb-1.5 px-2 py-1 min-h-0 h-7 resize-y"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="text-[10px] text-muted-foreground">
            <span className="font-mono">id: {milestone.id}</span>
          </div>
        </div>
      ) : null}
    </li>
  );
}
