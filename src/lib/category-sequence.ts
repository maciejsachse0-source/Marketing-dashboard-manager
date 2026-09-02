import type {
  ProductionStage,
  ProductionStatus,
  ProductionStep,
} from '../../drizzle/schema';

/** Canonical sub-stages per category — fixed at the schema level by the
 *  ProductionStatus enum, but listed here in display-default order so we can
 *  build joint sequences without re-importing the wider STAGE_CATEGORIES
 *  config from any one component file. */
export const CANONICAL_STAGES_BY_CATEGORY: Record<ProductionStage, ProductionStatus[]> = {
  outreach: ['email-sent', 'terms-accepted', 'cam-meeting-set'],
  ustalenia: ['cam-date-shared', 'script-discussed', 'script-sent'],
  nagrywanie: ['shooting'],
  obrobka: ['editing'],
  publikacja: ['publishing'],
};

export type SequenceItem =
  | { kind: 'canonical'; key: string; stage: ProductionStatus; step: ProductionStep | null }
  | { kind: 'custom'; key: string; step: ProductionStep };

/**
 * Resolve a category's display sequence straight from the production's flat
 * `steps[]` — the single source of truth since migration 0011. The order the
 * user sees is the order the steps sit in the array; `moveStepInCategory`
 * reorders that array, so no separate order map is needed.
 *
 * A canonical stage missing from `steps[]` (production created before the
 * flexible model, or with an empty list) is appended at the end of its
 * category so the strip still renders the full pipeline skeleton instead of
 * an empty row.
 */
export function resolveStepSequence(
  steps: ProductionStep[],
  category: ProductionStage,
): SequenceItem[] {
  const canonicals = CANONICAL_STAGES_BY_CATEGORY[category];
  const canonicalSet = new Set<string>(canonicals);
  const items: SequenceItem[] = [];
  const seen = new Set<string>();

  for (const s of steps) {
    if (s.category !== category || seen.has(s.id)) continue;
    seen.add(s.id);
    items.push(
      canonicalSet.has(s.id)
        ? { kind: 'canonical', key: s.id, stage: s.id as ProductionStatus, step: s }
        : { kind: 'custom', key: s.id, step: s },
    );
  }
  for (const stage of canonicals) {
    if (!seen.has(stage)) items.push({ kind: 'canonical', key: stage, stage, step: null });
  }
  return items;
}
