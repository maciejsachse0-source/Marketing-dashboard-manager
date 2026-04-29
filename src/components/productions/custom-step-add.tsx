'use client';

import { useRef, useState } from 'react';
import { FileUp, Paperclip, Plus, X } from 'lucide-react';
import {
  addCustomStep,
  attachFileToCustomStep,
} from '@/server/actions/production-custom-steps';
import type {
  ProductionStage,
  ProductionStatus,
} from '../../../drizzle/schema';

/**
 * Inline "add step" form. Collapsed by default → "+ Dodaj krok" link.
 * Expanded form has: label input, optional description, optional file.
 *
 * The new step is appended at the END of the category's joint sequence
 * (canonicals + existing customs). User reorders it afterwards using ↑/↓
 * arrows on the step row — no positionAfter picker, no "sub-step" framing.
 */
export function CustomStepAddInline({
  productionId,
  category,
  canonicalStages,
}: {
  productionId: number;
  category: ProductionStage;
  canonicalStages: ProductionStatus[];
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setLabel('');
    setDescription('');
    setFile(null);
    setError(null);
  };

  const onSubmit = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Etykieta nie może być pusta');
      return;
    }
    setBusy(true);
    setError(null);
    // Default to last canonical so the new step lands at the end of the
    // joint sequence (after every existing canonical and existing custom).
    const positionAfter = canonicalStages[canonicalStages.length - 1];
    const res = await addCustomStep(
      productionId,
      category,
      positionAfter,
      trimmed,
      description.trim() || undefined,
    );
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      const upload = await attachFileToCustomStep(productionId, category, res.stepId, fd);
      if (!upload.ok) {
        setError(`Krok dodany, ale plik się nie wgrał: ${upload.error}`);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    setOpen(false);
    reset();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
        Dodaj krok
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
          Nowy krok
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition"
          aria-label="Anuluj"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit();
            if (e.key === 'Escape') {
              setOpen(false);
              reset();
            }
          }}
          placeholder="np. rozmowa z kamerzystą"
          maxLength={80}
          className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <p className="text-[10px] text-muted-foreground italic">
          Krok pojawi się na końcu listy. Kolejność zmienisz strzałkami ↑/↓.
        </p>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            Opis (opcjonalnie)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detale, kontekst, rzeczy do zrobienia…"
            maxLength={1000}
            rows={2}
            className="w-full px-3 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium block">
            Plik (opcjonalnie)
          </label>
          {file ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5">
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs flex-1 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-1 rounded text-muted-foreground hover:text-rose-600 transition"
                aria-label="Usuń plik"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-dashed border-border hover:border-foreground/40 hover:bg-muted/30 transition text-xs text-muted-foreground"
            >
              <FileUp className="w-3.5 h-3.5" />
              Wybierz plik (max 25 MB)
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && f.size > 25 * 1024 * 1024) {
                setError('Plik > 25 MB');
                return;
              }
              setFile(f ?? null);
            }}
          />
        </div>

        {error ? <div className="text-xs text-rose-600">{error}</div> : null}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !label.trim()}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
          >
            {busy ? 'Dodawanie…' : 'Dodaj krok'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}
