import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Scrubber } from '../Scrubber';
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

describe('<Scrubber>', () => {
  it('renders an awaiting-data state when latestBlock is 0', () => {
    const { getByText } = render(<Scrubber />);
    expect(getByText(/awaiting data/i)).toBeTruthy();
  });

  it('shows block + epoch when latestBlock is seeded', () => {
    useTimegridStore.getState().setLatestBlock(840_000);
    useTimegridStore.getState().setCurrentBlock(500_000);
    const { getByText } = render(<Scrubber />);
    expect(getByText(/500,000/)).toBeTruthy();
    // block 500_000 → epoch 248 (500_000 / 2016)
    expect(getByText(/epoch 248/)).toBeTruthy();
  });

  it('reports halvings crossed', () => {
    useTimegridStore.getState().setLatestBlock(900_000);
    useTimegridStore.getState().setCurrentBlock(500_000);
    const { getByText } = render(<Scrubber />);
    // 500_000 / 210_000 = 2.38 → 2 halvings crossed
    expect(getByText(/2 halvings crossed/)).toBeTruthy();
  });

  it('singularises 1 halving', () => {
    useTimegridStore.getState().setLatestBlock(900_000);
    useTimegridStore.getState().setCurrentBlock(300_000);
    const { getByText } = render(<Scrubber />);
    // 300_000 / 210_000 = 1.43 → 1 halving crossed (singular)
    expect(getByText(/1 halving crossed/)).toBeTruthy();
  });

  it('updates currentBlock when the range input changes', () => {
    useTimegridStore.getState().setLatestBlock(840_000);
    useTimegridStore.getState().setCurrentBlock(0);
    const { container } = render(<Scrubber />);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '420000' } });
    expect(useTimegridStore.getState().currentBlock).toBe(420_000);
  });
});
