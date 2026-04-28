import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  CalendarType,
  Platform,
  ProductionStage,
  ProductionType,
} from '../../drizzle/schema';

export type ProductionTemplateStep = {
  tDays: number;
  hourStart: number;
  durationMinutes: number;
  calendarType: CalendarType;
  /** Pipeline category this step belongs to — drives placement on the production detail page. */
  stage: ProductionStage;
  title: string;
  description?: string;
  agent?: string;
  platforms?: Platform[];
};

export type ProductionTemplate = {
  slug: string;
  name: string;
  description: string;
  type: ProductionType;
  durationDays: number;
  steps: ProductionTemplateStep[];
};

const TEMPLATES_DIR = () => join(process.cwd(), 'data', 'templates', 'production');

export function listProductionTemplates(): ProductionTemplate[] {
  const dir = TEMPLATES_DIR();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files
    .map((file) => {
      const raw = readFileSync(join(dir, file), 'utf8');
      return JSON.parse(raw) as ProductionTemplate;
    })
    .sort((a, b) => a.durationDays - b.durationDays);
}

export function getProductionTemplate(slug: string): ProductionTemplate | null {
  if (slug === 'manual') return null;
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) return null;
  const path = join(TEMPLATES_DIR(), `${slug}.json`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as ProductionTemplate;
}

/** Compute absolute date for a step given T-0 reference. */
export function stepStartsAt(t0: Date, step: ProductionTemplateStep): Date {
  const date = new Date(t0);
  date.setDate(date.getDate() + step.tDays);
  date.setHours(step.hourStart, 0, 0, 0);
  return date;
}

export function stepEndsAt(t0: Date, step: ProductionTemplateStep): Date {
  const start = stepStartsAt(t0, step);
  return new Date(start.getTime() + step.durationMinutes * 60_000);
}
