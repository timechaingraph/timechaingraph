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
    const { getByText } = render(<WalletInspector />);
    expect(getByText('Whale')).toBeTruthy();
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
