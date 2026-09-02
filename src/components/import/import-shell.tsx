'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImportConfirm } from './import-confirm';
import { ImportDropzone } from './import-dropzone';
import { ImportMappingStep } from './import-mapping-step';
import { ImportPreview } from './import-preview';
import { ImportProgress } from './import-progress';
import { ImportSource } from './import-source';
import { ImportSteps } from './import-steps';
import { ImportSummary } from './import-summary';
import { useImportSave } from './use-import-save';
import type { DuplicatePolicy, ExistingPerson } from '@/lib/import/dedup';
import { dryRun } from '@/lib/import/dry-run';
import { autoMap, mappingConflicts, type PersonField } from '@/lib/import/mapping';
import type { PersonRole } from '@/lib/import/normalize';
import type { SaveCounts } from '@/lib/import/save';

type Cell = string | number | boolean | null;
export type SheetData = { name: string; headers: string[]; rows: Cell[][] };

/**
 * Kroki 1 do 7 importu osób (plan/04 sekcja 2). Suchy przebieg liczy się w
 * przeglądarce z tych samych funkcji, których na serwerze używa zapis, więc
 * zmiana mapowania przelicza podgląd bez ponownego wysyłania pliku, a serwer
 * i tak liczy plan od zera, zanim cokolwiek zapisze.
 */
export function ImportShell({ existing }: { existing: ExistingPerson[] }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [role, setRole] = useState<PersonRole>('artist');
  const [mapping, setMapping] = useState<(PersonField | null)[]>([]);
  const [policy, setPolicy] = useState<DuplicatePolicy>('skip');
  const [counts, setCounts] = useState<SaveCounts | null>(null);
  const { saving, progress, error: saveError, save } = useImportSave();

  const sheet = sheets[sheetIndex];
  const conflicts = useMemo(() => mappingConflicts(mapping), [mapping]);
  const result = useMemo(
    () => dryRun(sheet?.rows ?? [], mapping, role, existing, policy),
    [sheet, mapping, role, existing, policy],
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

  const zapisz = async () => {
    const wynik = await save({ role, policy, mapping, rows: sheet.rows });
    setCounts(wynik);
  };

  const restart = () => {
    setSheets([]);
    setMapping([]);
    setServerError(null);
    setCounts(null);
    setPolicy('skip');
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
          onNext={() => {
            setMapping(autoMap(sheets[sheetIndex].headers, role));
            setStep(3);
          }}
        />
      </Ramka>
    );
  }

  if (step === 3) {
    return (
      <Ramka step={3}>
        <ImportMappingStep
          sheet={sheet}
          mapping={mapping}
          role={role}
          conflicts={conflicts}
          result={result}
          onChange={(index, field) =>
            setMapping((prev) => prev.map((value, i) => (i === index ? field : value)))
          }
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      </Ramka>
    );
  }

  if (step === 4) {
    return (
      <Ramka step={4}>
        <ImportPreview result={result} />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setStep(3)}>
            Wróć do mapowania
          </Button>
          <Button data-testid="import-do-zatwierdzenia" onClick={() => setStep(5)}>
            Dalej
          </Button>
        </div>
      </Ramka>
    );
  }

  if (counts) {
    return (
      <Ramka step={7}>
        <ImportSummary
          counts={counts}
          errorRows={result.errorRows}
          role={role}
          onRestart={restart}
        />
      </Ramka>
    );
  }

  return (
    <Ramka step={saving ? 6 : 5}>
      <ImportConfirm
        result={result}
        policy={policy}
        saving={saving}
        error={saveError}
        onPolicy={setPolicy}
        onBack={() => setStep(4)}
        onSave={zapisz}
      />
      {saving && progress ? <ImportProgress done={progress.done} total={progress.total} /> : null}
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
