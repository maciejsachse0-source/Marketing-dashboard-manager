'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  Circle,
  FileUp,
  Lock,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  attachFileToStep,
  cascadeStepsTo,
  moveStepInProduction,
  removeStepAttachment,
  removeStepFromProduction,
  renameStep,
  setStepDate,
  updateStepDescription,
} from '@/server/actions/production-steps';
import { getStepWeekRange } from '@/lib/production-steps';
import type { ProductionStep } from '../../../drizzle/schema';

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function toLocalDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(d: Date, withTime: boolean): string {
  return withTime
    ? d.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString('pl-PL', { dateStyle: 'medium' });
}

/**
 * One step in a production's pipeline. After the flexible-steps refactor,
 * every step (formerly canonical OR custom) renders the same way:
 *   • checkbox toggles a cascade (mark = this + all before; unmark = this +
 *     all after)
 *   • label is renameable in place
 *   • date picker appears when `dateMode !== 'none'`; T-0 anchor cascade
 *     auto-derives downstream `derived-from-shooting` steps
 *   • move arrows (within the same category only)
 *   • delete button
 *   • expandable area: description + attachment
 *
 * Mirrors the old `SubStageButton + CustomStepRow + StageDatePicker` trio
 * but as a single uniform widget — there's no longer a notion of "canonical"
 * vs "custom".
 */
export function ProductionStepRow({
  productionId,
  productionT0At,
  step,
  state,
  displayNumber,
  canMoveUp,
  canMoveDown,
  productionCancelled,
}: {
  productionId: number;
  /** Production's T-0 timestamp — used to compute the calendar-week range
   *  the step's date is allowed to land in (T1/T2/T3 lock). */
  productionT0At: Date;
  step: ProductionStep;
  state: 'passed' | 'active' | 'pending';
  displayNumber: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  productionCancelled: boolean;
}) {
  const [optimisticState, setOptimisticState] = useOptimistic(state);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(step.label);
  const [editingDate, setEditingDate] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState(step.description ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const done = !!step.doneAt;
  const dateMode = step.dateMode ?? 'none';
  const isDerived = dateMode === 'derived-from-shooting';

  const onCascadeClick = () => {
    if (productionCancelled) return;
    startTransition(async () => {
      // Toggle: if already passed → unmark cascade (this + everything after);
      // otherwise → mark cascade (this + everything before).
      const mode = optimisticState === 'passed' ? 'unmark' : 'mark';
      setOptimisticState(mode === 'mark' ? 'active' : 'pending');
      await cascadeStepsTo(productionId, step.id, mode);
    });
  };

  const onMove = (direction: 'up' | 'down') => {
    startTransition(() => {
      moveStepInProduction(productionId, step.id, direction);
    });
  };

  const onDelete = () => {
    if (!confirm(`Usunąć krok „${step.label}"?\nTej operacji nie można cofnąć.`)) return;
    startTransition(() => {
      removeStepFromProduction(productionId, step.id);
    });
  };

  const saveLabel = () => {
    const trimmed = labelDraft.trim();
    if (!trimmed || trimmed === step.label) {
      setEditingLabel(false);
      setLabelDraft(step.label);
      return;
    }
    startTransition(async () => {
      const res = await renameStep(productionId, step.id, trimmed);
      if (!res.ok) {
        setLabelDraft(step.label);
      }
      setEditingLabel(false);
    });
  };

  const saveDate = (iso: string | null) => {
    setDateError(null);
    startTransition(async () => {
      const res = await setStepDate(productionId, step.id, iso);
      if (!res.ok) setDateError(res.error);
      else setEditingDate(false);
    });
  };

  const saveDesc = () => {
    if (descDraft === (step.description ?? '')) return;
    startTransition(() => {
      updateStepDescription(productionId, step.id, descDraft);
    });
  };

  const onPickFile = () => fileRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', f);
    await attachFileToStep(productionId, step.id, fd);
    setBusy(false);
    e.target.value = '';
  };
  const onRemoveFile = () => {
    startTransition(() => {
      removeStepAttachment(productionId, step.id);
    });
  };

  const date = step.dateIso ? new Date(step.dateIso) : null;
  const withTime = (step.durationMinutes ?? 60) > 0 || dateMode === 'calendar';

  // Step is locked to the calendar week of its T-frame. Surfaced both as
  // input min/max (browser blocks pick) AND as a server-side guard inside
  // setStepDate (covers paste / programmatic submits).
  const weekRange = getStepWeekRange(productionT0At, step.category);
  const inputMin = withTime
    ? toLocalInputValue(weekRange.start)
    : toLocalDateValue(weekRange.start);
  const inputMax = withTime
    ? toLocalInputValue(weekRange.end)
    : toLocalDateValue(weekRange.end);
  const weekRangeLabel = `${weekRange.start.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
  })}–${weekRange.end.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
  })}`;

  // Visual state — passed/active/pending styling on the outer card.
  const cardTone = productionCancelled
    ? 'border-border bg-card opacity-60'
    : optimisticState === 'passed'
      ? 'border-[var(--accent-blue)]/30 bg-[var(--accent-blue-tint)]'
      : optimisticState === 'active'
        ? 'border-foreground/40 bg-card shadow-sm'
        : 'border-border bg-card hover:border-foreground/40';

  return (
    <div className={`group rounded-xl border transition ${cardTone}`}>
      <div className="flex items-center gap-2.5 px-3 py-2">
        {/* Cascade checkbox — same visual language as the old SubStageButton */}
        <button
          type="button"
          onClick={onCascadeClick}
          aria-label={done ? `Cofnij krok: ${step.label}` : `Odhacz krok: ${step.label}`}
          aria-pressed={done}
          disabled={pending || productionCancelled}
          className="shrink-0 disabled:opacity-50"
        >
          {optimisticState === 'passed' ? (
            <span className="w-4 h-4 rounded-full bg-[var(--accent-blue)] grid place-items-center text-white">
              <Check className="w-2.5 h-2.5" strokeWidth={3} />
            </span>
          ) : optimisticState === 'active' ? (
            <span className="w-4 h-4 rounded-full bg-foreground grid place-items-center">
              <span className="block w-1.5 h-1.5 rounded-full bg-background animate-pulse" />
            </span>
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition" strokeWidth={1.75} />
          )}
        </button>

        {/* Label — editable in place */}
        <div className="flex-1 min-w-0">
          {editingLabel ? (
            <input
              type="text"
              value={labelDraft}
              maxLength={80}
              autoFocus
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') {
                  setLabelDraft(step.label);
                  setEditingLabel(false);
                }
              }}
              className="w-full text-sm font-medium px-1 py-0.5 rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingLabel(true)}
              className={`text-sm font-medium text-left w-full truncate ui-transition ${
                done ? 'line-through text-muted-foreground' : 'text-foreground hover:text-[var(--accent-blue)]'
              }`}
              title="Kliknij, aby zmienić etykietę"
            >
              <span className="tabular-nums opacity-70 mr-1">{displayNumber}.</span>
              {step.label}
              <Pencil className="inline-block w-3 h-3 ml-1 opacity-0 group-hover:opacity-50 transition" />
            </button>
          )}
        </div>

        {step.isT0Anchor ? (
          <span
            className="shrink-0 text-[9px] uppercase tracking-[0.14em] font-bold px-1.5 py-0.5 rounded bg-foreground text-background"
            title="Krok-kotwica T-0 — oś czasu na gantcie"
          >
            T-0
          </span>
        ) : null}

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
          <button
            type="button"
            onClick={() => onMove('up')}
            disabled={!canMoveUp || pending}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Przesuń w górę"
            title="Przesuń w górę"
          >
            <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onMove('down')}
            disabled={!canMoveDown || pending}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Przesuń w dół"
            title="Przesuń w dół"
          >
            <ArrowDown className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition"
            aria-label="Usuń krok"
            title="Usuń krok"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition shrink-0"
          aria-expanded={expanded}
          aria-label={expanded ? 'Zwiń' : 'Rozwiń'}
          title={expanded ? 'Zwiń' : 'Opis + plik'}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Date row — only when the step has a non-none dateMode. Stays visible
          even when collapsed (it's an action-y CTA, not metadata). */}
      {dateMode !== 'none' ? (
        <div className="px-3 pb-2 -mt-1 pl-9">
          {isDerived ? (
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span className="italic">data:</span>
              <span className="font-medium tabular-nums">
                {date ? formatDate(date, withTime) : 'czeka na datę nagrań'}
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 ml-1">
                · auto z nagrywki
              </span>
            </div>
          ) : !editingDate ? (
            <button
              type="button"
              onClick={() => setEditingDate(true)}
              disabled={productionCancelled}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition disabled:opacity-50 ${
                date
                  ? 'bg-[var(--accent-blue-tint)] text-[var(--accent-blue)] hover:bg-[var(--accent-blue-soft)]/40'
                  : 'border border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              {date ? <Calendar className="w-3 h-3" /> : <CalendarPlus className="w-3 h-3" />}
              <span className="italic">data:</span>
              <span className="not-italic font-medium tabular-nums">
                {date ? formatDate(date, withTime) : 'wpisz'}
              </span>
              {dateMode === 'calendar' && date ? (
                <span className="ml-1 text-[9px] uppercase tracking-[0.12em] text-[var(--accent-blue)] font-semibold">
                  · w kalendarzu
                </span>
              ) : null}
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type={withTime ? 'datetime-local' : 'date'}
                defaultValue={
                  date
                    ? withTime
                      ? toLocalInputValue(date)
                      : toLocalDateValue(date)
                    : ''
                }
                min={inputMin}
                max={inputMax}
                autoFocus
                disabled={pending}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    setEditingDate(false);
                    return;
                  }
                  const iso = new Date(v).toISOString();
                  if (iso !== step.dateIso) saveDate(iso);
                  else setEditingDate(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingDate(false);
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="px-2 py-1 rounded-md border border-border bg-background text-[11px] font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span
                className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80 tabular-nums"
                title="Krok jest przypięty do tygodnia swojej fazy"
              >
                {weekRangeLabel}
              </span>
              {date ? (
                <button
                  type="button"
                  onClick={() => saveDate(null)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-rose-600 transition"
                >
                  <Trash2 className="w-3 h-3" />
                  wyczyść
                </button>
              ) : null}
              {dateError ? <span className="text-[11px] text-rose-600">{dateError}</span> : null}
            </div>
          )}
        </div>
      ) : null}

      {/* Description + attachment chip when collapsed */}
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
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
              Opis (opcjonalnie)
            </label>
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={saveDesc}
              placeholder="Detale, kontekst, rzeczy do zrobienia…"
              maxLength={1000}
              rows={2}
              className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
            <p className="text-[10px] text-muted-foreground italic">
              Zapisuje się po wyjściu z pola (blur).
            </p>
          </div>

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
            <input ref={fileRef} type="file" hidden onChange={onFileChange} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
