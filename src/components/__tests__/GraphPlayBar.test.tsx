import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { GraphPlayBar } from '../views/GraphPlayBar';
import { useTimegridStore } from '@/store/timegridStore';

beforeEach(() => {
  useTimegridStore.setState({
    currentBlock: 0,
    latestBlock: 0,
    playbackPlaying: false,
    playbackSpeedIdx: 0,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
  });
});

describe('<GraphPlayBar> halving quick-jumps', () => {
  it('renders one jump target per halving within the loaded range', () => {
    useTimegridStore.getState().setLatestBlock(840_000);
    const { getAllByRole } = render(<GraphPlayBar />);
    // halvings at 210k / 420k / 630k / 840k → 4 markers
    const jumps = getAllByRole('button', { name: /jump to halving/i });
    expect(jumps.length).toBe(4);
  });

  it('jumps currentBlock to the halving block and pauses playback on click', () => {
    useTimegridStore.getState().setLatestBlock(840_000);
    useTimegridStore.getState().setPlaybackPlaying(true);
    const { getByRole } = render(<GraphPlayBar />);
    fireEvent.click(getByRole('button', { name: /jump to halving 2/i }));
    expect(useTimegridStore.getState().currentBlock).toBe(420_000);
    expect(useTimegridStore.getState().playbackPlaying).toBe(false);
  });

  it('shows no halving jumps before the first halving block', () => {
    useTimegridStore.getState().setLatestBlock(100_000);
    const { queryAllByRole } = render(<GraphPlayBar />);
    expect(queryAllByRole('button', { name: /jump to halving/i }).length).toBe(0);
  });
});
