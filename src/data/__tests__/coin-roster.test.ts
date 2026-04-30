import { describe, it, expect } from 'vitest';
import {
  COIN_ROSTER_DEMO,
  DEMO_BLOCK_COUNT,
  mintCoinsFromGenesis,
} from '../__fixtures__/coin-roster';

describe('mintCoinsFromGenesis', () => {
  it('returns an empty roster for negative maxBlock', () => {
    expect(mintCoinsFromGenesis(-1)).toEqual([]);
  });

  it('mints exactly 50 coins for the genesis block alone', () => {
    const roster = mintCoinsFromGenesis(0);
    expect(roster).toHaveLength(50);
    for (const coin of roster) {
      expect(coin.mintedAtBlock).toBe(0);
    }
  });

  it('assigns the first 50 coins to Satoshi at block 0', () => {
    const roster = mintCoinsFromGenesis(0);
    for (const coin of roster) {
      expect(coin.minterAddress).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
      expect(coin.ownerAddress).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    }
  });

  it('places the genesis-coin-zero at the spiral origin', () => {
    const roster = mintCoinsFromGenesis(0);
    expect(roster[0].spiralIndex).toBe(0);
    expect(roster[0].gridX).toBe(0);
    expect(roster[0].gridY).toBe(0);
    expect(roster[0].id).toBe('B0I0');
  });

  it('produces 50 × (maxBlock+1) coins inside the first epoch', () => {
    expect(mintCoinsFromGenesis(9)).toHaveLength(50 * 10);
    expect(mintCoinsFromGenesis(99)).toHaveLength(50 * 100);
  });

  it('attributes the genesis era to Satoshi (Patoshi heartland)', () => {
    // Per the user's "covering origin is satoshi coins" directive
    // 2026-04-30, the fixture mirrors real Bitcoin lore: Satoshi
    // mines the first 750 blocks (matches the canonical Patoshi
    // cluster). Sample a handful inside that era to verify they're
    // all Satoshi-minted.
    const roster = mintCoinsFromGenesis(5);
    for (let block = 0; block <= 5; block += 1) {
      const minters = roster
        .filter((c) => c.mintedAtBlock === block)
        .map((c) => c.minterAddress);
      expect(new Set(minters).size).toBe(1);
      expect(minters[0]).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    }
  });

  it('rotates mock miners deterministically once past the Satoshi era', () => {
    // Past block 749 the rotating mock-miner cohort takes over.
    const roster = mintCoinsFromGenesis(800);
    const block750Minters = roster
      .filter((c) => c.mintedAtBlock === 750)
      .map((c) => c.minterAddress);
    expect(new Set(block750Minters).size).toBe(1);
    expect(block750Minters[0]).not.toBe(
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    );
  });

  it('flags halving blocks correctly', () => {
    // First 100 blocks have no halvings (genesis is not a halving).
    const roster = mintCoinsFromGenesis(99);
    expect(roster.every((c) => c.isHalving === false)).toBe(true);
  });

  it('produces stable IDs and unique grid positions', () => {
    const roster = mintCoinsFromGenesis(99);
    const ids = new Set(roster.map((c) => c.id));
    const positions = new Set(roster.map((c) => `${c.gridX},${c.gridY}`));
    expect(ids.size).toBe(roster.length);
    expect(positions.size).toBe(roster.length);
  });
});

describe('COIN_ROSTER_DEMO', () => {
  it('is the first DEMO_BLOCK_COUNT blocks of the issuance schedule', () => {
    expect(COIN_ROSTER_DEMO).toHaveLength(50 * DEMO_BLOCK_COUNT);
  });

  it('starts with Satoshi at the origin', () => {
    expect(COIN_ROSTER_DEMO[0].id).toBe('B0I0');
    expect(COIN_ROSTER_DEMO[0].gridX).toBe(0);
    expect(COIN_ROSTER_DEMO[0].gridY).toBe(0);
    expect(COIN_ROSTER_DEMO[0].minterAddress).toBe(
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    );
  });
});
