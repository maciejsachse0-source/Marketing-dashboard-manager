import { z } from 'zod';
import {
  codeForIndex,
  MAX_PERIODS,
  MIN_PERIODS,
  PERIOD_OFFSET_MAX,
  PERIOD_OFFSET_MIN,
} from './production-periods';

/**
 * Walidacja okresów T1/T2/T3, wydzielona z `production-periods.ts` w F2-06.
 *
 * Powód jest jeden i mierzalny: `production-periods.ts` jest importowany przez
 * gant, czyli przez kod kliencki, a jedyny import zoda w tym pliku wciągał całą
 * bibliotekę (61,4 kB po gzip) do pierwszego ładowania `/calendar`. Schematy
 * czyta wyłącznie serwer: akcja `campaigns.ts` oraz ładowarki szablonów.
 * Nie importuj tego pliku z komponentu klienckiego.
 */

const periodShape = z.object({
  code: z.string(),
  name: z.string().min(1).max(40).optional(),
  description: z.string().min(1).max(500).optional(),
  startOffsetDays: z.number().int().min(PERIOD_OFFSET_MIN).max(PERIOD_OFFSET_MAX),
  endOffsetDays: z.number().int().min(PERIOD_OFFSET_MIN).max(PERIOD_OFFSET_MAX),
});

export const periodsSchema = z
  .array(periodShape)
  .min(MIN_PERIODS)
  .max(MAX_PERIODS)
  .superRefine((periods, ctx) => {
    // Codes must follow the auto-derived T<idx+1> pattern. Validation enforces
    // it so accidental hand-edits in JSON files surface as errors instead of
    // mysterious gantt mis-renders.
    periods.forEach((p, i) => {
      const expected = codeForIndex(i);
      if (p.code !== expected) {
        ctx.addIssue({
          code: 'custom',
          message: `Okres #${i + 1} musi mieć kod ${expected}`,
          path: [i, 'code'],
        });
      }
    });
    // Each period: start <= end.
    periods.forEach((p, i) => {
      if (p.startOffsetDays > p.endOffsetDays) {
        ctx.addIssue({
          code: 'custom',
          message: `${p.code}: początek musi być wcześniej lub równy końcowi`,
          path: [i, 'startOffsetDays'],
        });
      }
    });
    // Adjacent pairs: previous end strictly before next start (no overlap, no
    // shared day). Adjacency (gap = 1 day) is allowed.
    for (let i = 0; i < periods.length - 1; i++) {
      const a = periods[i];
      const b = periods[i + 1];
      if (a.endOffsetDays >= b.startOffsetDays) {
        ctx.addIssue({
          code: 'custom',
          message: `${a.code} (koniec) i ${b.code} (start) nakładają się — okresy muszą być rozdzielone`,
          path: [i + 1, 'startOffsetDays'],
        });
      }
    }
  });
