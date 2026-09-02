'use client';

import { Button } from '@/components/ui/button';
import { ImportMapping } from './import-mapping';
import type { DryRunResult } from '@/lib/import/dry-run';
import type { PersonField } from '@/lib/import/mapping';
import type { PersonRole } from '@/lib/import/normalize';
import type { SheetData } from './import-shell';

/** Krok 3: mapowanie z podglądem liczb przeliczanym przy każdej zmianie. */
export function ImportMappingStep({
  sheet,
  mapping,
  role,
  conflicts,
  result,
  onChange,
  onBack,
  onNext,
}: {
  sheet: SheetData;
  mapping: readonly (PersonField | null)[];
  role: PersonRole;
  conflicts: readonly PersonField[];
  result: DryRunResult;
  onChange: (index: number, field: PersonField | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const brakNazwy = !mapping.includes('name');

  return (
    <>
      <ImportMapping
        headers={sheet.headers}
        mapping={mapping}
        role={role}
        conflicts={conflicts}
        sample={sheet.rows[0] ?? []}
        onChange={onChange}
      />
      <p data-testid="import-podsumowanie-na-zywo" className="text-sm text-muted-foreground">
        Suchy przebieg: {result.inserts} nowych, {result.skips} duplikatów, {result.errors} z błędem
      </p>
      {brakNazwy ? (
        <p role="alert" className="text-sm text-destructive">
          Żadna kolumna nie jest zmapowana na pole Nazwa
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          Wróć
        </Button>
        <Button
          data-testid="import-do-podgladu"
          onClick={onNext}
          disabled={conflicts.length > 0 || brakNazwy}
        >
          Pokaż suchy przebieg
        </Button>
      </div>
    </>
  );
}
