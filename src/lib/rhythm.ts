import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Platform } from '../../drizzle/schema';

export type RhythmSlot = {
  /** ISO day of week: 1=pn, 2=wt, ..., 7=niedz */
  dayOfWeek: number;
  hour: number;
  minute: number;
  label: string;
  platforms: Platform[];
  postType: string;
};

export type Rhythm = {
  name: string;
  description: string;
  slots: RhythmSlot[];
};

const RHYTHM_PATH = () => join(process.cwd(), 'data', 'templates', 'rhythm.json');

export function loadRhythm(): Rhythm {
  const path = RHYTHM_PATH();
  if (!existsSync(path)) {
    return { name: 'Rytm tygodniowy', description: 'Brak konfiguracji.', slots: [] };
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveRhythm(rhythm: Rhythm) {
  writeFileSync(RHYTHM_PATH(), JSON.stringify(rhythm, null, 2), 'utf8');
}

const DAY_PL = ['niedz', 'pn', 'wt', 'śr', 'cz', 'pt', 'sob']; // index = JS getDay() value
const DAY_PL_ISO = ['', 'pn', 'wt', 'śr', 'cz', 'pt', 'sob', 'niedz']; // index = ISO 1-7
export const DAYS_OF_WEEK = [
  { iso: 1, label: 'pn' },
  { iso: 2, label: 'wt' },
  { iso: 3, label: 'śr' },
  { iso: 4, label: 'cz' },
  { iso: 5, label: 'pt' },
  { iso: 6, label: 'sob' },
  { iso: 7, label: 'niedz' },
];

export function isoDayLabel(iso: number): string {
  return DAY_PL_ISO[iso] ?? '?';
}

export function jsDayLabel(js: number): string {
  return DAY_PL[js] ?? '?';
}
