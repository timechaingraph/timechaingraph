import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Playback } from '../Playback';
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

describe('<Playback>', () => {
  it('shows the awaiting-data label on the play button when latestBlock is 0', () => {
    const { getByText } = render(<Playback />);
    expect(getByText(/Awaiting data/i)).toBeTruthy();
  });

  it('shows Play when ready and not at tip', () => {
    useTimegridStore.setState({ currentBlock: 0, latestBlock: 876_000 });
    const { getByText } = render(<Playback />);
    expect(getByText(/▶ Play/)).toBeTruthy();
  });

  it('shows Rewind when ready and at tip', () => {
    useTimegridStore.setState({ currentBlock: 876_000, latestBlock: 876_000 });
    const { getByText } = render(<Playback />);
    expect(getByText(/↺ Rewind/)).toBeTruthy();
  });

  it('renders the four speed options as buttons', () => {
    useTimegridStore.setState({ currentBlock: 0, latestBlock: 876_000 });
    const { getByText } = render(<Playback />);
    expect(getByText('Slow')).toBeTruthy();
    expect(getByText('Normal')).toBeTruthy();
    expect(getByText('Fast')).toBeTruthy();
    expect(getByText('Max')).toBeTruthy();
  });

  it('clicking a speed button switches the active speed', () => {
    useTimegridStore.setState({ currentBlock: 0, latestBlock: 876_000 });
    const { getByText } = render(<Playback />);
    const fastButton = getByText('Fast');
    fireEvent.click(fastButton);
    expect(fastButton.getAttribute('aria-pressed')).toBe('true');
  });
});
