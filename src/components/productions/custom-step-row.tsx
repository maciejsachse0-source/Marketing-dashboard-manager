'use client';

import { useRef, useState, useTransition } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Circle,
  FileUp,
  Paperclip,
  Trash2,
  X,
} from 'lucide-react';
import {
  attachFileToCustomStep,
  moveCustomStep,
  removeCustomStep,
  removeCustomStepAttachment,
  toggleCustomStep,
  updateCustomStepDescription,
} from '@/server/actions/production-custom-steps';
import type { CustomStep, ProductionStage } from '../../../drizzle/schema';

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * One custom step rendered inline alongside canonical sub-stages on the
 * production detail page (or in the gantt expanded panel). Toggle, edit
 * description, attach file, manual reorder ↑/↓, delete — all in one row that
 * expands to reveal extra fields.
 */
export function CustomStepRow({
  productionId,
  category,
  step,
  canMoveUp,
  canMoveDown,
  displayNumber,
}: {
  productionId: number;
  category: ProductionStage;
  step: CustomStep;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Optional 1-based step number — when provided, prefixed before the label
   *  to match the corresponding numbered tick on the gantt sub-step bar. */
  displayNumber?: number;
}) {
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [draftDesc, setDraftDesc] = useState(step.description ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const done = !!step.doneAt;

  const onToggle = () => {
    startTransition(() => {
      toggleCustomStep(productionId, category, step.id);
    });
  };
  const onDelete = () => {
    if (!confirm(`Usunąć krok „${step.label}"?`)) return;
    startTransition(() => {
      removeCustomStep(productionId, category, step.id);
    });
  };
  const onMove = (direction: 'up' | 'down') => {
    startTransition(() => {
      moveCustomStep(productionId, category, step.id, direction);
    });
  };
  const onSaveDesc = () => {
    if (draftDesc === (step.description ?? '')) return;
    startTransition(() => {
      updateCustomStepDescription(productionId, category, step.id, draftDesc);
    });
  };
  const onPickFile = () => fileRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', f);
    await attachFileToCustomStep(productionId, category, step.id, fd);
    setBusy(false);
    e.target.value = '';
  };
  const onRemoveFile = () => {
    startTransition(() => {
      removeCustomStepAttachment(productionId, category, step.id);
    });
  };

  // Visual parity with canonical SubStageButton — same rounded-xl card, solid
  // border, same checkmark/circle icon and color tokens. The only kept
  // distinguishers are subtle: a small "+" pill marking it as an inserted step
  // and the chevron+actions on the right (move/delete/expand).
  return (
    <div
      className={`group rounded-xl border transition ${
        done
          ? 'border-[var(--accent-blue)]/30 bg-[var(--accent-blue-tint)]'
          : 'border-border bg-card hover:border-foreground/40'
      }`}
    >
      {/* Top row: checkbox + label + arrows + chevron */}
      <div className="flex items-center gap-2.5 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={done ? `Cofnij krok: ${step.label}` : `Odhacz krok: ${step.label}`}
          aria-pressed={done}
          className="shrink-0"
        >
          {done ? (
            <span className="w-4 h-4 rounded-full bg-[var(--accent-blue)] grid place-items-center text-white">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
          ) : (
            <Circle
              className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition"
              strokeWidth={1.75}
            />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-medium truncate ${
              done
                ? 'line-through text-muted-foreground'
                : 'text-muted-foreground group-hover:text-foreground'
            }`}
            title={step.label}
          >
            {displayNumber != null ? <span className="tabular-nums opacity-80 mr-1">{displayNumber}.</span> : null}
            {step.label}
          </div>
        </div>
        <span
          className="shrink-0 text-[9px] uppercase tracking-[0.14em] font-bold text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/60"
          title="Krok dodany ręcznie"
          aria-label="Krok dodatkowy"
        >
          dodatkowy
        </span>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
          <button
            type="button"
            onClick={() => onMove('up')}
            disabled={!canMoveUp}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Przesuń w górę"
            title="Przesuń w górę"
          >
            <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onMove('down')}
            disabled={!canMoveDown}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Przesuń w dół"
            title="Przesuń w dół"
          >
            <ArrowDown className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition"
            aria-label="Usuń krok"
            title="Usuń"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
          aria-expanded={expanded}
          aria-label={expanded ? 'Zwiń' : 'Rozwiń (opis + plik)'}
          title={expanded ? 'Zwiń' : 'Opis + plik'}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Trailer line — description + attachment chip rendered like canonical
          step's STAGE_HINT (italic, muted, slightly indented) so the visual
          weight matches a normal step row that has hint text below it. */}
      {(step.description || step.attachmentName) && !expanded ? (
        <div className="px-3 pb-2 -mt-1 pl-9 flex items-center gap-2 text-[11px] text-muted-foreground/80">
          {step.description ? (
            <span className="truncate italic">{step.description}</span>
          ) : null}
          {step.attachmentName ? (
            <span className="inline-flex items-center gap-1 shrink-0">
              <Paperclip className="w-3 h-3" />
              {step.attachmentName}
            </span>
          ) : null}
        </div>
      ) : null}

      {expanded ? (
        <div className="border-t border-border/60 px-3 py-3 space-y-3 text-xs">
          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
              Opis (opcjonalnie)
            </label>
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              onBlur={onSaveDesc}
              placeholder="Detale, kontekst, rzeczy do zrobienia…"
              maxLength={1000}
              rows={2}
              className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
            <p className="text-[10px] text-muted-foreground italic">
              Zapisuje się po wyjściu z pola (blur).
            </p>
          </div>

          {/* Attachment */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium block">
              Plik (opcjonalnie)
            </label>
            {step.attachmentPath ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5">
                <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs flex-1 truncate" title={step.attachmentName ?? ''}>
                  {step.attachmentName}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {step.attachmentSize ? formatBytes(step.attachmentSize) : ''}
                </span>
                <button
                  type="button"
                  onClick={onRemoveFile}
                  className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition"
                  aria-label="Usuń plik"
                  title="Usuń plik"
                >
                  <X className="w-3 h-3" strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onPickFile}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-border hover:border-foreground/40 hover:bg-muted/30 transition text-xs text-muted-foreground disabled:opacity-50"
              >
                <FileUp className="w-3.5 h-3.5" />
                {busy ? 'Wgrywanie…' : 'Wgraj plik (max 25 MB)'}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={onFileChange}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
