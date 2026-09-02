import { describe, expect, it } from 'vitest';
import { isoWeekToMonday, toIsoWeekString } from './dates';

// toIsoWeekString has the one rule that is easy to get wrong: the year of an ISO
// week is the year of the Thursday inside it, not the year of the date itself.
// The third case is exactly that boundary.
describe('toIsoWeekString', () => {
  it('numbers a mid-year Monday', () => {
    expect(toIsoWeekString(new Date(2026, 5, 15))).toBe('2026-W25');
  });

  it('puts the 1st of January into week 01 when it is a Thursday', () => {
    expect(toIsoWeekString(new Date(2026, 0, 1))).toBe('2026-W01');
  });

  it('assigns a late-December date to the NEXT year week 01 (boundary)', () => {
    // Mon 2025-12-29: its Thursday is 2026-01-01, so the ISO week is 2026-W01.
    expect(toIsoWeekString(new Date(2025, 11, 29))).toBe('2026-W01');
  });
});

describe('isoWeekToMonday', () => {
  it('round-trips with toIsoWeekString', () => {
    const monday = isoWeekToMonday('2026-W25');
    expect(monday).not.toBeNull();
    expect(toIsoWeekString(monday!)).toBe('2026-W25');
    expect(monday!.getDay()).toBe(1);
  });

  it('returns null for a malformed week string', () => {
    expect(isoWeekToMonday('2026-25')).toBeNull();
  });
});
