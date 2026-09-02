'use client';

/** Wiersz pojedynczego kroku szablonu: etykieta, kolejność w kategorii, kasowanie
 *  oraz rozwijane szczegóły (opis, tryb daty, typ wpisu w kalendarzu, czas trwania).
 *  Wydzielony z `template-form.tsx` przy rozbiciu pliku (F3-07), treść bez zmian. */
import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { STEP_DATE_MODES, type StepCalendarType, type StepDateMode } from '../../../drizzle/schema';
import type { TemplateStep } from '@/lib/production-templates-types';
import { CALENDAR_TYPE_LABEL, DATE_MODE_LABEL, type Tone } from './template-form-utils';

export function StepRow({
  step,
  displayNumber,
  canMoveUp,
  canMoveDown,
  tone,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: TemplateStep;
  displayNumber: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  tone: Tone;
  onChange: (patch: Partial<TemplateStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className={`group rounded-xl border-2 ${tone.border} bg-card transition`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className={`grid place-items-center size-5 rounded-full text-[10px] font-bold tabular-nums text-white shrink-0 ${tone.dot}`}
        >
          {displayNumber}
        </span>
        <Input
          value={step.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Etykieta kroku - np. wysłanie maila"
          maxLength={80}
          className="flex-1 bg-card h-8 text-sm"
        />
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="h-auto border-0 font-normal bg-clip-border p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
            title="Przesuń wyżej"
            aria-label="Przesuń wyżej"
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="h-auto border-0 font-normal bg-clip-border p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed ui-transition"
            title="Przesuń niżej"
            aria-label="Przesuń niżej"
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            onClick={onRemove}
            className="h-auto border-0 font-normal bg-clip-border p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 ui-transition"
            title="Usuń krok"
            aria-label="Usuń krok"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="h-auto border-0 font-normal bg-clip-border p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted ui-transition"
            aria-expanded={expanded}
            title={expanded ? 'Zwiń' : 'Ustawienia kroku'}
          >
            <ChevronDown
              className={`size-3.5 ui-transition ${expanded ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>
      </div>

      {step.description && !expanded ? (
        <div className="px-3 pb-2 -mt-1 pl-10 text-[11px] text-muted-foreground/80 italic truncate">
          {step.description}
        </div>
      ) : null}

      {expanded ? <StepDetails step={step} onChange={onChange} /> : null}
    </li>
  );
}

/** Rozwinięte ustawienia kroku. Wydzielone z `StepRow`, żeby obie funkcje zmieściły
 *  się w progu złożoności 10 z zasady Z11; treść panelu bez zmian. */
function StepDetails({
  step,
  onChange,
}: {
  step: TemplateStep;
  onChange: (patch: Partial<TemplateStep>) => void;
}) {
  const isCalendar = step.dateMode === 'calendar';
  return (
        <div className="border-t border-border/60 px-3 py-3 space-y-3 text-xs">
          <div className="grid gap-1.5">
            <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Opis (podpowiedź dla użytkownika)
            </Label>
            <Textarea
              value={step.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Co konkretnie zrobić w tym kroku, na co zwrócić uwagę…"
              maxLength={1000}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Tryb daty
              </Label>
              <select
                value={step.dateMode ?? 'none'}
                onChange={(e) => onChange({ dateMode: e.target.value as StepDateMode })}
                className="rounded-md border border-input bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STEP_DATE_MODES.map((m) => (
                  <option key={m} value={m}>
                    {DATE_MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            {isCalendar ? (
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Typ wpisu kalendarza
                </Label>
                <select
                  value={step.calendarType ?? 'meeting'}
                  onChange={(e) =>
                    onChange({ calendarType: e.target.value as StepCalendarType })
                  }
                  className="rounded-md border border-input bg-card px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {(['meeting', 'shoot', 'edit', 'deadline'] as StepCalendarType[]).map((t) => (
                    <option key={t} value={t}>
                      {CALENDAR_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {isCalendar ? (
            <div className="grid gap-1.5">
              <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Domyślny czas trwania (minuty)
              </Label>
              <Input
                type="number"
                min={0}
                max={1440}
                value={step.durationMinutes ?? 0}
                onChange={(e) =>
                  onChange({ durationMinutes: Math.max(0, Number(e.target.value) || 0) })
                }
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                0 = punkt w czasie (deadline). Inaczej - domyślny zakres na kalendarzu.
              </p>
            </div>
          ) : null}

          <div className="text-[10px] text-muted-foreground">
            <span className="font-mono">id: {step.id}</span>
          </div>
        </div>
  );
}
