'use client';

import { useEffect } from 'react';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Register a single-key shortcut that is ignored while focus is on an input.
 * Modifiers must be `false` (no Ctrl/Cmd/Alt) — Cmd+K is handled separately
 * in the command palette component.
 */
export function useShortcut(key: string, handler: (e: KeyboardEvent) => void, deps: unknown[] = []) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== key) return;
      if (isTypingTarget(e.target)) return;
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
