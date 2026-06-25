import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

describe('<WalletInspector> address card', () => {
  it('shows a copy-address button when a wallet is selected', () => {
    const wallet = FREE_TIER_50.find((w) => w.role === 'whale')!;
    useTimegridStore.getState().setSelectedWallet(wallet.address);
    const { getByLabelText } = render(<WalletInspector />);
    expect(getByLabelText(/Copy address/i)).toBeTruthy();
  });

  it('clicking copy button does not throw (clipboard may be unavailable in test env)', () => {
    // Clipboard is typically undefined in jsdom; the button must not throw.
    const wallet = FREE_TIER_50.find((w) => w.role === 'whale')!;
    useTimegridStore.getState().setSelectedWallet(wallet.address);
    const { getByLabelText } = render(<WalletInspector />);
    expect(() => fireEvent.click(getByLabelText(/Copy address/i))).not.toThrow();
  });

  it('shows a YYYY-MM-DD date for firstSeenBlock', () => {
    const wallet = FREE_TIER_50.find((w) => w.role === 'whale')!;
    useTimegridStore.getState().setSelectedWallet(wallet.address);
    const { container } = render(<WalletInspector />);
    // formatBlockDate returns YYYY-MM-DD; at least one field should match.
    expect(container.innerHTML).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('shows the raw block number as sub-field for first seen', () => {
    const wallet = FREE_TIER_50.find((w) => w.role === 'satoshi')!;
    useTimegridStore.getState().setSelectedWallet(wallet.address);
    const { container } = render(<WalletInspector />);
    // Block number appears as "block N" in the sub-field.
    expect(container.innerHTML).toMatch(/block \d/);
  });
});

describe('<WalletInspector> URL sync', () => {
  it('calls history.replaceState with ?wallet= when a wallet is selected', () => {
    const spy = vi.spyOn(window.history, 'replaceState');
    const wallet = FREE_TIER_50.find((w) => w.role === 'whale')!;
    useTimegridStore.getState().setSelectedWallet(wallet.address);
    render(<WalletInspector />);
    expect(spy).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining(`wallet=${wallet.address}`),
    );
    spy.mockRestore();
  });
});

describe('<WalletInspector> minimize', () => {
  it('collapses to a chip via the X and restores on click', () => {
    const { getByLabelText, getByText, queryByText } = render(<WalletInspector />);
    expect(getByText(/Hover or click a wallet/i)).toBeTruthy();
    fireEvent.click(getByLabelText(/Minimize inspector/i));
    expect(queryByText(/Hover or click a wallet/i)).toBeNull();
    fireEvent.click(getByLabelText(/Restore inspector/i));
    expect(getByText(/Hover or click a wallet/i)).toBeTruthy();
  });
});
