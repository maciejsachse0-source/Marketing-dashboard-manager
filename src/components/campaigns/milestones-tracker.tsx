'use client';

import { useState, useTransition } from 'react';
import { Check, Circle, MinusCircle, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  toggleCampaignMilestone,
  cascadeCampaignMilestone,
  updateCampaignMilestone,
  updateCampaignSubmilestone,
  addCampaignMilestone,
  addCampaignSubmilestone,
  deleteCampaignMilestone,
  deleteCampaignSubmilestone,
} from '@/server/actions/campaigns';
import { toneForIndex } from '@/lib/period-tones';
import { resolvePeriods, type TemplatePeriod } from '@/lib/production-periods';
import { Button } from '@/components/ui/button';
import { InlineEdit } from '@/components/inline-edit';
import type { CampaignMilestones } from '../../../drizzle/schema';

/**
 * Milestones tracker — full CRUD for the campaign's narrative steps. Each
 * period bucket (T1, T2, …) renders its milestones as a numbered list. A
 * milestone with submilestones is a "phase summary" — clicking the parent
 * checkbox cascades mark/unmark to all its submilestones. A milestone
 * without submilestones (added inline) toggles directly.
 *
 * Inline edit on label + description, "+ dodaj" inputs at the bottom of
 * each list, trash buttons to remove. All persistence goes through server
 * actions on the campaigns module.
 */
export function MilestonesTracker({
  campaignId,
  milestones,
  periods,
}: {
  campaignId: number;
  milestones: CampaignMilestones;
  /** Periods owned by the campaign — drives bucket order, codes, and tone
   *  matching with the slider above. Falls back to defaults if absent. */
  periods?: TemplatePeriod[] | null;
}) {
  const [pending, startTransition] = useTransition();

  const fire = <T,>(label: string, op: () => Promise<T>): void => {
    if (pending) return;
    startTransition(async () => {
      try {
        await op();
      } catch (e) {
        toast.error(label, {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    });
  };

  const toggle = (milestoneId: string, submilestoneId?: string) =>
    fire('Nie udało się zmienić stanu', () =>
      toggleCampaignMilestone(campaignId, milestoneId, submilestoneId),
    );

  const cascade = (milestoneId: string, mode: 'mark' | 'unmark') =>
    fire('Nie udało się zmienić stanu', () =>
      cascadeCampaignMilestone(campaignId, milestoneId, mode),
    );

  const editMilestone = (
    milestoneId: string,
    patch: { label?: string; description?: string | null },
  ) =>
    new Promise<void>((resolve, reject) =>
      startTransition(async () => {
        try {
          await updateCampaignMilestone(campaignId, milestoneId, patch);
          resolve();
        } catch (e) {
          toast.error('Nie udało się zapisać', {
            description: e instanceof Error ? e.message : String(e),
          });
          reject(e);
        }
      }),
    );

  const editSubmilestone = (
    milestoneId: string,
    submilestoneId: string,
    patch: { label?: string; description?: string | null },
  ) =>
    new Promise<void>((resolve, reject) =>
      startTransition(async () => {
        try {
          await updateCampaignSubmilestone(
            campaignId,
            milestoneId,
            submilestoneId,
            patch,
          );
          resolve();
        } catch (e) {
          toast.error('Nie udało się zapisać', {
            description: e instanceof Error ? e.message : String(e),
          });
          reject(e);
        }
      }),
    );

  const addMilestone = (period: string, label: string) =>
    fire('Nie udało się dodać milestone', () =>
      addCampaignMilestone(campaignId, period, label),
    );

  const addSub = (milestoneId: string, label: string) =>
    fire('Nie udało się dodać kroku', () =>
      addCampaignSubmilestone(campaignId, milestoneId, label),
    );

  const removeMilestone = (milestoneId: string, label: string) => {
    if (!confirm(`Usunąć milestone „${label}"? Submilestone'y zostaną usunięte razem.`))
      return;
    fire('Nie udało się usunąć milestone', () =>
      deleteCampaignMilestone(campaignId, milestoneId),
    );
  };

  const removeSub = (milestoneId: string, submilestoneId: string, label: string) => {
    if (!confirm(`Usunąć krok „${label}"?`)) return;
    fire('Nie udało się usunąć kroku', () =>
      deleteCampaignSubmilestone(campaignId, milestoneId, submilestoneId),
    );
  };

  const totalSubs = milestones.reduce((s, m) => s + m.submilestones.length, 0);
  const doneSubs = milestones.reduce(
    (s, m) => s + m.submilestones.filter((sm) => sm.doneAt).length,
    0,
  );
  const doneMain = milestones.filter((m) => {
    if (m.submilestones.length > 0) return m.submilestones.every((s) => s.doneAt);
    return !!m.doneAt;
  }).length;
  const totalMain = milestones.length;

  const resolved = resolvePeriods(periods);
  const orderedCodes: string[] = resolved.map((p) => p.code);
  const codeToName = new Map<string, string | undefined>(
    resolved.map((p) => [p.code, p.name]),
  );
  const orphanCodes = Array.from(
    new Set(milestones.map((m) => m.period).filter((c) => !orderedCodes.includes(c))),
  );

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">
            Kamienie milowe
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doneMain}/{totalMain} milestone&apos;ów ·{' '}
            {totalSubs > 0 ? `${doneSubs}/${totalSubs} kroków` : 'bez kroków'} · klik
            w nazwę aby edytować
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          {totalSubs > 0
            ? `${Math.round((doneSubs / totalSubs) * 100)}% kroków`
            : `${totalMain > 0 ? Math.round((doneMain / totalMain) * 100) : 0}% milestone'ów`}
        </span>
      </header>

      <div className="space-y-3">
        {orderedCodes.map((code, idx) => {
          const inP = milestones.filter((m) => m.period === code);
          const tone = toneForIndex(idx);
          return (
            <PeriodBucket
              key={code}
              code={code}
              name={codeToName.get(code)}
              periodIndex={idx}
              tone={tone}
              milestones={inP}
              pending={pending}
              onToggle={toggle}
              onCascade={cascade}
              onEditMilestone={editMilestone}
              onEditSubmilestone={editSubmilestone}
              onAddMilestone={(label) => addMilestone(code, label)}
              onAddSubmilestone={addSub}
              onRemoveMilestone={removeMilestone}
              onRemoveSubmilestone={removeSub}
            />
          );
        })}
        {orphanCodes.map((code) => {
          const inP = milestones.filter((m) => m.period === code);
          const idx =
            (code.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 6) +
            orderedCodes.length;
          const tone = toneForIndex(idx);
          return (
            <PeriodBucket
              key={code}
              code={code}
              name={undefined}
              periodIndex={idx}
              tone={tone}
              milestones={inP}
              pending={pending}
              onToggle={toggle}
              onCascade={cascade}
              onEditMilestone={editMilestone}
              onEditSubmilestone={editSubmilestone}
              onAddMilestone={(label) => addMilestone(code, label)}
              onAddSubmilestone={addSub}
              onRemoveMilestone={removeMilestone}
              onRemoveSubmilestone={removeSub}
              orphan
            />
          );
        })}
      </div>
    </section>
  );
}

function PeriodBucket({
  code,
  name,
  periodIndex,
  tone,
  milestones,
  pending,
  onToggle,
  onCascade,
  onEditMilestone,
  onEditSubmilestone,
  onAddMilestone,
  onAddSubmilestone,
  onRemoveMilestone,
  onRemoveSubmilestone,
  orphan,
}: {
  code: string;
  name: string | undefined;
  periodIndex: number;
  tone: { bg: string; bar: string; thumb: string; ink: string };
  milestones: CampaignMilestones;
  pending: boolean;
  onToggle: (milestoneId: string, submilestoneId?: string) => void;
  onCascade: (milestoneId: string, mode: 'mark' | 'unmark') => void;
  onEditMilestone: (
    milestoneId: string,
    patch: { label?: string; description?: string | null },
  ) => Promise<void>;
  onEditSubmilestone: (
    milestoneId: string,
    submilestoneId: string,
    patch: { label?: string; description?: string | null },
  ) => Promise<void>;
  onAddMilestone: (label: string) => void;
  onAddSubmilestone: (milestoneId: string, label: string) => void;
  onRemoveMilestone: (milestoneId: string, label: string) => void;
  onRemoveSubmilestone: (
    milestoneId: string,
    submilestoneId: string,
    label: string,
  ) => void;
  orphan?: boolean;
}) {
  const doneInP = milestones.filter((m) => {
    if (m.submilestones.length > 0) return m.submilestones.every((s) => s.doneAt);
    return !!m.doneAt;
  }).length;
  return (
    <div className={`rounded-2xl border-2 border-border ${tone.bg} p-4 space-y-2.5`}>
      <header className="flex items-center gap-2.5">
        <span
          className={`inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md text-[11px] font-bold tracking-[0.18em] tabular-nums ${tone.bar} ${tone.ink}`}
        >
          {code}
        </span>
        <div className="flex flex-col">
          <span
            className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${tone.ink}`}
          >
            {name ? name : `Okres ${code}`}
            {orphan ? (
              <span className="ml-2 text-[9px] uppercase tracking-[0.12em] text-amber-700/80 normal-case">
                (poza obecnym timeline&apos;m — usuń lub zmień period)
              </span>
            ) : null}
          </span>
          {name ? (
            <span className={`text-[9px] tracking-[0.12em] ${tone.ink} opacity-60 tabular-nums`}>
              {code} · faza {periodIndex + 1}
            </span>
          ) : null}
        </div>
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          {doneInP}/{milestones.length}
        </span>
      </header>

      <ol className="space-y-2">
        {milestones.map((m, mIdx) => {
          const allSubsDone =
            m.submilestones.length > 0 && m.submilestones.every((s) => s.doneAt);
          const someSubsDone =
            m.submilestones.length > 0 &&
            m.submilestones.some((s) => s.doneAt) &&
            !allSubsDone;
          const directlyDone = m.submilestones.length === 0 && !!m.doneAt;
          const isDone = allSubsDone || directlyDone;
          const isMixed = someSubsDone;
          const stepNo = `${periodIndex + 1}.${mIdx + 1}`;

          const handleParentClick = () => {
            if (m.submilestones.length === 0) {
              onToggle(m.id);
            } else {
              // Cascade: if all done, unmark; else mark all.
              onCascade(m.id, allSubsDone ? 'unmark' : 'mark');
            }
          };

          return (
            <li
              key={m.id}
              className={`rounded-lg border bg-card transition ${isDone ? 'opacity-80' : ''}`}
            >
              <div className="flex items-start gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={handleParentClick}
                  disabled={pending}
                  className={`mt-0.5 grid place-items-center w-5 h-5 rounded-full border-2 shrink-0 ui-transition cursor-pointer ${
                    isDone
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : isMixed
                        ? 'bg-amber-100 border-amber-400 text-amber-700 hover:bg-amber-200'
                        : 'bg-card border-border text-transparent hover:border-foreground/40'
                  }`}
                  title={
                    m.submilestones.length > 0
                      ? allSubsDone
                        ? 'Cofnij całą fazę (odznacz wszystkie kroki)'
                        : 'Zaznacz całą fazę (zaznacz wszystkie kroki)'
                      : isDone
                        ? 'Odznacz'
                        : 'Zaznacz jako zrobione'
                  }
                  aria-label="Toggle milestone"
                >
                  {isDone ? (
                    <Check className="w-3 h-3" strokeWidth={3} />
                  ) : isMixed ? (
                    <MinusCircle className="w-3 h-3" strokeWidth={2.5} />
                  ) : (
                    <Circle className="w-3 h-3" strokeWidth={2} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold leading-snug flex items-baseline gap-1.5 ${isDone ? 'line-through text-muted-foreground' : ''}`}
                  >
                    <span className="tabular-nums text-muted-foreground/60 font-bold shrink-0">
                      {stepNo}
                    </span>
                    <InlineEdit
                      value={m.label}
                      onSave={async (next) => {
                        if (!next.trim()) throw new Error('Nazwa nie może być pusta');
                        await onEditMilestone(m.id, { label: next });
                      }}
                      placeholder="Nazwa milestone'u"
                      className="flex-1 min-w-0"
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    <InlineEdit
                      value={m.description ?? ''}
                      onSave={async (next) => {
                        await onEditMilestone(m.id, {
                          description: next || null,
                        });
                      }}
                      placeholder="Opis fazy (opcjonalnie)"
                      emptyHint="+ Dodaj opis"
                      multiline
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveMilestone(m.id, m.label)}
                  disabled={pending}
                  className="p-1 rounded text-muted-foreground/50 hover:text-rose-600 hover:bg-rose-50 ui-transition shrink-0"
                  title="Usuń milestone"
                  aria-label="Delete milestone"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <ul className="border-t border-border/60 px-3 py-2 space-y-1.5">
                {m.submilestones.map((s, sIdx) => {
                  const sDone = !!s.doneAt;
                  const subStepNo = `${stepNo}.${sIdx + 1}`;
                  return (
                    <li key={s.id} className="flex items-start gap-2 group">
                      <button
                        type="button"
                        onClick={() => onToggle(m.id, s.id)}
                        disabled={pending}
                        className={`mt-0.5 grid place-items-center w-4 h-4 rounded-md border-2 shrink-0 ui-transition ${
                          sDone
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : 'bg-card border-border text-transparent hover:border-foreground/40 cursor-pointer'
                        }`}
                        title={sDone ? 'Odznacz' : 'Zaznacz jako zrobione'}
                        aria-label="Toggle submilestone"
                      >
                        {sDone ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : null}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs leading-snug flex items-baseline gap-1 ${sDone ? 'line-through text-muted-foreground' : ''}`}
                        >
                          <span className="tabular-nums text-muted-foreground/60 font-medium shrink-0">
                            {subStepNo}
                          </span>
                          <InlineEdit
                            value={s.label}
                            onSave={async (next) => {
                              if (!next.trim())
                                throw new Error('Nazwa nie może być pusta');
                              await onEditSubmilestone(m.id, s.id, { label: next });
                            }}
                            placeholder="Nazwa kroku"
                            className="flex-1 min-w-0"
                          />
                        </div>
                        {(s.description !== undefined || true) && (
                          <div className="text-[10.5px] text-muted-foreground/80 mt-0.5 leading-relaxed">
                            <InlineEdit
                              value={s.description ?? ''}
                              onSave={async (next) => {
                                await onEditSubmilestone(m.id, s.id, {
                                  description: next || null,
                                });
                              }}
                              placeholder="Opis kroku (opcjonalnie)"
                              emptyHint="+ opis"
                              multiline
                            />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveSubmilestone(m.id, s.id, s.label)}
                        disabled={pending}
                        className="p-1 rounded text-muted-foreground/30 hover:text-rose-600 hover:bg-rose-50 ui-transition shrink-0 opacity-0 group-hover:opacity-100"
                        title="Usuń krok"
                        aria-label="Delete submilestone"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  );
                })}
                <li>
                  <AddInline
                    placeholder="+ Dodaj krok do tej fazy"
                    onAdd={(label) => onAddSubmilestone(m.id, label)}
                    pending={pending}
                  />
                </li>
              </ul>
            </li>
          );
        })}
        <li>
          <AddInline
            placeholder={`+ Dodaj milestone w okresie ${name ?? code}`}
            onAdd={(label) => onAddMilestone(label)}
            pending={pending}
            tone={tone}
          />
        </li>
      </ol>
    </div>
  );
}

/**
 * Inline "add" input — collapsed to a hint-styled placeholder by default,
 * expands to a real input on click. Submitting Enter or clicking + commits;
 * Escape or click-outside cancels. Keeps the bucket header free of an
 * always-visible button (less visual noise per period).
 */
function AddInline({
  placeholder,
  onAdd,
  pending,
  tone,
}: {
  placeholder: string;
  onAdd: (label: string) => void;
  pending: boolean;
  tone?: { bar: string; ink: string };
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setOpen(false);
      setValue('');
      return;
    }
    onAdd(trimmed);
    setOpen(false);
    setValue('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className={`w-full text-left text-[11px] px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 ui-transition italic`}
      >
        {placeholder}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            setOpen(false);
            setValue('');
          }
        }}
        onBlur={submit}
        placeholder="Wpisz nazwę i Enter"
        className="flex-1 text-xs bg-card border border-border rounded px-2 py-1 focus:outline-none focus:border-foreground/40"
      />
      <Button
        type="button"
        size="xs"
        variant={tone ? 'default' : 'outline'}
        onMouseDown={(e) => {
          // mouseDown beats input.blur; otherwise the blur fires submit
          // first and the click below is a no-op on stale state.
          e.preventDefault();
          submit();
        }}
        disabled={pending || !value.trim()}
      >
        <Plus className="w-3 h-3" />
      </Button>
    </div>
  );
}
