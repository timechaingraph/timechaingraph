import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { LiveTipPanel } from '../LiveTipPanel';
import { useTimegridStore } from '@/store/timegridStore';

beforeEach(() => {
  useTimegridStore.setState({
    currentBlock: 0,
    latestBlock: 0,
    selectedWallet: null,
    activeDockPanel: null,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
    liveTip: null,
  });
});

describe('<LiveTipPanel>', () => {
  it('shows the connecting state plus the current block before the first poll', () => {
    useTimegridStore.getState().setLatestBlock(876_000);
    useTimegridStore.getState().setCurrentBlock(630_000);
    const { getByText } = render(<LiveTipPanel />);
    expect(getByText(/connecting/i)).toBeTruthy();
    expect(getByText(/Current block/i)).toBeTruthy();
    expect(getByText('630,000')).toBeTruthy();
  });

  it('renders the live ticker once a tip is known', () => {
    useTimegridStore.getState().setLatestBlock(876_000);
    useTimegridStore.getState().setCurrentBlock(876_000);
    useTimegridStore.getState().setLiveTip({
      height: 953_400,
      timestamp: Math.floor(Date.now() / 1000) - 250,
    });
    const { getByText } = render(<LiveTipPanel />);
    expect(getByText(/Live tip/i)).toBeTruthy();
    expect(getByText('953,400')).toBeTruthy();
    expect(getByText(/last .* ago/i)).toBeTruthy();
    expect(getByText(/next ~|any moment/i)).toBeTruthy();
  });

  it('shows the data-freshness note when the tip outruns the bundle', () => {
    useTimegridStore.getState().setLatestBlock(876_000);
    useTimegridStore.getState().setLiveTip({ height: 999_999, timestamp: null });
    const { getByText } = render(<LiveTipPanel />);
    expect(getByText(/data through .* pending/i)).toBeTruthy();
  });
});
