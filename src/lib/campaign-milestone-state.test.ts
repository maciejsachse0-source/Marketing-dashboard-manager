import { describe, expect, it } from 'vitest';
import type { CampaignMilestones, ProductionStep } from '../../drizzle/schema';
import {
  buildMilestoneOrder,
  buildMilestoneStates,
  isMilestoneDone,
} from './campaign-milestone-state';
import { resolveStepSequence } from './category-sequence';

function milestone(
  id: string,
  period: string,
  over: Partial<CampaignMilestones[number]> = {},
): CampaignMilestones[number] {
  return { id, period, label: id, doneAt: null, submilestones: [], ...over };
}

describe('isMilestoneDone - kamień z podpunktami', () => {
  it('kamień bez podpunktów liczy własną datę, z podpunktami wymaga wszystkich', () => {
    expect(isMilestoneDone(milestone('a', 'T1', { doneAt: '2026-06-01' }))).toBe(true);
    expect(
      isMilestoneDone(
        milestone('b', 'T1', {
          doneAt: '2026-06-01',
          submilestones: [{ id: 's1', label: 's1', doneAt: null }],
        }),
      ),
    ).toBe(false);
  });
});

describe('buildMilestoneOrder - kolejność narracyjna', () => {
  it('sortuje po kolejności okresów, w okresie po kolejności na liście', () => {
    const ms = [milestone('b', 'T2'), milestone('a', 'T1'), milestone('c', 'T1')];
    expect(buildMilestoneOrder(ms, null)).toEqual(['a', 'c', 'b']);
  });

  it('kamień w okresie spoza listy ląduje na końcu, nie wypada', () => {
    const ms = [milestone('x', 'T9'), milestone('a', 'T1')];
    expect(buildMilestoneOrder(ms, null)).toEqual(['a', 'x']);
  });
});

describe('buildMilestoneStates - passed, active, pending', () => {
  it('pierwszy niezrobiony jest active, wcześniejsze passed, późniejsze pending', () => {
    const ms = [
      milestone('a', 'T1', { doneAt: '2026-06-01' }),
      milestone('b', 'T2'),
      milestone('c', 'T3'),
    ];
    expect([...buildMilestoneStates(ms, null).values()]).toEqual(['passed', 'active', 'pending']);
  });

  it('komplet zrobionych nie zostawia żadnego active', () => {
    const ms = [milestone('a', 'T1', { doneAt: '2026-06-01' })];
    expect(buildMilestoneStates(ms, null).get('a')).toBe('passed');
  });
});

describe('resolveStepSequence - kolejność kroków w kategorii', () => {
  const steps: ProductionStep[] = [
    { id: 'wlasny', category: 'outreach', label: 'Własny krok', doneAt: null },
    { id: 'email-sent', category: 'outreach', label: 'Mail', doneAt: null },
  ];

  it('kolejność bierze się z listy kroków, nie z listy etapów kanonicznych', () => {
    expect(resolveStepSequence(steps, 'outreach').map((i) => i.key)).toEqual([
      'wlasny',
      'email-sent',
      'terms-accepted',
      'cam-meeting-set',
    ]);
  });

  it('brakujący etap kanoniczny dopisuje się na końcu bez kroku', () => {
    const seq = resolveStepSequence(steps, 'outreach');
    expect(seq[0]).toMatchObject({ kind: 'custom' });
    expect(seq[3]).toMatchObject({ kind: 'canonical', step: null });
  });
});
