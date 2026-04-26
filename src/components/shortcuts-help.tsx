'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

const SHORTCUTS = [
  { keys: '⌘ K', label: 'Otwórz paletę komend' },
  { keys: 'N', label: 'Nowy wpis (kalendarz / artyści)' },
  { keys: 'Esc', label: 'Zamknij modal / paletę' },
  { keys: '?', label: 'Pokaż tę listę' },
];

export function ShortcutsHelp() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== '?') return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      toast('Skróty klawiszowe', {
        duration: 6000,
        description: (
          <ul className="mt-2 space-y-1">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center gap-2 text-xs">
                <kbd className="font-mono px-1.5 py-0.5 rounded border border-border bg-muted/40 min-w-8 text-center">
                  {s.keys}
                </kbd>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        ) as unknown as string,
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
