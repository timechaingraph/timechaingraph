import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TopHubsChip } from '../TopHubsChip';
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

describe('<TopHubsChip>', () => {
  it('renders nothing when latestBlock is 0 (substrate not yet loaded)', () => {
    useTimegridStore.setState({ latestBlock: 0, currentBlock: 0 });
    const { container } = render(<TopHubsChip />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Hubs" and "Whales" tab buttons', () => {
    const { getByRole } = render(<TopHubsChip />);
    expect(getByRole('button', { name: /hubs/i })).toBeTruthy();
    expect(getByRole('button', { name: /whales/i })).toBeTruthy();
  });

  it('defaults to Hubs view — shows ↔ connection count suffix', () => {
    const { container } = render(<TopHubsChip />);
    expect(container.innerHTML).toMatch(/\d+↔/);
  });

  it('switches to Whales view on click — shows BTC suffix', () => {
    const { getByRole, container } = render(<TopHubsChip />);
    fireEvent.click(getByRole('button', { name: /whales/i }));
    expect(container.innerHTML).toMatch(/BTC/);
  });

  it('renders at most 5 rows in Hubs view', () => {
    const { getAllByRole } = render(<TopHubsChip />);
    const rankRows = getAllByRole('button').filter((b) =>
      b.getAttribute('aria-label')?.startsWith('Select rank'),
    );
    expect(rankRows.length).toBeGreaterThanOrEqual(1);
    expect(rankRows.length).toBeLessThanOrEqual(5);
  });

  it('renders at most 5 rows in Whales view', () => {
    const { getAllByRole, getByRole } = render(<TopHubsChip />);
    fireEvent.click(getByRole('button', { name: /whales/i }));
    const rankRows = getAllByRole('button').filter((b) =>
      b.getAttribute('aria-label')?.startsWith('Select rank'),
    );
    expect(rankRows.length).toBeGreaterThanOrEqual(1);
    expect(rankRows.length).toBeLessThanOrEqual(5);
  });

  it('clicking a row sets selectedWallet in the store', () => {
    const { getAllByRole } = render(<TopHubsChip />);
    const hubRows = getAllByRole('button').filter((b) =>
      b.getAttribute('aria-label')?.startsWith('Select rank'),
    );
    fireEvent.click(hubRows[0]);
    expect(useTimegridStore.getState().selectedWallet).toBeTruthy();
  });

  it('clicking a whale row sets selectedWallet in the store', () => {
    const { getAllByRole, getByRole } = render(<TopHubsChip />);
    fireEvent.click(getByRole('button', { name: /whales/i }));
    const whaleRows = getAllByRole('button').filter((b) =>
      b.getAttribute('aria-label')?.startsWith('Select rank'),
    );
    fireEvent.click(whaleRows[0]);
    expect(useTimegridStore.getState().selectedWallet).toBeTruthy();
  });

  it('dismisses when the ✕ button is clicked', () => {
    const { getByLabelText, queryByRole } = render(<TopHubsChip />);
    fireEvent.click(getByLabelText(/Dismiss scoreboard/i));
    expect(queryByRole('button', { name: /whales/i })).toBeNull();
  });
});
