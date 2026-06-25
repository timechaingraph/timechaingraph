import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { WalletLegend } from '../WalletLegend';

describe('<WalletLegend>', () => {
  it('renders all four wallet role labels', () => {
    const { getByText } = render(<WalletLegend />);
    expect(getByText('Miner')).toBeTruthy();
    expect(getByText('Whale')).toBeTruthy();
    expect(getByText('Significant')).toBeTruthy();
    expect(getByText('Dust')).toBeTruthy();
  });

  it('dismisses when × is clicked', () => {
    const { getByLabelText, queryByText } = render(<WalletLegend />);
    expect(queryByText('Miner')).toBeTruthy();
    fireEvent.click(getByLabelText('Dismiss legend'));
    expect(queryByText('Miner')).toBeNull();
  });

  it('shows threshold text for each role', () => {
    const { getByText } = render(<WalletLegend />);
    expect(getByText(/coinbase recipient/i)).toBeTruthy();
    expect(getByText(/1,000 BTC/i)).toBeTruthy();
    expect(getByText(/1 BTC or/i)).toBeTruthy();
  });
});
