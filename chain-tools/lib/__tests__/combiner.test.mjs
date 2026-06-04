import { describe, it, expect } from 'vitest';
import { createCombiner } from '../combiner.mjs';
import { bondKey } from '../extract.mjs';

// Build a mempool-shape tx from [address, sats] tuples.
function tx({ ins = [], outs = [], coinbase = false } = {}) {
  return {
    vin: coinbase
      ? [{ is_coinbase: true }]
      : ins.map(([address, value]) => ({ prevout: { scriptpubkey_address: address, value } })),
    vout: outs.map(([address, value]) => ({ scriptpubkey_address: address, value })),
  };
}

describe('combiner — wallet aggregation', () => {
  it('outputs add received sats + txCount; inputs only touch first/last seen', () => {
    const c = createCombiner();
    c.processBlock(5, [tx({ ins: [['A', 1000]], outs: [['B', 600], ['C', 400]] })]);
    expect(c.walletCount).toBe(3);

    const B = c.wallets.get('B');
    expect(B.r).toBe(600n);
    expect(B.c).toBe(1);
    expect(B.f).toBe(5);
    expect(B.l).toBe(5);

    const A = c.wallets.get('A'); // input → touch only
    expect(A.r).toBe(0n);
    expect(A.c).toBe(0);
    expect(A.f).toBe(5);
  });

  it('marks coinbase recipients as miners and forms no bonds', () => {
    const c = createCombiner();
    c.processBlock(0, [tx({ outs: [['M', 5_000_000_000]], coinbase: true })]);
    const M = c.wallets.get('M');
    expect(M.m).toBe(true);
    expect(M.r).toBe(5_000_000_000n);
    expect(M.c).toBe(1);
    expect(c.bondCount).toBe(0);
  });

  it('merges a wallet across blocks: min(firstSeen), max(lastActive), summed received/txCount', () => {
    const c = createCombiner();
    c.processBlock(10, [tx({ ins: [['X', 1]], outs: [['W', 100]] })]);
    c.processBlock(20, [tx({ ins: [['Y', 1]], outs: [['W', 50]] })]);
    const W = c.wallets.get('W');
    expect(W.r).toBe(150n);
    expect(W.c).toBe(2);
    expect(W.f).toBe(10);
    expect(W.l).toBe(20);
  });
});

describe('combiner — bonds', () => {
  it('forms the full input×output bipartite under the cap; sums sats; min formation; canonical key', () => {
    const c = createCombiner({ bondPairCap: 100 });
    // A→B in block 10 (B out=30), then reverse pair B→A in block 5 (A out=20).
    c.processBlock(10, [tx({ ins: [['A', 100]], outs: [['B', 30]] })]);
    c.processBlock(5, [tx({ ins: [['B', 100]], outs: [['A', 20]] })]);
    expect(c.bondCount).toBe(1); // same canonical pair
    const bond = c.bonds.get('A|B');
    expect(bond.s).toBe(50n); // 30 + 20
    expect(bond.f).toBe(5); // min(10, 5)
    expect(bond.x).toBe('A'); // x < y canonical
    expect(bond.y).toBe('B');
  });

  it('forms a 2×2 bipartite = 4 bonds under the cap', () => {
    const c = createCombiner({ bondPairCap: 100 });
    c.processBlock(7, [tx({ ins: [['I1', 10], ['I2', 10]], outs: [['O1', 5], ['O2', 5]] })]);
    expect(c.bondCount).toBe(4);
  });

  it('falls back to a consolidation-STAR above the cap (inputs → single largest output)', () => {
    const c = createCombiner({ bondPairCap: 4 });
    // 3×3 = 9 > 4 → star to the largest output (O2 = 50).
    c.processBlock(7, [
      tx({ ins: [['I1', 10], ['I2', 10], ['I3', 10]], outs: [['O1', 5], ['O2', 50], ['O3', 5]] }),
    ]);
    expect(c.bondCount).toBe(3); // 3 inputs → 1 output, not 9
    expect(c.bonds.has(bondKey('I1', 'O2'))).toBe(true);
    expect(c.bonds.has(bondKey('I1', 'O1'))).toBe(false); // not bipartite
    expect(c.bonds.get(bondKey('I1', 'O2')).s).toBe(50n); // largest output's sats
  });

  it('skips self-bonds (change back to a spending address)', () => {
    const c = createCombiner();
    c.processBlock(7, [tx({ ins: [['A', 100]], outs: [['A', 50], ['B', 40]] })]);
    expect(c.bondCount).toBe(1); // only A↔B, not A↔A
    expect(c.bonds.has(bondKey('A', 'B'))).toBe(true);
  });
});

describe('combiner — lifecycle', () => {
  it('size = walletCount + bondCount, and reset() clears both maps', () => {
    const c = createCombiner();
    c.processBlock(1, [tx({ ins: [['A', 1]], outs: [['B', 1]] })]);
    expect(c.size).toBe(c.walletCount + c.bondCount);
    expect(c.size).toBeGreaterThan(0);
    c.reset();
    expect(c.walletCount).toBe(0);
    expect(c.bondCount).toBe(0);
    expect(c.size).toBe(0);
  });
});
