'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DryRunResult, PreviewRow } from '@/lib/import/dry-run';

const ACTION_LABELS: Record<PreviewRow['action'], string> = {
  insert: 'nowa',
  update: 'aktualizacja',
  skip: 'duplikat',
  error: 'błąd',
};

function Licznik({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div data-testid={testId} className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

/** Krok 4: suchy przebieg (plan/04 sekcja 2). Zero zapisów, same liczby i podgląd. */
export function ImportPreview({ result }: { result: DryRunResult }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Licznik label="Nowe" value={result.inserts} testId="licznik-nowe" />
        <Licznik label="Aktualizacje" value={result.updates} testId="licznik-aktualizacje" />
        <Licznik label="Duplikaty" value={result.skips} testId="licznik-duplikaty" />
        <Licznik label="Wiersze z błędem" value={result.errors} testId="licznik-bledy" />
      </div>

      <p className="text-xs text-muted-foreground">
        Wierszy pustych, pominiętych bez błędu: {result.empty}. Poniżej pierwsze{' '}
        {result.preview.length} wierszy z zaznaczonymi problemami. Nic nie zostało zapisane.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Wiersz</TableHead>
              <TableHead className="w-28">Co się stanie</TableHead>
              <TableHead>Nazwa</TableHead>
              <TableHead>Szczegóły</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.preview.map((row) => (
              <TableRow key={row.line} data-testid="podglad-wiersz">
                <TableCell className="tabular-nums text-muted-foreground">{row.line}</TableCell>
                <TableCell>
                  <Badge variant={row.action === 'error' ? 'destructive' : 'secondary'}>
                    {ACTION_LABELS[row.action]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{row.name || '(brak)'}</TableCell>
                <TableCell className="text-muted-foreground">{row.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
