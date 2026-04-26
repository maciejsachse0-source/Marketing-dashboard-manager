'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type Result = {
  uploadId: number;
  source: string;
  rowCount: number;
  path: string;
  created: number;
  updated: number;
  skipped: number;
};

export function CsvDropzone() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/csv', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setResult(json);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Wgraj plik .csv');
      return;
    }
    upload(f);
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        onFiles(e.dataTransfer.files);
      }}
      className={`rounded-lg border-2 border-dashed transition p-8 text-center ${
        dragActive ? 'border-foreground bg-muted/30' : 'border-border bg-card'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <div className="space-y-3">
        <div className="text-sm">
          {busy ? (
            <span className="text-muted-foreground">Wgrywanie…</span>
          ) : (
            <>
              <div className="font-medium">Przeciągnij CSV tutaj lub kliknij</div>
              <div className="text-xs text-muted-foreground mt-1">
                Eksporty z Meta Business Suite, TikTok Analytics, YouTube Studio
              </div>
            </>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          Wybierz plik
        </Button>
      </div>
      {error ? (
        <p className="mt-3 text-xs text-rose-400 text-left">⚠ {error}</p>
      ) : null}
      {result ? (
        <div className="mt-3 text-xs text-left space-y-0.5">
          <p className="text-emerald-400">
            ✓ Wgrano {result.rowCount} wierszy ({result.source})
          </p>
          <p className="text-muted-foreground">
            +{result.created} nowych postów, {result.updated} zaktualizowanych
            {result.skipped > 0 ? `, ${result.skipped} pominiętych (niekompatybilny format)` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
