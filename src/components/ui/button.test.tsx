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
});
