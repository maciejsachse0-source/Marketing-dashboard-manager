import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERIODS,
  codeForIndex,
  describeOffset,
  offsetToWeekDow,
  periodsRelativeToT0Mon,
  resolvePeriods,
  weekDowToOffset,
  type TemplatePeriod,
} from './production-periods';
import { periodsSchema } from './production-periods-schema';
import { dateAt, fmtDayMonth, isoDate, parseIsoDate, toneForIndex } from './period-tones';

/** Okresy T1..Tn i pomocnicze funkcje palety — wszystko czyste, bez bazy. */
const CUSTOM: TemplatePeriod[] = [
  { code: 'T1', startOffsetDays: 0, endOffsetDays: 2 },
  { code: 'T2', startOffsetDays: 3, endOffsetDays: 9 },
];

describe('resolvePeriods - wartość zapasowa', () => {
  it('null i pusta lista dają domyślne trzy okresy, własna lista przechodzi bez zmian', () => {
    expect(resolvePeriods(null)).toBe(DEFAULT_PERIODS);
    expect(resolvePeriods([])).toBe(DEFAULT_PERIODS);
    expect(resolvePeriods(CUSTOM)).toBe(CUSTOM);
  });

  it('kod okresu wynika z pozycji na liście', () => {
    expect([0, 1, 2].map(codeForIndex)).toEqual(['T1', 'T2', 'T3']);
  });
});

describe('periodsRelativeToT0Mon - przesunięcie na tydzień publikacji', () => {
  it('domyślne okresy siadają na -14..-8, -7..-1, 0..6', () => {
    expect(periodsRelativeToT0Mon(null).map((p) => [p.startOffsetDays, p.endOffsetDays])).toEqual([
      [-14, -8],
      [-7, -1],
      [0, 6],
    ]);
  });

  it('ostatni okres własnej listy zawsze zaczyna się na 0', () => {
    const shifted = periodsRelativeToT0Mon(CUSTOM);
    expect(shifted[shifted.length - 1].startOffsetDays).toBe(0);
    expect(shifted[0].startOffsetDays).toBe(-3);
  });
});

describe('offset dnia a tydzień i dzień tygodnia', () => {
  it('przeliczenie w obie strony zgadza się także dla wartości ujemnych', () => {
    expect(offsetToWeekDow(10)).toEqual({ weekIndex: 1, dow: 3 });
    expect(offsetToWeekDow(-1)).toEqual({ weekIndex: -1, dow: 6 });
    expect(weekDowToOffset(1, 3)).toBe(10);
    expect(weekDowToOffset(-1, 6)).toBe(-1);
  });

  it('opis offsetu ma znak i skrót dnia tygodnia', () => {
    expect(describeOffset(0)).toBe('Start (pon)');
    expect(describeOffset(10)).toBe('+10d (czw)');
    expect(describeOffset(-1)).toBe('−1d (nd)');
  });
});

describe('period-tones - paleta i daty okresów', () => {
  it('paleta zawija się po sześciu okresach', () => {
    expect(toneForIndex(6)).toBe(toneForIndex(0));
  });

  it('data okresu przesuwa się o offset i wraca z formatu ISO', () => {
    const d = dateAt(new Date(2026, 5, 1), 10);
    expect(isoDate(d)).toBe('2026-06-11');
    expect(fmtDayMonth(d)).toBe('11 cze');
    expect(parseIsoDate('2026-06-11')).toEqual(new Date(2026, 5, 11));
    expect(parseIsoDate('11.06.2026')).toBeNull();
  });
});

describe('periodsSchema - walidacja okresów przed zapisem', () => {
  it('poprawna lista przechodzi, kod niezgodny z pozycją nie', () => {
    expect(periodsSchema.safeParse(CUSTOM).success).toBe(true);
    expect(
      periodsSchema.safeParse([{ code: 'T2', startOffsetDays: 0, endOffsetDays: 2 }]).success,
    ).toBe(false);
  });

  it('okres odwrócony, nakładające się okresy i pusta lista są odrzucone', () => {
    expect(
      periodsSchema.safeParse([{ code: 'T1', startOffsetDays: 5, endOffsetDays: 2 }]).success,
    ).toBe(false);
    expect(
      periodsSchema.safeParse([
        { code: 'T1', startOffsetDays: 0, endOffsetDays: 5 },
        { code: 'T2', startOffsetDays: 5, endOffsetDays: 9 },
      ]).success,
    ).toBe(false);
    expect(periodsSchema.safeParse([]).success).toBe(false);
  });
});
