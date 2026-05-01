import type {
  ProductionStage,
  ProductionType,
  StepCalendarType,
  StepDateMode,
} from '../../drizzle/schema';
import type { TemplatePeriod } from './production-periods';

/**
 * Single step inside a template. Template steps describe the SHAPE of a
 * production — they get cloned into `productions.steps[]` at creation time
 * and from then on the production owns its own list. Editing the template
 * later does NOT retroactively change existing productions.
 */
export type TemplateStep = {
  id: string;
  category: ProductionStage;
  label: string;
  description?: string;
  dateMode?: StepDateMode;
  durationMinutes?: number;
  calendarType?: StepCalendarType;
};

/**
 * Template = ordered list of steps + identity metadata. The legacy
 * `customSteps` field has been replaced by a single flat `steps[]` list,
 * which now expresses the full pipeline (no implicit canonical 9-step base).
 */
export type ProductionTemplate = {
  slug: string;
  name: string;
  type: ProductionType;
  summary: string;
  description: string;
  steps: TemplateStep[];
  /** Optional T1/T2/T3 time-period overrides. When omitted, defaults to the
   *  three Mon-Sun calendar weeks anchored on T-0. Cloned onto the production
   *  at creation so later template edits don't shift existing productions. */
  periods?: TemplatePeriod[];
};

/** Legacy alias — kept temporarily so existing imports compile during the
 *  migration window. Will be deleted in cleanup phase along with the legacy
 *  CustomStep model. */
export type TemplateCustomStep = {
  category: ProductionStage;
  label: string;
  positionAfter: string;
  description?: string;
};
