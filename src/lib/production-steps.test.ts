import { describe, expect, it } from 'vitest';
import type { ProductionStep } from '../../drizzle/schema';
import {
  cloneTemplateSteps,
  defaultDurationMinutes,
  deriveFromShootingIso,
  deriveProductionStage,
  deriveProductionState,
  getActiveStepIndex,
  getFirstPeriodStart,
  getStepWeekRange,
  getStepsInCategory,
  getT0AnchorStep,
  isProductionDone,
  newStepId,
  recordedStageDates,
} from './production-steps';

/**
 * Kroki produkcji (plan/06 sekcja 3, wiersz „Kroki produkcji"): kolejność,
 * oznaczanie jako zrobione, krok z datą pochodną. Funkcje czyste, żadnego
 * dotknięcia bazy.
 */
function step(over: Partial<ProductionStep> & { id: string }): ProductionStep {
  return {
    category: 'nagrywanie',
    label: over.id,
    doneAt: null,
    ...over,
  };
}

const PIPELINE: ProductionStep[] = [
  step({ id: 'email-sent', category: 'outreach', doneAt: '2026-06-01T10:00:00.000Z' }),
  step({ id: 'shooting', category: 'nagrywanie', isT0Anchor: true, dateMode: 'calendar' }),
  step({ id: 'wlasny-krok', category: 'nagrywanie' }),
  step({ id: 'publishing', category: 'publikacja' }),
];

describe('kolejność kroków', () => {
  it('pierwszy niezrobiony krok wyznacza pozycję produkcji', () => {
    expect(getActiveStepIndex(PIPELINE)).toBe(1);
    expect(deriveProductionStage(PIPELINE)).toBe('shooting');
  });

  it('kroki w kategorii zachowują kolejność z listy razem z indeksem globalnym', () => {
    expect(getStepsInCategory(PIPELINE, 'nagrywanie').map((x) => x.globalIdx)).toEqual([1, 2]);
  });

  it('kotwica T-0 to krok z flagą, brak flagi to null', () => {
    expect(getT0AnchorStep(PIPELINE)?.id).toBe('shooting');
    expect(getT0AnchorStep([step({ id: 'a' })])).toBeNull();
  });
});

describe('oznaczanie kroku jako zrobiony', () => {
  it('komplet zrobionych kroków kończy produkcję, pusta lista nie', () => {
    const done = PIPELINE.map((s) => ({ ...s, doneAt: '2026-06-10T10:00:00.000Z' }));
    expect(isProductionDone(done)).toBe(true);
    expect(getActiveStepIndex(done)).toBe(done.length);
    expect(deriveProductionState(done, null)).toBe('done');
    expect(isProductionDone([])).toBe(false);
  });

  it('anulowanie wygrywa ze stanem kroków', () => {
    const done = PIPELINE.map((s) => ({ ...s, doneAt: '2026-06-10T10:00:00.000Z' }));
    expect(deriveProductionState(done, new Date('2026-06-11'))).toBe('cancelled');
    expect(deriveProductionState(PIPELINE, null)).toBe('in-progress');
  });

  it('kolejny etap kanoniczny wchodzi dopiero po odhaczeniu poprzedniego', () => {
    const afterShoot = PIPELINE.map((s) =>
      s.id === 'shooting' ? { ...s, doneAt: '2026-06-18T10:00:00.000Z' } : s,
    );
    expect(deriveProductionStage(afterShoot)).toBe('publishing');
  });
});

describe('krok z datą pochodną', () => {
  it('data pochodna to dzień po nagrywkach o 10:00 czasu lokalnego', () => {
    const derived = new Date(deriveFromShootingIso(new Date(2026, 5, 18, 15, 30).toISOString()));
    expect(derived.getDate()).toBe(19);
    expect(derived.getHours()).toBe(10);
    expect(derived.getMinutes()).toBe(0);
  });

  it('domyślny czas trwania zależy od trybu daty', () => {
    expect(defaultDurationMinutes('calendar')).toBe(60);
    expect(defaultDurationMinutes('record')).toBe(0);
    expect(defaultDurationMinutes(undefined)).toBe(0);
  });

  it('zapisane daty etapów kanonicznych trafiają do indeksu, własny krok nie', () => {
    const withDates = PIPELINE.map((s) =>
      s.category === 'nagrywanie' ? { ...s, dateIso: '2026-06-18' } : s,
    );
    expect(recordedStageDates(withDates)).toEqual({ shooting: '2026-06-18' });
  });
});

describe('okno tygodnia dla kategorii', () => {
  it('nagrywanie siada tydzień przed poniedziałkiem tygodnia publikacji', () => {
    const range = getStepWeekRange(new Date(2026, 5, 18), 'nagrywanie');
    expect(range.start).toEqual(new Date(2026, 5, 8));
    expect(range.end.getDate()).toBe(14);
    expect(range.end.getHours()).toBe(23);
  });

  it('pierwszy okres startuje dwa tygodnie przed tygodniem T-0', () => {
    expect(getFirstPeriodStart(new Date(2026, 5, 18))).toEqual(new Date(2026, 5, 1));
  });
});

describe('klonowanie kroków szablonu', () => {
  it('klon nie niesie stanu produkcji i ma świeże identyfikatory dla nowych kroków', () => {
    const cloned = cloneTemplateSteps([
      { id: 'shooting', category: 'nagrywanie', label: 'Nagrywka', doneAt: undefined },
    ]);
    expect(cloned).toEqual([
      {
        id: 'shooting',
        category: 'nagrywanie',
        label: 'Nagrywka',
        description: undefined,
        doneAt: null,
        dateMode: undefined,
        durationMinutes: undefined,
        calendarType: undefined,
      },
    ]);
    expect(newStepId()).not.toBe(newStepId());
  });
});
