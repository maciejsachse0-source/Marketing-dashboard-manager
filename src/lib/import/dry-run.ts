/**
 * Suchy przebieg importu (plan/04 sekcja 2, krok 4). Funkcja czysta: dostaje
 * wiersze arkusza, mapowanie i stan bazy, oddaje plan bez jednego zapisu.
 * Ten sam kod liczy podgląd w przeglądarce i plan zapisu na serwerze, więc
 * podsumowanie nie może rozjechać się z tym, co faktycznie wejdzie do bazy.
 */
import { findDuplicate, planRow, type DuplicatePolicy, type ExistingPerson, type RowPlan } from './dedup';
import type { PersonField } from './mapping';
import { toRawRow } from './mapping';
import { normalizeRow, type NormalizedPerson, type PersonRole } from './normalize';

export type PlannedRow = {
  /** Numer wiersza w arkuszu, z nagłówkiem, czyli pierwszy wiersz danych to 2. */
  line: number;
  person: NormalizedPerson;
  plan: RowPlan;
};

export type PreviewRow = {
  line: number;
  name: string;
  action: 'insert' | 'update' | 'skip' | 'error';
  detail: string;
};

export type DryRunResult = {
  inserts: number;
  updates: number;
  skips: number;
  errors: number;
  empty: number;
  preview: PreviewRow[];
  errorRows: { line: number; errors: string[] }[];
  plans: PlannedRow[];
};

const REASON_TEXT: Record<string, string> = {
  handle: 'ten sam handle',
  email: 'ten sam email',
  'name-location': 'ta sama nazwa i lokalizacja',
};

function planDetail(plan: RowPlan): string {
  if (plan.action === 'insert') return 'nowa osoba';
  if (plan.reason === 'file') return `duplikat w pliku, ten sam co wiersz ${plan.id}`;
  const powod = REASON_TEXT[plan.reason] ?? plan.reason;
  if (plan.action === 'update') return `aktualizacja #${plan.id}, ${powod}`;
  const pewnosc = plan.level === 'certain' ? 'duplikat pewny' : 'duplikat prawdopodobny';
  return `${pewnosc} #${plan.id}, ${powod}`;
}

export function dryRun(
  rows: readonly (readonly unknown[])[],
  mapping: readonly (PersonField | null)[],
  role: PersonRole,
  existing: readonly ExistingPerson[],
  policy: DuplicatePolicy,
  previewLimit = 20,
): DryRunResult {
  const out: DryRunResult = {
    inserts: 0,
    updates: 0,
    skips: 0,
    errors: 0,
    empty: 0,
    preview: [],
    errorRows: [],
    plans: [],
  };

  // Osoby zaplanowane do wstawienia w tym samym przebiegu, z `id` równym
  // numerowi wiersza arkusza — służą wyłącznie do wykrycia duplikatu w pliku.
  const planned: ExistingPerson[] = [];

  rows.forEach((cells, index) => {
    const line = index + 2;
    const result = normalizeRow(toRawRow(cells, mapping), role);

    if (result.kind === 'empty') {
      out.empty += 1;
      return;
    }

    if (result.kind === 'error') {
      out.errors += 1;
      out.errorRows.push({ line, errors: result.errors });
      addPreview(out, previewLimit, { line, name: '', action: 'error', detail: result.errors.join('; ') });
      return;
    }

    // Duplikat wewnątrz samego pliku: dwa wiersze arkusza o tym samym handle
    // albo emailu. Bez tego oba trafiały do bazy jako nowe osoby, bo `existing`
    // zna wyłącznie stan bazy sprzed importu (F4-06, prawdziwy arkusz ma taką parę).
    const wPliku = findDuplicate(result.person, role, planned);
    const plan: RowPlan =
      wPliku.level === 'none'
        ? planRow(result.person, role, existing, policy)
        : { action: 'skip', id: wPliku.existing.id, level: 'certain', reason: 'file' };
    if (plan.action === 'insert') planned.push({ ...result.person, id: line, role });
    out.plans.push({ line, person: result.person, plan });
    if (plan.action === 'insert') out.inserts += 1;
    else if (plan.action === 'update') out.updates += 1;
    else out.skips += 1;
    addPreview(out, previewLimit, {
      line,
      name: result.person.name,
      action: plan.action,
      detail: planDetail(plan),
    });
  });

  return out;
}

function addPreview(out: DryRunResult, limit: number, row: PreviewRow): void {
  if (out.preview.length < limit) out.preview.push(row);
}

/** Lista błędów w formacie CSV do pobrania (plan/04 sekcja 2, krok 7). */
export function errorsToCsv(errorRows: readonly { line: number; errors: string[] }[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = ['wiersz,blad'];
  for (const row of errorRows) {
    for (const error of row.errors) lines.push(`${row.line},${escape(error)}`);
  }
  return lines.join('\n');
}
