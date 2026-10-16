import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CapabilityRibbon } from './CapabilityRibbon';

afterEach(cleanup);

describe('CapabilityRibbon', () => {
  it('continuously loops the approved terms without a motion control', () => {
    render(<CapabilityRibbon />);
    expect(document.querySelector('.ribbon-track')).toBeInTheDocument();
    expect(screen.getAllByText('Electricity')).toHaveLength(2);
    expect(screen.getAllByText('Naira + stablecoin payments')).toHaveLength(2);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
