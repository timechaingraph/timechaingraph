import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { WalletLegend } from '../WalletLegend';

describe('<WalletLegend>', () => {
  it('renders the roles the current bundle can contain (miner, whale)', () => {
    const { getByText } = render(<WalletLegend />);
    expect(getByText('Miner')).toBeTruthy();
    expect(getByText('Whale')).toBeTruthy();
  });

  it('does not advertise roles the ≥1,000 BTC floor makes impossible', () => {
    // significant/dust cannot appear in the shipped bundle — the legend must not
    // imply dots that can't render until v0.3 lowers the floor.
    const { queryByText } = render(<WalletLegend />);
    expect(queryByText('Significant')).toBeNull();
    expect(queryByText('Dust')).toBeNull();
  });

  it('dismisses when × is clicked', () => {
    const { getByLabelText, queryByText } = render(<WalletLegend />);
    expect(queryByText('Miner')).toBeTruthy();
    fireEvent.click(getByLabelText('Dismiss legend'));
    expect(queryByText('Miner')).toBeNull();
  });

  it('shows accurate thresholds and the received-not-balance caveat', () => {
    const { getByText } = render(<WalletLegend />);
    expect(getByText(/coinbase recipient/i)).toBeTruthy();
    expect(getByText(/1,000 BTC received/i)).toBeTruthy();
    expect(getByText(/received, not current balance/i)).toBeTruthy();
  });
});
