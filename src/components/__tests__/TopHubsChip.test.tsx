import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TopHubsChip } from '../TopHubsChip';
import { useTimegridStore } from '@/store/timegridStore';

beforeEach(() => {
  useTimegridStore.setState({
    currentBlock: 1_000_000, // past all fixture bonds
    latestBlock: 1_000_000,
    selectedWallet: null,
    activeDockPanel: null,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
  });
});

describe('<TopHubsChip>', () => {
  it('renders nothing when latestBlock is 0 (substrate not yet loaded)', () => {
    useTimegridStore.setState({ latestBlock: 0, currentBlock: 0 });
    const { container } = render(<TopHubsChip />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the "Top hubs" header when the substrate has bonds', () => {
    const { getByText } = render(<TopHubsChip />);
    expect(getByText(/Top hubs/i)).toBeTruthy();
  });

  it('renders at most 5 hub rows', () => {
    const { getAllByRole } = render(<TopHubsChip />);
    // Each hub is a <button> inside <li>; there is also the dismiss button.
    const buttons = getAllByRole('button');
    // dismiss button + up to 5 hub buttons = at most 6 total.
    expect(buttons.length).toBeGreaterThanOrEqual(2); // at least 1 hub + dismiss
    expect(buttons.length).toBeLessThanOrEqual(6);    // dismiss + 5 hubs
  });

  it('clicking a hub sets selectedWallet in the store', () => {
    const { getAllByRole } = render(<TopHubsChip />);
    // First button is the hub at rank 1 (dismiss is the last button in render order).
    const hubButtons = getAllByRole('button').filter((b) =>
      b.getAttribute('aria-label')?.startsWith('Select hub'),
    );
    expect(hubButtons.length).toBeGreaterThan(0);
    fireEvent.click(hubButtons[0]);
    expect(useTimegridStore.getState().selectedWallet).toBeTruthy();
  });

  it('dismisses when the ✕ button is clicked', () => {
    const { getByLabelText, queryByText } = render(<TopHubsChip />);
    fireEvent.click(getByLabelText(/Dismiss top hubs/i));
    expect(queryByText(/Top hubs/i)).toBeNull();
  });

  it('shows connection count with ↔ suffix for each hub', () => {
    const { container } = render(<TopHubsChip />);
    // Each hub row renders "<n>↔" for its bond count.
    expect(container.innerHTML).toMatch(/\d+↔/);
  });
});
