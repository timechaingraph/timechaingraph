// chain-tools/lib/combiner.mjs
//
// Bounded in-memory WINDOW aggregation for the scalable walker — the "combiner"
// half of the map-reduce. Accumulates wallet + bond partials for a block window;
// the caller flushes the maps to disk and resets per window. Pure aggregation
// (no I/O), extracted from walk_chain_scalable.mjs verbatim so it's unit-testable
// and the walker can't drift from what the tests cover.
//
//   walletAgg: address -> { f:firstSeen, l:lastActive, r:receivedSats(BigInt), c:txCount, m:isMiner }
//   bondAgg:   "a|b"   -> { x:from, y:to, s:sats(BigInt), f:formationBlock }   (x<y canonical)
//
// Semantics (must match the original monolithic walker exactly):
//   - Each OUTPUT adds received sats + 1 txCount to its wallet, and sets the
//     miner flag when the tx is coinbase.
//   - Each INPUT only "touches" its wallet (first/last-seen), no received/txCount.
//   - Bonds are input→output money-flow edges. Full bipartite while
//     inputs×outputs ≤ bondPairCap; above it, a consolidation-STAR fallback
//     (every input → the single largest output) keeps a giant tx O(in) instead
//     of O(in×out), so one pathological tx can't blow the window.

import { extractAddresses, bondKey } from './extract.mjs';

export function createCombiner({ bondPairCap = 10_000 } = {}) {
  let walletAgg = new Map();
  let bondAgg = new Map();

  function touchWallet(address, h) {
    let w = walletAgg.get(address);
    if (!w) {
      w = { f: h, l: h, r: 0n, c: 0, m: false };
      walletAgg.set(address, w);
    } else {
      if (h < w.f) w.f = h;
      if (h > w.l) w.l = h;
    }
    return w;
  }

  function addBond(a, b, sats, h) {
    if (a === b) return;
    const key = bondKey(a, b);
    let bond = bondAgg.get(key);
    if (!bond) {
      const x = a < b ? a : b;
      const y = a < b ? b : a;
      bond = { x, y, s: 0n, f: h };
      bondAgg.set(key, bond);
    }
    bond.s += BigInt(sats);
    if (h < bond.f) bond.f = h;
  }

  function processBlock(h, txs) {
    for (const tx of txs) {
      const { outputs, inputs, isCoinbase } = extractAddresses(tx);

      // Outputs: received sats + txCount + miner flag (coinbase recipients).
      for (const out of outputs) {
        const w = touchWallet(out.address, h);
        w.r += BigInt(out.sats);
        w.c += 1;
        if (isCoinbase) w.m = true;
      }

      if (isCoinbase) continue; // coinbase has no real inputs → no bonds

      // Inputs: spenders. Touch (first/last seen) but no received/txCount.
      for (const inp of inputs) touchWallet(inp.address, h);

      // Bonds: input→output money-flow edges (capped; star fallback above cap).
      if (inputs.length === 0 || outputs.length === 0) continue;
      if (inputs.length * outputs.length <= bondPairCap) {
        for (const inp of inputs) {
          for (const out of outputs) addBond(inp.address, out.address, out.sats, h);
        }
      } else {
        let largest = outputs[0];
        for (const out of outputs) if (out.sats > largest.sats) largest = out;
        for (const inp of inputs) addBond(inp.address, largest.address, largest.sats, h);
      }
    }
  }

  return {
    processBlock,
    get walletCount() {
      return walletAgg.size;
    },
    get bondCount() {
      return bondAgg.size;
    },
    /** Combined entry count — the memory-pressure flush trigger. */
    get size() {
      return walletAgg.size + bondAgg.size;
    },
    /** Live Map<address, partial> — the caller iterates it to flush. */
    get wallets() {
      return walletAgg;
    },
    /** Live Map<key, partial> — the caller iterates .values() to flush. */
    get bonds() {
      return bondAgg;
    },
    /** Clear both maps after a flush (new window). */
    reset() {
      walletAgg = new Map();
      bondAgg = new Map();
    },
  };
}
