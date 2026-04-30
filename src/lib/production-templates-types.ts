import type {
  ProductionStage,
  ProductionType,
  StepCalendarType,
  StepDateMode,
} from '../../drizzle/schema';

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
  /** Exactly 0 or 1 step per template carries this flag — gantt uses it to
   *  anchor the production's T-0. Validation guarantees uniqueness. */
  isT0Anchor?: boolean;
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
