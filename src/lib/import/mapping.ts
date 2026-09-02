/**
 * Propozycja mapowania nagłówek arkusza na pole osoby (plan/04 sekcja 4).
 */
import type { PersonRole } from './normalize';

export const PERSON_FIELDS = ['name', 'handle', 'email', 'phone', 'location', 'status', 'notes'] as const;
export type PersonField = (typeof PERSON_FIELDS)[number];

export const FIELD_ALIASES: Record<PersonField, readonly string[]> = {
  name: ['imie', 'imię', 'nazwa', 'osoba', 'name', 'artysta', 'kamerzysta', 'twórca'],
  handle: ['insta', 'instagram', 'ig', 'handle', 'profil', 'nick'],
  email: ['email', 'mail', 'e-mail', 'kontakt'],
  phone: ['telefon', 'tel', 'phone', 'numer', 'komorka'],
  location: ['lokalizacja', 'miasto', 'location', 'city', 'region'],
  status: ['status', 'dostepnosc', 'uwagi o statusie'],
  notes: ['notatki', 'uwagi', 'komentarz', 'notes'],
};

/** Małe litery, bez znaków diakrytycznych, bez wszystkiego poza literami i cyframi. */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const ALIAS_TO_FIELD = new Map<string, PersonField>();
for (const field of PERSON_FIELDS) {
  for (const alias of FIELD_ALIASES[field]) {
    const key = normalizeHeader(alias);
    if (!ALIAS_TO_FIELD.has(key)) ALIAS_TO_FIELD.set(key, field);
  }
}

/**
 * Propozycja dla każdej kolumny. `null` znaczy „pomijana" i wymaga świadomego
 * wyboru usera. Pole `status` nie jest proponowane dla roli twórcy, bo tabela
 * `artists` go nie ma.
 */
export function autoMap(headers: readonly string[], role: PersonRole): (PersonField | null)[] {
  const used = new Set<PersonField>();
  return headers.map((header) => {
    const field = ALIAS_TO_FIELD.get(normalizeHeader(header)) ?? null;
    if (field === null) return null;
    if (field === 'status' && role === 'artist') return null;
    if (used.has(field)) return null;
    used.add(field);
    return field;
  });
}

/** Pola zmapowane więcej niż raz — blokują przejście dalej (plan/04 sekcja 4). */
export function mappingConflicts(mapping: readonly (PersonField | null)[]): PersonField[] {
  const counts = new Map<PersonField, number>();
  for (const field of mapping) {
    if (field) counts.set(field, (counts.get(field) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([field]) => field);
}

/** Wiersz arkusza w kształcie, który przyjmuje `normalizeRow`. */
export function toRawRow(
  cells: readonly unknown[],
  mapping: readonly (PersonField | null)[],
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  mapping.forEach((field, index) => {
    if (field) raw[field] = cells[index] ?? null;
  });
  return raw;
}
