import { describe, it, expect } from 'vitest';
import { FIXTURE_SUBSTRATE } from '../substrate';
import { FREE_TIER_50 } from '../__fixtures__/free-tier-50';
import { FREE_TIER_50_BONDS } from '../__fixtures__/free-tier-50-bonds';
import { COIN_ROSTER_DEMO } from '../__fixtures__/coin-roster';

describe('FIXTURE_SUBSTRATE', () => {
  it('exposes wallets/bonds/coins matching the fixture totals', () => {
    expect(FIXTURE_SUBSTRATE.wallets.length).toBe(FREE_TIER_50.length);
    expect(FIXTURE_SUBSTRATE.bonds.length).toBe(FREE_TIER_50_BONDS.length);
    expect(FIXTURE_SUBSTRATE.coins.length).toBe(COIN_ROSTER_DEMO.length);
  });

  it('exposes a tipBlock derived from max lastActiveBlock', () => {
    const expected = FREE_TIER_50.reduce(
      (m, w) => Math.max(m, w.lastActiveBlock),
      0,
    );
    expect(FIXTURE_SUBSTRATE.tipBlock).toBe(expected);
    expect(FIXTURE_SUBSTRATE.tipBlock).toBeGreaterThan(0);
  });

  it('walletByAddress hits known addresses', () => {
    const satoshi = FIXTURE_SUBSTRATE.walletByAddress(
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    );
    expect(satoshi).toBeDefined();
    expect(satoshi?.role).toBe('satoshi');
  });

  it('walletByAddress returns undefined for an unknown address', () => {
    expect(FIXTURE_SUBSTRATE.walletByAddress('1NotInFixture')).toBeUndefined();
  });

  it('bondsForAddress returns all bonds touching the address', () => {
    const satoshiBonds = FIXTURE_SUBSTRATE.bondsForAddress(
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    );
    // Per the bond fixture, satoshi connects to all 5 miners.
    expect(satoshiBonds.length).toBe(5);
    for (const bond of satoshiBonds) {
      expect(
        bond.fromAddress === '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' ||
          bond.toAddress === '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      ).toBe(true);
    }
  });

  it('bondsForAddress returns empty array for an unknown address', () => {
    expect(FIXTURE_SUBSTRATE.bondsForAddress('1NotInFixture').length).toBe(0);
  });

  it('coinsOwnedBy returns coins for a known minter', () => {
    const satoshiCoins = FIXTURE_SUBSTRATE.coinsOwnedBy(
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    );
    // v0 invariant: owner === minter; satoshi minted block 0's
    // coinbase outputs (50 coins).
    expect(satoshiCoins.length).toBeGreaterThan(0);
    for (const coin of satoshiCoins) {
      expect(coin.ownerAddress).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    }
  });

  it('coinsOwnedBy returns empty array for an unknown address', () => {
    expect(FIXTURE_SUBSTRATE.coinsOwnedBy('1NotInFixture').length).toBe(0);
  });

  it('aggregated bond count is twice the bond fixture (each bond appears under both endpoints)', () => {
    let total = 0;
    for (const wallet of FREE_TIER_50) {
      total += FIXTURE_SUBSTRATE.bondsForAddress(wallet.address).length;
    }
    expect(total).toBe(FREE_TIER_50_BONDS.length * 2);
  });
});
