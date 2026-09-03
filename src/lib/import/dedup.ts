/**
 * Wykrywanie duplikatów osoby i decyzja o wierszu (plan/04 sekcja 5).
 * Porównanie zawsze w obrębie jednej roli, czyli jednej tabeli.
 */
import type { NormalizedPerson, PersonRole } from './normalize';

export type ExistingPerson = NormalizedPerson & { id: number; role: PersonRole };

export type DuplicateMatch =
  | { level: 'none' }
  | { level: 'certain'; reason: 'handle' | 'email'; existing: ExistingPerson }
  | { level: 'probable'; reason: 'name-location'; existing: ExistingPerson };

/** Pola, które import wypełnia — od F7-45 identyczne dla obu ról. */
const UPDATABLE = ['handle', 'email', 'phone', 'location', 'status', 'notes'] as const;

/** Wybór usera z kroku 5: co zrobić z duplikatem pewnym. */
export type DuplicatePolicy = 'skip' | 'update';

export type RowPlan =
  | { action: 'insert' }
  | { action: 'skip'; id: number; level: 'certain' | 'probable'; reason: string }
  | {
      action: 'update';
      id: number;
      level: 'certain';
      reason: string;
      changes: Partial<Record<(typeof UPDATABLE)[number], string>>;
    };

function sameText(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ponytail: skan liniowy po liście istniejących osób. Przy 1000 wierszy arkusza
// i 200 osobach w bazie suchy przebieg trwa 66 ms, więc indeksowanie po handle
// i emailu ma sens dopiero, gdy baza urośnie o rząd wielkości.
export function findDuplicate(
  person: NormalizedPerson,
  role: PersonRole,
  existing: readonly ExistingPerson[],
): DuplicateMatch {
  const sameTable = existing.filter((row) => row.role === role);

  const byHandle = sameTable.find((row) => sameText(person.handle, row.handle));
  if (byHandle) return { level: 'certain', reason: 'handle', existing: byHandle };

  const byEmail = sameTable.find((row) => sameText(person.email, row.email));
  if (byEmail) return { level: 'certain', reason: 'email', existing: byEmail };

  const byName = sameTable.find(
    (row) => sameText(person.name, row.name) && sameText(person.location, row.location),
  );
  if (byName) return { level: 'probable', reason: 'name-location', existing: byName };

  return { level: 'none' };
}

/** Zmiany dla duplikatu: tylko pola niepuste w arkuszu i różne od tego, co w bazie. */
function buildChanges(person: NormalizedPerson, existing: ExistingPerson) {
  const changes: Partial<Record<(typeof UPDATABLE)[number], string>> = {};
  for (const field of UPDATABLE) {
    const value = person[field];
    if (value !== null && value !== existing[field]) changes[field] = value;
  }
  return changes;
}

export function planRow(
  person: NormalizedPerson,
  role: PersonRole,
  existing: readonly ExistingPerson[],
  policy: DuplicatePolicy,
): RowPlan {
  const match = findDuplicate(person, role, existing);
  if (match.level === 'none') return { action: 'insert' };

  // Duplikat prawdopodobny nigdy nie jest aktualizowany automatycznie.
  if (match.level === 'probable' || policy === 'skip') {
    return { action: 'skip', id: match.existing.id, level: match.level, reason: match.reason };
  }

  return {
    action: 'update',
    id: match.existing.id,
    level: 'certain',
    reason: match.reason,
    changes: buildChanges(person, match.existing),
  };
}
