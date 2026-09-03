'use client';

import { TriangleAlert } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERSON_FIELDS, type PersonField } from '@/lib/import/mapping';

export const FIELD_LABELS: Record<PersonField, string> = {
  name: 'Nazwa',
  handle: 'Handle',
  email: 'Email',
  phone: 'Telefon',
  location: 'Lokalizacja',
  status: 'Status',
  notes: 'Notatki',
};

const SKIP = '__pomijana__';

/** Krok 3: kolumna arkusza na pole osoby (plan/04 sekcja 2 i 4). */
export function ImportMapping({
  headers,
  mapping,
  conflicts,
  sample,
  onChange,
}: {
  headers: readonly string[];
  mapping: readonly (PersonField | null)[];
  conflicts: readonly PersonField[];
  sample: readonly (string | number | boolean | null)[];
  onChange: (index: number, field: PersonField | null) => void;
}) {
  // Od F7-45 obie role mają ten sam zestaw pól — `artists` dostała `status`
  // migracją `0004`.
  const fields = PERSON_FIELDS;

  return (
    <div className="grid gap-3">
      {/* Poniżej 768 px tabela mapowania przechodzi w listę kart, jedna kolumna
          arkusza na kartę (plan/04 sekcja 6). Ten sam DOM, inne wyświetlanie —
          bez dublowania pól, żeby etykiety `aria-label` zostały unikalne. */}
      <div
        data-testid="import-mapping-karty"
        className="overflow-x-auto rounded-lg border border-border bg-card max-md:border-0 max-md:bg-transparent max-md:[&_table]:block max-md:[&_tbody]:block max-md:[&_td]:block max-md:[&_td]:w-full max-md:[&_td]:border-0 max-md:[&_td]:px-0 max-md:[&_td]:py-1 max-md:[&_thead]:hidden max-md:[&_tr]:mb-2 max-md:[&_tr]:block max-md:[&_tr]:rounded-lg max-md:[&_tr]:border max-md:[&_tr]:border-border max-md:[&_tr]:bg-card max-md:[&_tr]:p-3"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Kolumna arkusza</TableHead>
              <TableHead className="w-1/3">Przykładowa wartość</TableHead>
              <TableHead className="w-1/3">Pole osoby</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header, index) => {
              const value = mapping[index];
              const kolizja = value !== null && value !== undefined && conflicts.includes(value);
              return (
                <TableRow key={`${header}-${index}`}>
                  <TableCell className="font-medium">{header || `(kolumna ${index + 1})`}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {sample[index] === null || sample[index] === undefined || sample[index] === ''
                      ? '(pusto)'
                      : String(sample[index])}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={value ?? SKIP}
                      onValueChange={(next) =>
                        onChange(index, next === SKIP ? null : (next as PersonField))
                      }
                    >
                      <SelectTrigger
                        aria-label={`Pole dla kolumny ${header || index + 1}`}
                        aria-invalid={kolizja || undefined}
                        className="w-full"
                      >
                        <SelectValue>
                          {(chosen: string) =>
                            chosen === SKIP ? 'kolumna pomijana' : FIELD_LABELS[chosen as PersonField]
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>kolumna pomijana</SelectItem>
                        {fields.map((field) => (
                          <SelectItem key={field} value={field}>
                            {FIELD_LABELS[field]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {conflicts.length > 0 ? (
        <p data-testid="import-mapping-conflict" role="alert" className="inline-flex items-start gap-1.5 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {conflicts
              .map((field) => {
                const kolumny = headers.filter((_, i) => mapping[i] === field);
                return `${FIELD_LABELS[field]}: ${kolumny.join(', ')}`;
              })
              .join('. ')}
            . Jedno pole może pochodzić tylko z jednej kolumny.
          </span>
        </p>
      ) : null}
    </div>
  );
}
