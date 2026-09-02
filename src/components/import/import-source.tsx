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
import type { PersonRole } from '@/lib/import/normalize';
import type { SheetData } from './import-shell';

const ROLE_LABELS: Record<PersonRole, string> = {
  artist: 'Twórcy',
  videographer: 'Kamerzyści',
};

/**
 * Krok 2: który arkusz i jaka rola (plan/04 sekcja 2). Rola nigdy nie jest
 * zgadywana z zawartości, wybiera ją user (plan/04 sekcja 7).
 */
export function ImportSource({
  sheets,
  sheetIndex,
  role,
  onSheet,
  onRole,
  onBack,
  onNext,
}: {
  sheets: readonly SheetData[];
  sheetIndex: number;
  role: PersonRole;
  onSheet: (index: number) => void;
  onRole: (role: PersonRole) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const sheet = sheets[sheetIndex];
  const pusty = sheet.rows.length === 0;

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-1.5">
        <Label htmlFor="arkusz">Arkusz</Label>
        <Select value={String(sheetIndex)} onValueChange={(value) => onSheet(Number(value))}>
          <SelectTrigger id="arkusz" className="w-full sm:w-80">
            <SelectValue>{(value: string) => sheets[Number(value)]?.name ?? ''}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sheets.map((item, index) => (
              <SelectItem key={item.name} value={String(index)}>
                {item.name} ({item.rows.length} wierszy)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="rola">Rola osób z tego arkusza</Label>
        <Select value={role} onValueChange={(value) => onRole(value as PersonRole)}>
          <SelectTrigger id="rola" className="w-full sm:w-80">
            <SelectValue>{(value: PersonRole) => ROLE_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="artist">{ROLE_LABELS.artist}</SelectItem>
            <SelectItem value="videographer">{ROLE_LABELS.videographer}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {pusty ? (
        <p data-testid="import-pusty-arkusz" role="alert" className="text-sm text-muted-foreground">
          Arkusz nie zawiera wierszy z danymi
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          Wróć
        </Button>
        <Button data-testid="import-do-mapowania" onClick={onNext} disabled={pusty}>
          Dalej
        </Button>
      </div>
    </div>
  );
}
