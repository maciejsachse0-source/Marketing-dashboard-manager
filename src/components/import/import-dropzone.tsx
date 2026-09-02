'use client';

import { useRef, useState } from 'react';
import { TriangleAlert, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkFile, IMPORT_LIMITS, megabytes } from '@/lib/import/limits';

/**
 * Krok 1: wybór pliku (plan/04 sekcja 2). Rozszerzenie i rozmiar sprawdzane
 * natychmiast po upuszczeniu, jeszcze przed wysłaniem czegokolwiek na serwer.
 * Serwer i tak sprawdza to samo drugi raz, bo przeglądarce się nie ufa.
 */
export function ImportDropzone({
  busy,
  serverError,
  onFile,
}: {
  busy: boolean;
  serverError: string | null;
  onFile: (file: File) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (files: FileList | null) => {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    const check = checkFile(file.name, file.size);
    if (!check.ok) {
      setError(check.message);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    onFile(file);
  };

  const message = error ?? serverError;

  return (
    <div className="grid gap-3">
      <div
        data-testid="import-dropzone"
        data-drag-active={dragActive}
        aria-busy={busy}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!busy) setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (busy) return;
          accept(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          dragActive ? 'border-ring bg-accent/40' : 'border-border bg-card'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          aria-label="Plik xlsx z osobami"
          className="hidden"
          disabled={busy}
          onChange={(e) => accept(e.target.files)}
        />
        <Upload className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">Przeciągnij plik xlsx tutaj albo wybierz go z dysku</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Limit {megabytes(IMPORT_LIMITS.maxBytes)} MB, do {IMPORT_LIMITS.maxRows} wierszy na arkusz
        </p>
        <Button
          className="mt-4"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Wczytuję' : 'Wybierz plik'}
        </Button>
      </div>

      {message ? (
        <p data-testid="import-file-error" role="alert" className="inline-flex items-center gap-1.5 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {message}
        </p>
      ) : null}
    </div>
  );
}
