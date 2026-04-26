'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';

type Props = {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  /** When true, render as textarea (multi-line) */
  multiline?: boolean;
  placeholder?: string;
  /** Tailwind classes applied to BOTH the displayed value and the input */
  className?: string;
  /** Empty-state hint when value is empty (only in display mode) */
  emptyHint?: string;
};

export function InlineEdit({ value, onSave, multiline, placeholder, className, emptyHint }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === (value ?? '').trim()) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      try {
        await onSave(trimmed);
        toast.success('Zapisano');
        setEditing(false);
      } catch (e) {
        toast.error('Nie udało się zapisać', {
          description: e instanceof Error ? e.message : String(e),
        });
        setDraft(value);
        setEditing(false);
      }
    });
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          rows={3}
          placeholder={placeholder}
          className={`w-full bg-muted/30 border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 transition ${className ?? ''}`}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder}
        className={`w-full bg-muted/30 border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 transition ${className ?? ''}`}
      />
    );
  }

  const isEmpty = !value || value.trim() === '';

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group text-left -mx-2 px-2 py-1 rounded-md hover:bg-muted/30 transition relative ${className ?? ''}`}
      title="Kliknij, by edytować"
    >
      {isEmpty ? (
        <span className="text-muted-foreground/60 italic">{emptyHint ?? placeholder ?? 'Kliknij, by edytować'}</span>
      ) : multiline ? (
        <span className="whitespace-pre-wrap">{value}</span>
      ) : (
        <span>{value}</span>
      )}
      <Pencil className="inline-block ml-1.5 w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition" strokeWidth={1.5} />
    </button>
  );
}
