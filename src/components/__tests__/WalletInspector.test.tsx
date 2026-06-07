import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { WalletInspector } from '../WalletInspector';
import { useTimegridStore } from '@/store/timegridStore';
import { FREE_TIER_50 } from '@/data/__fixtures__/free-tier-50';

beforeEach(() => {
  useTimegridStore.setState({
    currentBlock: 0,
    latestBlock: 0,
    selectedWallet: null,
    activeDockPanel: null,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
  });
});

describe('<WalletInspector>', () => {
  it('shows the empty-state copy when no wallet is selected', () => {
    const { getByText } = render(<WalletInspector />);
    expect(getByText(/Hover or click a wallet/i)).toBeTruthy();
  });

  it('shows the role label when a wallet is selected', () => {
    const wallet = FREE_TIER_50.find((w) => w.role === 'whale')!;
    useTimegridStore.getState().setSelectedWallet(wallet.address);
    const { getAllByText } = render(<WalletInspector />);
    // "Whale" is the main role label (the bonds list shows sizes/dates,
    // not role text); assert ≥1 match.
    expect(getAllByText('Whale').length).toBeGreaterThanOrEqual(1);
  });

  it('lists the wallet\'s strongest bonds with sizes', () => {
    // Satoshi connects to all 5 miners in the bond fixture.
    const sat = FREE_TIER_50.find((w) => w.role === 'satoshi')!;
    useTimegridStore.getState().setSelectedWallet(sat.address);
    const { getByText, getAllByText } = render(<WalletInspector />);
    expect(getByText(/Strongest bonds \(5\)/)).toBeTruthy();
    // Each bond row renders a "<n> BTC" size; the panel also has the
    // "Total received" BTC field, so assert there are several BTC values.
    expect(getAllByText(/BTC/).length).toBeGreaterThan(1);
  });

  it('shows the satoshi-marked address as Satoshi', () => {
    const sat = FREE_TIER_50.find((w) => w.role === 'satoshi')!;
    useTimegridStore.getState().setSelectedWallet(sat.address);
    const { getByText } = render(<WalletInspector />);
    expect(getByText('Satoshi')).toBeTruthy();
    // satoshi is a coinbase recipient
    expect(getByText(/coinbase recipient/i)).toBeTruthy();
  });

  it('falls back to empty-state if selectedWallet is unknown', () => {
    useTimegridStore.getState().setSelectedWallet('1NotInTheFixture');
    const { getByText } = render(<WalletInspector />);
    expect(getByText(/Hover or click a wallet/i)).toBeTruthy();
  });
});
