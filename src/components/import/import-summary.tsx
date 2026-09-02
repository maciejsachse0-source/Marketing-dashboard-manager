'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { errorsToCsv, type DryRunResult } from '@/lib/import/dry-run';
import type { SaveCounts } from '@/lib/import/save';
import type { PersonRole } from '@/lib/import/normalize';

const ROLE_HREF: Record<PersonRole, { href: string; label: string }> = {
  artist: { href: '/artists', label: 'Przejdź do artystów' },
  videographer: { href: '/videographers', label: 'Przejdź do kamerzystów' },
};

function pobierzCsv(errorRows: DryRunResult['errorRows']) {
  const blob = new Blob([errorsToCsv(errorRows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'import-bledy.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Krok 7: podsumowanie zapisu (plan/04 sekcja 2). */
export function ImportSummary({
  counts,
  errorRows,
  role,
  onRestart,
}: {
  counts: SaveCounts;
  errorRows: DryRunResult['errorRows'];
  role: PersonRole;
  onRestart: () => void;
}) {
  const cel = ROLE_HREF[role];

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <p data-testid="import-podsumowanie" className="text-sm">
        Dodano {counts.inserted}, zaktualizowano {counts.updated}, pominięto {counts.skipped}.
        Wierszy z błędem, nieprzepisanych do bazy: {errorRows.length}.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button nativeButton={false} render={<Link href={cel.href} data-testid="import-link-lista" />}>
          {cel.label}
        </Button>
        <Button variant="secondary" onClick={onRestart}>
          Importuj kolejny plik
        </Button>
        {errorRows.length > 0 ? (
          <Button
            variant="outline"
            data-testid="import-pobierz-bledy"
            onClick={() => pobierzCsv(errorRows)}
          >
            Pobierz błędy jako CSV
          </Button>
        ) : null}
      </div>
    </div>
  );
}
