import { describe, it, expect } from 'vitest';
import { FREE_TIER_50_BONDS } from '../__fixtures__/free-tier-50-bonds';
import { FREE_TIER_50 } from '../__fixtures__/free-tier-50';

const ALL_ADDRESSES = new Set(FREE_TIER_50.map((w) => w.address));

function bondKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

describe('FREE_TIER_50_BONDS', () => {
  it('contains a meaningful number of bonds', () => {
    expect(FREE_TIER_50_BONDS.length).toBeGreaterThan(50);
    expect(FREE_TIER_50_BONDS.length).toBeLessThan(200);
  });

  it('all endpoints reference fixture wallets', () => {
    for (const bond of FREE_TIER_50_BONDS) {
      expect(ALL_ADDRESSES.has(bond.fromAddress)).toBe(true);
      expect(ALL_ADDRESSES.has(bond.toAddress)).toBe(true);
    }
  });

  it('has no self-bonds', () => {
    for (const bond of FREE_TIER_50_BONDS) {
      expect(bond.fromAddress).not.toBe(bond.toAddress);
    }
  });

  it('has no duplicate (undirected) bonds', () => {
    const keys = new Set<string>();
    for (const bond of FREE_TIER_50_BONDS) {
      const key = bondKey(bond.fromAddress, bond.toAddress);
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });

  it('connects satoshi to every miner', () => {
    const satoshi = FREE_TIER_50.find((w) => w.role === 'satoshi');
    expect(satoshi).toBeDefined();
    const miners = FREE_TIER_50.filter((w) => w.role === 'miner');
    for (const miner of miners) {
      const wired = FREE_TIER_50_BONDS.some(
        (b) =>
          (b.fromAddress === satoshi!.address && b.toAddress === miner.address) ||
          (b.toAddress === satoshi!.address && b.fromAddress === miner.address),
      );
      expect(wired).toBe(true);
    }
  });

  it('every dust wallet has at least one bond', () => {
    const dust = FREE_TIER_50.filter((w) => w.role === 'dust');
    for (const d of dust) {
      const bonded = FREE_TIER_50_BONDS.some(
        (b) => b.fromAddress === d.address || b.toAddress === d.address,
      );
      expect(bonded).toBe(true);
    }
  });

  it('every bond has positive sats', () => {
    for (const bond of FREE_TIER_50_BONDS) {
      expect(bond.sats > 0n).toBe(true);
    }
  });

  it('is deterministic — re-importing yields identical bonds', async () => {
    const second = (await import('../__fixtures__/free-tier-50-bonds')).FREE_TIER_50_BONDS;
    expect(second.length).toBe(FREE_TIER_50_BONDS.length);
    for (let i = 0; i < second.length; i++) {
      expect(second[i].fromAddress).toBe(FREE_TIER_50_BONDS[i].fromAddress);
      expect(second[i].toAddress).toBe(FREE_TIER_50_BONDS[i].toAddress);
      expect(second[i].sats).toBe(FREE_TIER_50_BONDS[i].sats);
    }
  });

  it('is frozen (readonly)', () => {
    expect(Object.isFrozen(FREE_TIER_50_BONDS)).toBe(true);
  });
});
