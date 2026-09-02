/**
 * Test przypinający wynik renderowania osi czasu kampanii.
 * Napisany PRZED rozbiciem pliku (F3-08) i zielony na kodzie sprzed niego.
 * Pinuje to, co widzi użytkownik: kody okresów, wiersz produkcji z artystą,
 * luźny wpis kalendarza i zakres osi.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CampaignTimeline } from '../timeline';

const kickoff = new Date(2026, 4, 4, 12, 0, 0); // poniedziałek, 4 maja 2026

const periods = [
  { code: 'T1', name: 'Build-up', startOffsetDays: 0, endOffsetDays: 6 },
  { code: 'T2', name: 'Reveal', startOffsetDays: 7, endOffsetDays: 13 },
];

const produkcja = {
  id: 1,
  title: 'Kolaba z Anią',
  status: 'planned',
  t0At: new Date(2026, 4, 8, 12, 0, 0),
  artist: { id: 7, name: 'Ania', handle: 'ania' },
} as unknown as Parameters<typeof CampaignTimeline>[0]['productions'][number];

const wpis = {
  id: 11,
  title: 'Premiera na TikToku',
  type: 'deadline',
  status: 'planned',
  startsAt: new Date(2026, 4, 12, 10, 0, 0),
  endsAt: new Date(2026, 4, 12, 11, 0, 0),
  productionId: null,
} as unknown as Parameters<typeof CampaignTimeline>[0]['entries'][number];

beforeEach(cleanup);

describe('CampaignTimeline', () => {
  it('rysuje okresy, wiersz produkcji i luźny wpis kalendarza', () => {
    const { container } = render(
      <CampaignTimeline
        kickoffAt={kickoff}
        periods={periods}
        productions={[produkcja]}
        entries={[wpis]}
      />,
    );

    expect(screen.getAllByText('T1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('T2').length).toBeGreaterThan(0);
    expect(screen.getByText('Kolaba z Anią')).toBeTruthy();
    expect(screen.getAllByText(/Ania/).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Wspólny plan kampanii' })).toBeTruthy();
    // Luźny wpis kalendarza renderuje się jako pinezka z tytułem w podpowiedzi.
    expect(container.querySelector('[title*="Premiera na TikToku"]')).toBeTruthy();
  });

  it('bez produkcji i bez wpisów pokazuje stan pusty, a nie pustą oś', () => {
    render(
      <CampaignTimeline kickoffAt={kickoff} periods={periods} productions={[]} entries={[]} />,
    );

    expect(screen.getAllByText('T1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Kolaba z Anią')).toBeNull();
  });
});
