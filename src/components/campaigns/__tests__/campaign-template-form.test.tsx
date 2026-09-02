/**
 * Test przypinający zachowanie formularza szablonu kampanii.
 * Napisany PRZED rozbiciem pliku (F3-08) i zielony na kodzie sprzed niego.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const createMarketingTemplate = vi.fn();
const updateMarketingTemplate = vi.fn();
const deleteMarketingTemplate = vi.fn();
vi.mock('@/server/actions/campaign-templates', () => ({
  createMarketingTemplate: (...a: unknown[]) => createMarketingTemplate(...a),
  updateMarketingTemplate: (...a: unknown[]) => updateMarketingTemplate(...a),
  deleteMarketingTemplate: (...a: unknown[]) => deleteMarketingTemplate(...a),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { CampaignTemplateForm } from '../campaign-template-form';

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  createMarketingTemplate.mockResolvedValue({ name: 'Kampania testowa', slug: 'kampania-testowa' });
});

function wpisz(pole: HTMLElement, wartosc: string) {
  fireEvent.change(pole, { target: { value: wartosc } });
}

describe('CampaignTemplateForm', () => {
  it('zapis poprawny woła akcję serwerową dokładnie raz i wraca na listę szablonów', async () => {
    render(<CampaignTemplateForm mode={{ kind: 'create' }} />);

    wpisz(screen.getByLabelText('Nazwa szablonu'), 'Kampania testowa');
    fireEvent.click(screen.getAllByRole('button', { name: /Dodaj milestone do/ })[0]);
    wpisz(screen.getByPlaceholderText(/Etykieta milestone/), 'Zapowiedź singla');
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz szablon' }));

    await waitFor(() => expect(createMarketingTemplate).toHaveBeenCalledTimes(1));
    const payload = createMarketingTemplate.mock.calls[0][0] as {
      name: string;
      milestones: { label: string }[];
    };
    expect(payload.name).toBe('Kampania testowa');
    expect(payload.milestones).toHaveLength(1);
    expect(payload.milestones[0].label).toBe('Zapowiedź singla');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/campaigns/templates'));
  });

  it('zapis bez milestone`ów pokazuje błąd walidacji i nie woła serwera', async () => {
    render(<CampaignTemplateForm mode={{ kind: 'create' }} />);

    wpisz(screen.getByLabelText('Nazwa szablonu'), 'Kampania bez milestone');
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz szablon' }));

    expect(
      await screen.findByText('Szablon musi zawierać co najmniej jeden milestone.'),
    ).toBeTruthy();
    expect(createMarketingTemplate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('wyjście z formularza prowadzi na listę i niczego nie zapisuje', () => {
    render(<CampaignTemplateForm mode={{ kind: 'create' }} />);

    const wyjscie = screen.getByRole('link', { name: /Wróć do listy/ });
    expect(wyjscie.getAttribute('href')).toBe('/campaigns/templates');
    fireEvent.click(wyjscie);

    expect(createMarketingTemplate).not.toHaveBeenCalled();
    expect(updateMarketingTemplate).not.toHaveBeenCalled();
  });
});
