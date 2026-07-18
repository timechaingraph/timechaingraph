import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { WalletDirectory } from '../WalletDirectory';
import { useTimegridStore } from '@/store/timegridStore';

beforeEach(() => {
  useTimegridStore.setState({
    currentBlock: 1_000_000,
    latestBlock: 1_000_000,
    selectedWallet: null,
    activeDockPanel: null,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
  });
});

describe('<WalletDirectory>', () => {
  it('renders nothing before the substrate loads (latestBlock 0)', () => {
    useTimegridStore.setState({ latestBlock: 0, currentBlock: 0 });
    const { container } = render(<WalletDirectory />);
    expect(container.firstChild).toBeNull();
  });

  it('exposes a navigation landmark (the keyboard/SR wallet entry)', () => {
    const { getByRole } = render(<WalletDirectory />);
    expect(getByRole('navigation', { name: /wallet directory/i })).toBeTruthy();
  });

  it('renders a focusable button per wallet, each with an accessible name', () => {
    const { getAllByRole } = render(<WalletDirectory />);
    const buttons = getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b.getAttribute('aria-label')).toMatch(/^Wallet \d+ of \d+: /);
    }
  });

  it('selects the wallet when its entry is activated (keyboard/SR reachable)', () => {
    const { getAllByRole } = render(<WalletDirectory />);
    fireEvent.click(getAllByRole('button')[0]);
    expect(useTimegridStore.getState().selectedWallet).toBeTruthy();
  });
});
