import { describe, expect, it } from 'vitest';
import {
  addDays,
  endOfDay,
  formatDayLabel,
  formatDayShort,
  formatHM,
  isoToInputLocal,
  isoWeekToMonday,
  startOfWeek,
  timeUntil,
  toIsoWeekString,
} from './dates';
import { timeAgo } from './time-ago';

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

describe('startOfWeek, addDays, endOfDay', () => {
  it('tydzień zaczyna się w poniedziałek o północy, także dla niedzieli', () => {
    expect(startOfWeek(new Date(2026, 5, 21, 23, 30))).toEqual(new Date(2026, 5, 15));
    expect(startOfWeek(new Date(2026, 5, 15))).toEqual(new Date(2026, 5, 15));
  });

  it('dodawanie dni przechodzi przez granicę miesiąca i nie rusza oryginału', () => {
    const d = new Date(2026, 5, 30, 12, 0);
    expect(addDays(d, 2)).toEqual(new Date(2026, 6, 2, 12, 0));
    expect(d.getDate()).toBe(30);
  });

  it('koniec dnia to ostatnia milisekunda tej daty', () => {
    expect(endOfDay(new Date(2026, 5, 15, 8, 0)).getTime()).toBe(
      new Date(2026, 5, 15, 23, 59, 59, 999).getTime(),
    );
  });
});

describe('formatowanie dat do widoku', () => {
  it('godzina, etykieta dnia i skrót dnia mają stały format', () => {
    const d = new Date(2026, 5, 15, 9, 5);
    expect(formatHM(d)).toBe('09:05');
    expect(formatDayLabel(d)).toBe('pn 15 cze');
    expect(formatDayShort(d)).toBe('pn 15.06');
    expect(isoToInputLocal(d)).toBe('2026-06-15T09:05');
  });
});

describe('timeUntil - ile zostało do terminu', () => {
  const now = new Date(2026, 5, 15, 12, 0);

  it('minuty, godziny i dni mają własne progi', () => {
    expect(timeUntil(new Date(2026, 5, 15, 12, 30), now)).toBe('za 30 min');
    expect(timeUntil(new Date(2026, 5, 15, 15, 30), now)).toBe('za 3h 30min');
    expect(timeUntil(new Date(2026, 5, 17, 12, 0), now)).toBe('za 2d');
  });

  it('termin właśnie minął to TERAZ, dawno minięty i odległy to null', () => {
    expect(timeUntil(new Date(2026, 5, 15, 11, 30), now)).toBe('TERAZ');
    expect(timeUntil(new Date(2026, 5, 15, 9, 0), now)).toBeNull();
    expect(timeUntil(new Date(2026, 8, 15), now)).toBeNull();
  });
});

describe('timeAgo - ile minęło', () => {
  const now = new Date(2026, 5, 15, 12, 0);

  it('każdy próg ma własny opis, powyżej tygodnia wraca data', () => {
    expect(timeAgo(new Date(2026, 5, 15, 11, 59, 30), now)).toBe('przed chwilą');
    expect(timeAgo(new Date(2026, 5, 15, 11, 30), now)).toBe('30 min temu');
    expect(timeAgo(new Date(2026, 5, 15, 9, 0), now)).toBe('3 godz temu');
    expect(timeAgo(new Date(2026, 5, 14, 9, 0), now)).toBe('wczoraj');
    expect(timeAgo(new Date(2026, 5, 12, 9, 0), now)).toBe('3 dni temu');
    expect(timeAgo(new Date(2026, 4, 30, 9, 0), now)).toBe('30.05');
  });
});
