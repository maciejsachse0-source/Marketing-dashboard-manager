'use client';

import { useEffect, useRef } from 'react';

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
 *
 * Handler is pinned in a ref so the effect re-runs only when `key` changes;
 * the latest handler closure is invoked on every keystroke without callers
 * having to remember a deps array. The previous deps-array signature led
 * to stale-closure bugs whenever a caller forgot to list a state value.
 */
export function useShortcut(key: string, handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== key) return;
      if (isTypingTarget(e.target)) return;
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key]);
}
