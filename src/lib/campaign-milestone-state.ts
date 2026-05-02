import type { CampaignMilestones } from '../../drizzle/schema';
import { resolvePeriods, type TemplatePeriod } from './production-periods';

export type CampaignMilestoneState = 'passed' | 'active' | 'pending';

/**
 * Same visual-state contract production gantt step circles use. `passed` =
 * fully done (incl. all subs); `active` = the FIRST not-yet-done milestone
 * in narrative order; `pending` = anything after the active one. With this
 * encoding, a click-to-cascade interaction can never end up in an
 * "out-of-order done" state — the active step always sits at the boundary.
 */
export function isMilestoneDone(
  m: CampaignMilestones[number],
): boolean {
  if (m.submilestones.length > 0) {
    return m.submilestones.every((s) => !!s.doneAt);
  }
  return !!m.doneAt;
}

/**
 * Build the canonical 1-D ordering used by the strip pins, the gantt
 * narrative row, AND the server-side `cascadeCampaignMilestonesTo`. Period
 * order × within-period array order; orphan periods (codes referenced but
 * not declared in the campaign's `periods`) sort after canonical periods
 * in first-appearance order. Returns the milestone ids in order.
 */
export function buildMilestoneOrder(
  milestones: CampaignMilestones,
  periods: TemplatePeriod[] | null | undefined,
): string[] {
  const resolved = resolvePeriods(periods);
  const periodIdx = new Map<string, number>(
    resolved.map((p, i) => [p.code, i]),
  );
  let orphanCounter = resolved.length;
  for (const m of milestones) {
    if (!periodIdx.has(m.period)) periodIdx.set(m.period, orphanCounter++);
  }
  const indexed = milestones.map((m, i) => ({ id: m.id, period: m.period, i }));
  indexed.sort((a, b) => {
    const pa = periodIdx.get(a.period) ?? Number.MAX_SAFE_INTEGER;
    const pb = periodIdx.get(b.period) ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.i - b.i;
  });
  return indexed.map((x) => x.id);
}

/**
 * Cascade-implied per-milestone visual state. The first not-fully-done
 * milestone is `active`; everything before it is `passed`; everything
 * after is `pending`. Mirrors production `SubStepBar.stateOf`.
 */
export function buildMilestoneStates(
  milestones: CampaignMilestones,
  periods: TemplatePeriod[] | null | undefined,
): Map<string, CampaignMilestoneState> {
  const order = buildMilestoneOrder(milestones, periods);
  const byId = new Map(milestones.map((m) => [m.id, m]));
  let firstUndone = -1;
  for (let i = 0; i < order.length; i++) {
    const m = byId.get(order[i]);
    if (m && !isMilestoneDone(m)) {
      firstUndone = i;
      break;
    }
  }
  const map = new Map<string, CampaignMilestoneState>();
  for (let i = 0; i < order.length; i++) {
    if (firstUndone < 0) map.set(order[i], 'passed');
    else if (i < firstUndone) map.set(order[i], 'passed');
    else if (i === firstUndone) map.set(order[i], 'active');
    else map.set(order[i], 'pending');
  }
  return map;
}
