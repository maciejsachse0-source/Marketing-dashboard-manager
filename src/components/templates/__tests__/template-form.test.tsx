/**
 * Test przypinający zachowanie formularza szablonu produkcji.
 * Napisany PRZED rozbiciem pliku (F3-07) i zielony na kodzie sprzed niego, więc
 * po refaktorze czerwony oznacza zmianę zachowania, a nie przeniesienie kodu.
 *
 * Pinuje trzy ścieżki wymagane kryterium: zapis poprawny, zapis odrzucony przez
 * walidację, wyjście z formularza bez zapisu. Czwarta rzecz, którą pinuje przy
 * okazji, to LICZBA wywołań akcji serwerowej przy zapisie: dokładnie jedno.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const createTemplate = vi.fn();
const updateTemplate = vi.fn();
const deleteTemplate = vi.fn();
vi.mock('@/server/actions/templates', () => ({
  createTemplate: (...a: unknown[]) => createTemplate(...a),
  updateTemplate: (...a: unknown[]) => updateTemplate(...a),
  deleteTemplate: (...a: unknown[]) => deleteTemplate(...a),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { TemplateForm } from '../template-form';

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  createTemplate.mockResolvedValue({ name: 'Szablon testowy', slug: 'szablon-testowy' });
});

function wpisz(pole: HTMLElement, wartosc: string) {
  fireEvent.change(pole, { target: { value: wartosc } });
}

function dodajKrok() {
  fireEvent.click(screen.getAllByRole('button', { name: /Dodaj krok do/i })[0]);
  wpisz(screen.getByPlaceholderText(/Etykieta kroku/i), 'Wysłanie maila');
}

describe('TemplateForm', () => {
  it('zapis poprawny woła akcję serwerową dokładnie raz i wraca na listę', async () => {
    render(<TemplateForm mode={{ kind: 'create' }} />);

    wpisz(screen.getByLabelText('Nazwa szablonu'), 'Szablon testowy');
    dodajKrok();
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz szablon' }));

    await waitFor(() => expect(createTemplate).toHaveBeenCalledTimes(1));
    expect(updateTemplate).not.toHaveBeenCalled();
    const payload = createTemplate.mock.calls[0][0] as { name: string; steps: unknown[] };
    expect(payload.name).toBe('Szablon testowy');
    expect(payload.steps).toHaveLength(1);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/templates');
  });

  it('zapis bez kroków pokazuje błąd walidacji i nie woła serwera', async () => {
    render(<TemplateForm mode={{ kind: 'create' }} />);

    wpisz(screen.getByLabelText('Nazwa szablonu'), 'Szablon bez kroków');
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz szablon' }));

    expect(await screen.findByText('Szablon musi mieć co najmniej jeden krok.')).toBeTruthy();
    expect(createTemplate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('wyjście z formularza prowadzi na listę i niczego nie zapisuje', async () => {
    render(<TemplateForm mode={{ kind: 'create' }} />);

    wpisz(screen.getByLabelText('Nazwa szablonu'), 'Porzucony szablon');
    const wyjscie = screen.getByRole('link', { name: /Wróć do listy/ });
    expect(wyjscie.getAttribute('href')).toBe('/templates');
    fireEvent.click(wyjscie);

    expect(createTemplate).not.toHaveBeenCalled();
    expect(updateTemplate).not.toHaveBeenCalled();
  });
});
