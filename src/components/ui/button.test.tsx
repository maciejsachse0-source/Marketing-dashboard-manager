import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders its label and calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Zapisz</Button>);

    const button = screen.getByRole('button', { name: 'Zapisz' });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('loading: keeps the label, blocks the click and marks aria-busy', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Zapisz
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Zapisz' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.querySelector('[data-slot="button-spinner"]')).not.toBeNull();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
