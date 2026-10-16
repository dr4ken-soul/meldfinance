import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PublicSite } from './PublicSite';

describe('Meld public site', () => {
  it('presents Meld’s bill-payment scope and real route targets', () => {
    render(<MemoryRouter><PublicSite /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'A clearer way to pay everyday bills.' })).toBeInTheDocument();
    for (const category of ['Electricity', 'Airtime', 'Mobile data', 'Cable TV']) {
      expect(screen.getAllByText(category).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole('link', { name: /create account/i }).every((link) => link.getAttribute('href') === '/register')).toBe(true);
    expect(screen.getByRole('link', { name: /see how it works/i })).toHaveAttribute('href', '#how-meld-works');
  });
});
