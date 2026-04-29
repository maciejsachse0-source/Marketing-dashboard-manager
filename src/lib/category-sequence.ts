import type {
  CustomStep,
  ProductionStage,
  ProductionStatus,
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
  | { kind: 'canonical'; key: string; stage: ProductionStatus }
  | { kind: 'custom'; key: string; step: CustomStep };

/**
 * Resolve a category's display sequence — joint canonical + custom list in
 * the order the user sees on /productions and in the gantt sub-bar.
 *
 * Two sources of truth, in priority order:
 *  1. `storedOrder` (from `productions.step_order[category]`) — once a category
 *     has been touched by `moveStepInCategory`, this becomes authoritative.
 *  2. Default: canonicals in their fixed enum order, with each custom slotted
 *     in after `c.positionAfter` (legacy positionAfter model). Customs whose
 *     positionAfter doesn't match any canonical fall back to "end of category".
 *
 * Either way the result is a flat ordered list of `SequenceItem`s. `key` is
 * unique within the category and is what `moveStepInCategory` accepts as
 * `stepKey`.
 */
export function resolveCategorySequence(
  category: ProductionStage,
  customs: CustomStep[],
  storedOrder: string[] | undefined,
): SequenceItem[] {
  const canonicals = CANONICAL_STAGES_BY_CATEGORY[category];
  const canonicalSet = new Set<string>(canonicals);
  const customById = new Map(customs.map((c) => [c.id, c] as const));

  if (storedOrder && storedOrder.length > 0) {
    const seen = new Set<string>();
    const items: SequenceItem[] = [];
    for (const key of storedOrder) {
      if (seen.has(key)) continue;
      if (canonicalSet.has(key)) {
        items.push({ kind: 'canonical', key, stage: key as ProductionStatus });
        seen.add(key);
      } else {
        const c = customById.get(key);
        if (c) {
          items.push({ kind: 'custom', key, step: c });
          seen.add(key);
        }
      }
    }
    // Append any canonical/custom not present in storedOrder (e.g. a custom
    // added after the last reorder, or schema growth) so nothing disappears.
    for (const stage of canonicals) {
      if (!seen.has(stage)) items.push({ kind: 'canonical', key: stage, stage });
    }
    for (const c of customs) {
      if (!seen.has(c.id)) items.push({ kind: 'custom', key: c.id, step: c });
    }
    return items;
  }

  // Legacy default: canonicals in enum order, customs interleaved by positionAfter.
  const fallback = canonicals[canonicals.length - 1];
  const customsByAfter = new Map<ProductionStatus, CustomStep[]>();
  for (const c of customs) {
    const after =
      c.positionAfter && canonicalSet.has(c.positionAfter)
        ? c.positionAfter
        : fallback;
    const arr = customsByAfter.get(after) ?? [];
    arr.push(c);
    customsByAfter.set(after, arr);
  }
  const items: SequenceItem[] = [];
  for (const stage of canonicals) {
    items.push({ kind: 'canonical', key: stage, stage });
    for (const c of customsByAfter.get(stage) ?? []) {
      items.push({ kind: 'custom', key: c.id, step: c });
    }
  }
  return items;
}

/** Convert a SequenceItem[] into the string[] persistence format. */
export function sequenceToOrder(seq: SequenceItem[]): string[] {
  return seq.map((it) => it.key);
}
