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
  it('renders an awaiting-data placeholder when latestBlock is 0', () => {
    const { container } = render(<Scrubber />);
    // Compact form: empty-state is shown as em-dashes flanking the slider.
    expect(container.textContent).toMatch(/—/);
  });

  it('shows the current/latest block readout when seeded', () => {
    useTimegridStore.getState().setLatestBlock(840_000);
    useTimegridStore.getState().setCurrentBlock(500_000);
    const { getByText } = render(<Scrubber />);
    expect(getByText(/500,000/)).toBeTruthy();
    expect(getByText(/840,000/)).toBeTruthy();
  });

  it('disables the range input when not ready', () => {
    const { container } = render(<Scrubber />);
    const slider = container.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    expect(slider.disabled).toBe(true);
  });

  it('updates currentBlock when the range input changes', () => {
    useTimegridStore.getState().setLatestBlock(840_000);
    useTimegridStore.getState().setCurrentBlock(0);
    const { container } = render(<Scrubber />);
    const slider = container.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '420000' } });
    expect(useTimegridStore.getState().currentBlock).toBe(420_000);
  });

  it('pauses auto-playback on manual scrub', () => {
    useTimegridStore.getState().setLatestBlock(840_000);
    useTimegridStore.getState().setPlaybackPlaying(true);
    const { container } = render(<Scrubber />);
    const slider = container.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '100000' } });
    expect(useTimegridStore.getState().playbackPlaying).toBe(false);
  });
});
