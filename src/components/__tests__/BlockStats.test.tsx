import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BlockStats } from '../BlockStats';
import { useTimegridStore } from '@/store/timegridStore';

beforeEach(() => {
  useTimegridStore.setState({
    currentBlock: 0,
    latestBlock: 0,
    selectedWallet: null,
    activeDockPanel: null,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
  });
});

describe('<BlockStats>', () => {
  it('shows the awaiting-data state when latestBlock is 0', () => {
    const { getByText } = render(<BlockStats />);
    expect(getByText(/Awaiting data/i)).toBeTruthy();
  });

  it('displays current block height when seeded', () => {
    useTimegridStore.getState().setLatestBlock(876_000);
    useTimegridStore.getState().setCurrentBlock(630_000);
    const { getByText } = render(<BlockStats />);
    expect(getByText('630,000')).toBeTruthy();
  });

  it('reports the halving epoch and halvings crossed', () => {
    useTimegridStore.getState().setLatestBlock(876_000);
    useTimegridStore.getState().setCurrentBlock(630_000);
    const { getByText } = render(<BlockStats />);
    // 630_000 / 2016 = epoch 312
    expect(getByText(/epoch 312/)).toBeTruthy();
    // 630_000 / 210_000 = 3 halvings crossed
    expect(getByText(/3 halvings crossed/)).toBeTruthy();
  });

  it('singularises 1 halving', () => {
    useTimegridStore.getState().setLatestBlock(876_000);
    useTimegridStore.getState().setCurrentBlock(300_000);
    const { getByText } = render(<BlockStats />);
    expect(getByText(/1 halving crossed/)).toBeTruthy();
  });

  it('badges halving blocks (210k multiples)', () => {
    useTimegridStore.getState().setLatestBlock(876_000);
    useTimegridStore.getState().setCurrentBlock(420_000);
    const { getByText } = render(<BlockStats />);
    expect(getByText(/^halving$/i)).toBeTruthy();
  });

  it('does not badge non-halving blocks', () => {
    useTimegridStore.getState().setLatestBlock(876_000);
    useTimegridStore.getState().setCurrentBlock(420_001);
    const { queryByText } = render(<BlockStats />);
    expect(queryByText(/^halving$/i)).toBeNull();
  });

  it('estimates a sensible date for known halving heights', () => {
    useTimegridStore.getState().setLatestBlock(876_000);
    useTimegridStore.getState().setCurrentBlock(210_000);
    const { getByText } = render(<BlockStats />);
    // Block 210_000 was actually mined 2012-11-28; our naive
    // 10-min-from-genesis extrapolation is slightly slow vs reality
    // (early Bitcoin averaged < 10 min/block) so the estimate lands
    // in early 2013. Either is "sensible" — assert it's at least in
    // the right neighbourhood.
    expect(getByText(/201[23]-/)).toBeTruthy();
  });
});
