import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TreasuryPanel } from '../TreasuryPanel';

const BASE_STATUS = {
  generated_at: '2026-06-24T09:00:00.000Z',
  balance_sat: 4_200_000,
  balance_btc: '0.04200000',
  address_truncated: 'bc1q2hhsxy…9v62l',
  stale_after_days: 7,
};

function mockFetch(payload: object) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('<TreasuryPanel>', () => {
  it('shows loading skeleton initially', () => {
    mockFetch(BASE_STATUS);
    render(<TreasuryPanel />);
    expect(screen.getByLabelText(/loading treasury data/i)).toBeTruthy();
  });

  it('renders balance and address after successful fetch', async () => {
    mockFetch(BASE_STATUS);
    render(<TreasuryPanel />);
    await waitFor(() => screen.getByText('₿ 0.04200000'));
    expect(screen.getByText('bc1q2hhsxy…9v62l')).toBeTruthy();
    expect(screen.getByText(/last updated:/i)).toBeTruthy();
  });

  it('shows stale warning when age exceeds stale_after_days', async () => {
    // Advance clock to 10 days after generated_at (> stale_after_days=7)
    const generated = new Date('2026-06-24T09:00:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(generated + 10 * 86_400_000);
    mockFetch(BASE_STATUS);
    render(<TreasuryPanel />);
    await waitFor(() => screen.getByText(/balance may be outdated/i));
  });

  it('shows no stale warning when generated_at is fresh', async () => {
    // Pin clock to the same day as generated_at (0 days old)
    vi.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-06-24T09:00:00.000Z').getTime(),
    );
    mockFetch(BASE_STATUS);
    render(<TreasuryPanel />);
    await waitFor(() => screen.getByText('₿ 0.04200000'));
    expect(screen.queryByText(/balance may be outdated/i)).toBeNull();
  });

  it('shows runway when btc_price_usd is present', async () => {
    mockFetch({ ...BASE_STATUS, btc_price_usd: 60_000 });
    render(<TreasuryPanel />);
    await waitFor(() => screen.getByText(/runway/i));
    expect(screen.getByText(/months/i)).toBeTruthy();
  });

  it('hides runway when btc_price_usd is absent', async () => {
    mockFetch(BASE_STATUS);
    render(<TreasuryPanel />);
    await waitFor(() => screen.getByText('₿ 0.04200000'));
    expect(screen.queryByText(/runway/i)).toBeNull();
  });

  it('shows fallback when fetch returns non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    render(<TreasuryPanel />);
    await waitFor(() => screen.getByText(/treasury data unavailable/i));
    expect(screen.queryByText(/₿/)).toBeNull();
  });

  it('shows fallback when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    render(<TreasuryPanel />);
    await waitFor(() => screen.getByText(/treasury data unavailable/i));
  });
});
