'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImportDropzone } from './import-dropzone';
import { ImportMapping } from './import-mapping';
import { ImportPreview } from './import-preview';
import { ImportSource } from './import-source';
import { ImportSteps } from './import-steps';
import type { ExistingPerson } from '@/lib/import/dedup';
import { dryRun } from '@/lib/import/dry-run';
import { autoMap, mappingConflicts, type PersonField } from '@/lib/import/mapping';
import type { PersonRole } from '@/lib/import/normalize';

type Cell = string | number | boolean | null;
export type SheetData = { name: string; headers: string[]; rows: Cell[][] };

/**
 * Kroki 1 do 4 importu osób (plan/04 sekcja 2). Suchy przebieg liczy się w
 * przeglądarce z tych samych funkcji, których na serwerze użyje zapis, więc
 * zmiana mapowania przelicza podgląd bez ponownego wysyłania pliku.
 */
export function ImportShell({ existing }: { existing: ExistingPerson[] }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [role, setRole] = useState<PersonRole>('artist');
  const [mapping, setMapping] = useState<(PersonField | null)[]>([]);

  const sheet = sheets[sheetIndex];
  const conflicts = useMemo(() => mappingConflicts(mapping), [mapping]);
  const result = useMemo(
    () => dryRun(sheet?.rows ?? [], mapping, role, existing, 'skip'),
    [sheet, mapping, role, existing],
  );

  const upload = async (file: File) => {
    setBusy(true);
    setServerError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/import/people', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) {
        setServerError(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`);
        return;
      }
      setSheets(json.sheets as SheetData[]);
      setSheetIndex(0);
      setStep(2);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const openMapping = () => {
    setMapping(autoMap(sheets[sheetIndex].headers, role));
    setStep(3);
  };

  const setColumn = (index: number, field: PersonField | null) => {
    setMapping((prev) => prev.map((value, i) => (i === index ? field : value)));
  };

  const restart = () => {
    setSheets([]);
    setMapping([]);
    setServerError(null);
    setStep(1);
  };

  if (step === 1 || sheet === undefined) {
    return (
      <Ramka step={1}>
        <ImportDropzone busy={busy} serverError={serverError} onFile={upload} />
      </Ramka>
    );
  }

  if (step === 2) {
    return (
      <Ramka step={2}>
        <ImportSource
          sheets={sheets}
          sheetIndex={sheetIndex}
          role={role}
          onSheet={setSheetIndex}
          onRole={setRole}
          onBack={restart}
          onNext={openMapping}
        />
      </Ramka>
    );
  }

  if (step === 3) {
    return (
      <Ramka step={3}>
        <ImportMapping
          headers={sheet.headers}
          mapping={mapping}
          role={role}
          conflicts={conflicts}
          sample={sheet.rows[0] ?? []}
          onChange={setColumn}
        />
        <p data-testid="import-podsumowanie-na-zywo" className="text-sm text-muted-foreground">
          Suchy przebieg: {result.inserts} nowych, {result.skips} duplikatów, {result.errors} z
          błędem
        </p>
        <NazwaBrakuje mapping={mapping} />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setStep(2)}>
            Wróć
          </Button>
          <Button
            data-testid="import-do-podgladu"
            onClick={() => setStep(4)}
            disabled={conflicts.length > 0 || !mapping.includes('name')}
          >
            Pokaż suchy przebieg
          </Button>
        </div>
      </Ramka>
    );
  }

  return (
    <Ramka step={4}>
      <ImportPreview result={result} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setStep(3)}>
          Wróć do mapowania
        </Button>
      </div>
    </Ramka>
  );
}

function Ramka({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="grid gap-6">
      <ImportSteps current={step} />
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

function NazwaBrakuje({ mapping }: { mapping: readonly (PersonField | null)[] }) {
  if (mapping.includes('name')) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      Żadna kolumna nie jest zmapowana na pole Nazwa
    </p>
  );
}
