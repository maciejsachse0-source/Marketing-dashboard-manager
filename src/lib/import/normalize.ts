/**
 * Normalizacja jednego wiersza arkusza do kształtu osoby (plan/04 sekcja 5).
 * Granica zaufania: komórka arkusza może być czymkolwiek, dlatego wiersz
 * przechodzi najpierw przez Zod, a dopiero potem przez reguły domenowe (Z14).
 */
import { z } from 'zod';

export type PersonRole = 'artist' | 'videographer';

export type NormalizedPerson = {
  name: string;
  handle: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  /** Opisowy status z arkusza — od F7-45 wypełniany dla obu ról, bo `artists`
   *  ma kolumnę `status` od migracji `0004`. */
  status: string | null;
  notes: string | null;
};

export type RowResult =
  | { kind: 'empty' }
  | { kind: 'ok'; person: NormalizedPerson }
  | { kind: 'error'; errors: string[] };

/** Komórka arkusza sprowadzona do tekstu albo null. Pusta nigdy nie daje "". */
const cellSchema = z
  .union([z.string(), z.number(), z.boolean(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const text = value instanceof Date ? value.toISOString() : String(value);
    const trimmed = text.trim();
    return trimmed === '' ? null : trimmed;
  });

const rowSchema = z.object({
  name: cellSchema.optional(),
  handle: cellSchema.optional(),
  email: cellSchema.optional(),
  phone: cellSchema.optional(),
  location: cellSchema.optional(),
  status: cellSchema.optional(),
  notes: cellSchema.optional(),
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_PATTERN = /^\+?[0-9]{9,15}$/;

const LOCATION_SYNONYMS = new Map([
  ['tricity', 'Trójmiasto'],
  ['trojmiasto', 'Trójmiasto'],
  ['trójmiasto', 'Trójmiasto'],
]);

function normalizeHandle(raw: string): string | null {
  const stripped = raw
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/^instagram\.com\//, '')
    .replace(/\/+$/, '')
    .replace(/^@+/, '');
  return stripped === '' ? null : `@${stripped}`;
}

function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s\-()./]/g, '');
  const withPrefix = compact.startsWith('0048')
    ? `+48${compact.slice(4)}`
    : /^[0-9]{9}$/.test(compact)
      ? `+48${compact}`
      : compact;
  return PHONE_PATTERN.test(withPrefix) ? withPrefix : null;
}

function normalizeLocation(raw: string): string {
  const synonym = LOCATION_SYNONYMS.get(raw.toLowerCase());
  if (synonym) return synonym;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

type Cells = z.infer<typeof rowSchema>;

/** Pola z własnym wzorcem: zwraca wartość albo dopisuje błąd. */
function normalizeChecked(cells: Cells, errors: string[]): { email: string | null; phone: string | null } {
  let email: string | null = null;
  if (cells.email) {
    const lowered = cells.email.toLowerCase();
    if (EMAIL_PATTERN.test(lowered)) email = lowered;
    else errors.push('zły email');
  }

  let phone: string | null = null;
  if (cells.phone) {
    phone = normalizePhone(cells.phone);
    if (phone === null) errors.push('zły telefon');
  }

  return { email, phone };
}

function toPerson(cells: Cells, email: string | null, phone: string | null): NormalizedPerson {
  return {
    name: cells.name ?? '',
    handle: cells.handle ? normalizeHandle(cells.handle) : null,
    email,
    phone,
    location: cells.location ? normalizeLocation(cells.location) : null,
    status: cells.status ?? null,
    notes: cells.notes ?? null,
  };
}

/**
 * Do którego pola należy jednolinijkowy kontakt (F7-19, `videographers.contact`).
 * Kolejność ma znaczenie: email i telefon mają niżej własne wzorce, więc mogą się
 * jeszcze same odrzucić. `handle` wzorca nie ma i przyjąłby wszystko, dlatego
 * wymaga jawnego znaku: małpy na początku albo adresu Instagrama. Cokolwiek innego
 * to `null`, czyli „nie zgaduję" — wiersz zostaje do ręcznego przejrzenia.
 */
export function contactField(raw: string): 'email' | 'phone' | 'handle' | null {
  const t = raw.trim();
  if (t.includes('@') && !t.startsWith('@')) return 'email';
  if (t.startsWith('@') || /(^|\/\/|\.)instagram\.com\//i.test(t)) return 'handle';
  if (/^[+0-9][0-9\s\-()./]{7,}$/.test(t)) return 'phone';
  return null;
}

export function normalizeRow(raw: Record<string, unknown>): RowResult {
  const parsed = rowSchema.safeParse(raw);
  if (!parsed.success) return { kind: 'error', errors: ['nieobsługiwana zawartość komórki'] };

  const cells = parsed.data;
  const hasValue = Object.values(cells).some((value) => value !== null && value !== undefined);
  if (!hasValue) return { kind: 'empty' };

  const errors: string[] = [];
  if (!cells.name) errors.push('brak nazwy');
  const { email, phone } = normalizeChecked(cells, errors);
  if (errors.length > 0) return { kind: 'error', errors };

  return { kind: 'ok', person: toPerson(cells, email, phone) };
}
