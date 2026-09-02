import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportProgress } from './import-progress';

describe('ImportProgress', () => {
  it('pokazuje numer paczki i ich liczbę', () => {
    render(<ImportProgress done={4} total={10} />);
    expect(screen.getByTestId('import-postep').textContent).toBe('Zapisuję, paczka 4 z 10');
  });

  it('pasek niesie te same liczby w atrybutach dostępności', () => {
    render(<ImportProgress done={4} total={10} />);
    const pasek = screen.getByRole('progressbar', { name: 'Postęp zapisu' });
    expect(pasek.getAttribute('aria-valuenow')).toBe('4');
    expect(pasek.getAttribute('aria-valuemax')).toBe('10');
  });

  it('zero paczek nie rysuje wypełnienia, nie dzieli przez zero', () => {
    const { container } = render(<ImportProgress done={0} total={0} />);
    const wypelnienie = container.querySelector('[role="progressbar"] > div') as HTMLElement;
    expect(wypelnienie.style.width).toBe('0%');
  });
});
