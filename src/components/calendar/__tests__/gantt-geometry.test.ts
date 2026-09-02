import { describe, expect, it } from 'vitest';
import {
  categoryState,
  clipToWindow,
  computeFrameBands,
  dayDiff,
  resolveStageDate,
  STAGE_CATEGORIES,
  type GanttRow,
} from '../gantt-geometry';

/**
 * Testy przypinające (F2-01). Opisują zachowanie osi czasu ganta TAKIE, JAKIE
 * JEST przed refaktorem F2-02 i F2-03. Zielone po refaktorze = przeniesienie
 * kodu bez zmiany zachowania. Żaden test nie robi migawki drzewa komponentu —
 * sprawdzana jest wyłącznie arytmetyka pozycji.
 */

/** Poniedziałek 2026-06-01 — początek widocznego okna we wszystkich testach. */
const WINDOW_START = new Date(2026, 5, 1);
/** Okno tygodnia i okno kwartału, w dniach (gant liczy totalDays = tygodnie * 7). */
const WEEK_WINDOW = 7;
const QUARTER_WINDOW = 13 * 7;

function makeRow(over: Partial<GanttRow> = {}): GanttRow {
  return {
    id: 1,
    title: 'Produkcja testowa',
    slug: 'produkcja-testowa',
    type: 'solo',
    status: 'shooting',
    // Czwartek 2026-06-18 — T-0 leży w oknie kwartalnym, poza oknem tygodnia.
    t0At: new Date(2026, 5, 18),
    stepDates: null,
    steps: [],
    periods: null,
    cancelled: false,
    artistName: null,
    artistHandle: null,
    videographerName: null,
    platforms: null,
    ...over,
  };
}

describe('dayDiff - indeks dnia względem początku okna', () => {
  it('liczy dni ignorując godzinę', () => {
    expect(dayDiff(new Date(2026, 5, 4, 23, 30), WINDOW_START)).toBe(3);
    expect(dayDiff(new Date(2026, 5, 1, 0, 0), WINDOW_START)).toBe(0);
  });
});

describe('pozycja kroku względem okna', () => {
  it('krok wewnątrz okna zachowuje indeks i nie jest oznaczany', () => {
    const raw = dayDiff(new Date(2026, 5, 4), WINDOW_START);
    expect(clipToWindow(raw, QUARTER_WINDOW)).toEqual({ dayIdx: 3, outOfWindow: null });
  });

  it('krok przed oknem jest przycięty do 0 i oznaczony jako before', () => {
    const raw = dayDiff(new Date(2026, 4, 20), WINDOW_START);
    expect(raw).toBeLessThan(0);
    expect(clipToWindow(raw, QUARTER_WINDOW)).toEqual({ dayIdx: 0, outOfWindow: 'before' });
  });

  it('krok po oknie jest przycięty do ostatniego dnia i oznaczony jako after', () => {
    const raw = dayDiff(new Date(2026, 8, 30), WINDOW_START);
    expect(raw).toBeGreaterThanOrEqual(QUARTER_WINDOW);
    expect(clipToWindow(raw, QUARTER_WINDOW)).toEqual({
      dayIdx: QUARTER_WINDOW - 1,
      outOfWindow: 'after',
    });
  });

  it('ostatni dzień okna jeszcze mieści się w oknie, następny już nie', () => {
    expect(clipToWindow(WEEK_WINDOW - 1, WEEK_WINDOW).outOfWindow).toBeNull();
    expect(clipToWindow(WEEK_WINDOW, WEEK_WINDOW).outOfWindow).toBe('after');
  });
});

describe('resolveStageDate - skąd bierze się data kamienia milowego', () => {
  it('data zapisana przez użytkownika wygrywa ze wszystkim', () => {
    const row = makeRow({ stepDates: { shooting: '2026-06-10T09:00:00.000Z' } });
    const r = resolveStageDate('shooting', row);
    expect(r.source).toBe('recorded');
    expect(r.date.toISOString()).toBe('2026-06-10T09:00:00.000Z');
  });

  it('montaż bez własnej daty wypada dzień po nagrywkach', () => {
    const row = makeRow({ stepDates: { shooting: '2026-06-10T09:00:00.000Z' } });
    const r = resolveStageDate('editing', row);
    expect(r.source).toBe('derived');
    expect(dayDiff(r.date, new Date(2026, 5, 10))).toBe(1);
  });

  it('publikacja zawsze siada na T-0', () => {
    const row = makeRow();
    const r = resolveStageDate('publishing', row);
    expect(r.source).toBe('t0');
    expect(r.date).toEqual(row.t0At);
  });

  it('produkcja bez kotwicy T0 w krokach dostaje pozycję domyślną, nie datę', () => {
    // Brak stepDates w ogóle: żaden krok nie ma zapisanej daty, więc kamień
    // milowy jest "tentative" i liczony od poniedziałku tygodnia T-0.
    const row = makeRow({ stepDates: null });
    const r = resolveStageDate('cam-meeting-set', row);
    expect(r.source).toBe('tentative');
    // t0At = czwartek 2026-06-18, poniedziałek jego tygodnia = 2026-06-15,
    // offset domyślny dla 'cam-meeting-set' to -12 dni.
    expect(dayDiff(r.date, new Date(2026, 5, 15))).toBe(-12);
  });
});

describe('computeFrameBands - pasy T1/T2/T3 przycięte do okna', () => {
  it('w oknie kwartału mieszczą się wszystkie trzy pasy, każdy po 7 dni', () => {
    const bands = computeFrameBands(makeRow().t0At, WINDOW_START, QUARTER_WINDOW, null);
    expect(bands.map((b) => b.code)).toEqual(['T1', 'T2', 'T3']);
    // t0Mon = 2026-06-15 = dzień 14 okna, więc T1 zaczyna się 14 dni wcześniej.
    expect(bands).toEqual([
      { code: 'T1', startDay: 0, endDay: 6 },
      { code: 'T2', startDay: 7, endDay: 13 },
      { code: 'T3', startDay: 14, endDay: 20 },
    ]);
  });

  it('w oknie tygodnia zostaje tylko ten fragment pasa, który widać', () => {
    const bands = computeFrameBands(makeRow().t0At, WINDOW_START, WEEK_WINDOW, null);
    expect(bands).toEqual([{ code: 'T1', startDay: 0, endDay: 6 }]);
  });

  it('pasy w całości poza oknem znikają zamiast kleić się do krawędzi', () => {
    // T-0 rok później: wszystkie trzy pasy leżą za prawą krawędzią okna.
    const bands = computeFrameBands(new Date(2027, 5, 18), WINDOW_START, WEEK_WINDOW, null);
    expect(bands).toEqual([]);
  });
});

describe('categoryState - stan kategorii wobec statusu produkcji', () => {
  const outreach = STAGE_CATEGORIES[0];
  const ustalenia = STAGE_CATEGORIES[1];
  const nagrywanie = STAGE_CATEGORIES[2];

  it('kategoria domknięta jest passed, bieżąca active, przyszła pending', () => {
    // Uwaga: kategoria jest "passed" już wtedy, gdy status DOSZEDŁ do jej
    // ostatniego podkroku (cur >= endIdx), nie dopiero po jego minięciu.
    expect(categoryState(outreach, 'shooting')).toBe('passed');
    expect(categoryState(ustalenia, 'cam-date-shared')).toBe('active');
    expect(categoryState(nagrywanie, 'email-sent')).toBe('pending');
  });

  it('produkcja anulowana nie ma żadnej kategorii zaliczonej', () => {
    expect(categoryState(outreach, 'cancelled')).toBe('pending');
  });
});
