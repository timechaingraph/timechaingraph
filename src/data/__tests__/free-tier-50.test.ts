import { describe, it, expect } from 'vitest';
import { FREE_TIER_50, filterByRole } from '../__fixtures__/free-tier-50';

describe('FREE_TIER_50 fixture', () => {
  it('has exactly 50 entries', () => {
    expect(FREE_TIER_50).toHaveLength(50);
  });

  it('has the expected role distribution', () => {
    expect(filterByRole('satoshi')).toHaveLength(1);
    expect(filterByRole('miner')).toHaveLength(5);
    expect(filterByRole('whale')).toHaveLength(10);
    expect(filterByRole('significant')).toHaveLength(25);
    expect(filterByRole('dust')).toHaveLength(9);
  });

  it('has unique addresses', () => {
    const addresses = new Set(FREE_TIER_50.map((w) => w.address));
    expect(addresses.size).toBe(50);
  });

  it('marks satoshi and miners as isMiner=true; others false', () => {
    for (const w of FREE_TIER_50) {
      const expected = w.role === 'satoshi' || w.role === 'miner';
      expect(w.isMiner).toBe(expected);
    }
  });

  it('preserves Bitcoin-address-like address shapes', () => {
    for (const w of FREE_TIER_50) {
      expect(w.address.length).toBeGreaterThanOrEqual(26);
      expect(w.address.length).toBeLessThanOrEqual(35);
      expect(w.address).toMatch(/^1[A-Za-z0-9]+$/);
    }
  });

  it('first-seen block precedes last-active block for every wallet', () => {
    for (const w of FREE_TIER_50) {
      expect(w.firstSeenBlock).toBeLessThanOrEqual(w.lastActiveBlock);
    }
  });

  it('uses bigint sats (so 21M-BTC arithmetic does not overflow)', () => {
    for (const w of FREE_TIER_50) {
      expect(typeof w.totalReceivedSats).toBe('bigint');
      expect(w.totalReceivedSats).toBeGreaterThan(0n);
    }
  });

  it('reserves the satoshi role for the genesis coinbase recipient', () => {
    const satoshis = filterByRole('satoshi');
    expect(satoshis[0]?.address).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    expect(satoshis[0]?.firstSeenBlock).toBe(0);
  });
});
