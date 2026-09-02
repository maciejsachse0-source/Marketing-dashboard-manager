'use client';

import { useState } from 'react';
import type { SaveCounts } from '@/lib/import/save';
import { readNdjson } from './read-ndjson';

type Wiadomosc = {
  batch?: number;
  of?: number;
  done?: boolean;
  error?: string;
  inserted?: number;
  updated?: number;
  skipped?: number;
};

export type SavePayload = {
  role: string;
  policy: string;
  mapping: (string | null)[];
  rows: (string | number | boolean | null)[][];
};

function podsumowanie(msg: Wiadomosc): SaveCounts {
  return {
    inserted: msg.inserted ?? 0,
    updated: msg.updated ?? 0,
    skipped: msg.skipped ?? 0,
  };
}

/**
 * Zapis importu ze strumienia NDJSON (kroki 6 i 7 z plan/04 sekcja 2).
 * Postęp bierze się z linii, które serwer wysyła po każdej zapisanej paczce,
 * więc licznik nie udaje niczego, czego jeszcze nie ma w transakcji.
 */
export function useImportSave() {
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (payload: SavePayload): Promise<SaveCounts | null> => {
    setSaving(true);
    setError(null);
    setProgress(null);
    let counts: SaveCounts | null = null;
    try {
      const res = await fetch('/api/import/people/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) throw new Error(`Zapis odrzucony przez serwer, HTTP ${res.status}`);

      for await (const raw of readNdjson(res.body)) {
        const msg = raw as Wiadomosc;
        if (msg.error) throw new Error(msg.error);
        if (msg.done) counts = podsumowanie(msg);
        else setProgress({ done: msg.batch ?? 0, total: msg.of ?? 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setSaving(false);
    }
    return counts;
  };

  return { saving, progress, error, save };
}
