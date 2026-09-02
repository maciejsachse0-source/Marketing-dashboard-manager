'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DuplicatePolicy } from '@/lib/import/dedup';
import type { DryRunResult } from '@/lib/import/dry-run';

const POLICY_LABELS: Record<DuplicatePolicy, string> = {
  skip: 'Pomiń, nie ruszaj tego, co w bazie',
  update: 'Zaktualizuj puste i różniące się pola',
};

/** Krok 5: co zrobić z duplikatami i zatwierdzenie zapisu (plan/04 sekcja 2). */
export function ImportConfirm({
  result,
  policy,
  saving,
  error,
  onPolicy,
  onBack,
  onSave,
}: {
  result: DryRunResult;
  policy: DuplicatePolicy;
  saving: boolean;
  error: string | null;
  onPolicy: (policy: DuplicatePolicy) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const doZapisu = result.inserts + result.updates;

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-1.5">
        <Label htmlFor="polityka">Duplikaty pewne, czyli ten sam handle albo email</Label>
        <Select value={policy} onValueChange={(value) => onPolicy(value as DuplicatePolicy)}>
          <SelectTrigger id="polityka" className="w-full sm:w-80" disabled={saving}>
            <SelectValue>{(value: DuplicatePolicy) => POLICY_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skip">{POLICY_LABELS.skip}</SelectItem>
            <SelectItem value="update">{POLICY_LABELS.update}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Duplikat prawdopodobny, czyli ta sama nazwa i lokalizacja, jest zawsze pomijany.
        </p>
      </div>

      <p data-testid="import-do-zapisu" className="text-sm">
        Do zapisu: {result.inserts} nowych, {result.updates} do aktualizacji,{' '}
        {result.skips} pominiętych, {result.errors} wierszy z błędem zostanie odrzuconych.
      </p>

      {error ? (
        <p data-testid="import-blad-zapisu" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack} disabled={saving}>
          Wróć do podglądu
        </Button>
        <Button data-testid="import-zapisz" onClick={onSave} disabled={saving || doZapisu === 0} loading={saving}>
          {saving ? 'Zapisuję' : 'Importuj'}
        </Button>
      </div>
    </div>
  );
}
