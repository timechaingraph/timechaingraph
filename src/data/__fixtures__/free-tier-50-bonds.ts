import type { WalletBond, WalletData } from '@/types/wallet';
import { FREE_TIER_50 } from './free-tier-50';

/**
 * Deterministic bond generator for the FREE_TIER_50 fixture.
 *
 * Builds a plausible bond graph for 50 wallets covering the role
 * spectrum: satoshi at the center wired to early miners, miners
 * routing to whales (mining-pool payouts), whales transacting among
 * themselves (custodial / exchange flows), significant wallets
 * sparser, dust at the edges with ~1 bond each. djb2 picks partner
 * indices deterministically so the bond set is reproducible across
 * test runs.
 *
 * Yields ~80-110 bonds — enough for visual interest in the
 * force-directed layout, sparse enough that the simulation converges
 * in <2s on a Mac with 50 nodes.
 */

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function generateBonds(wallets: WalletData[]): WalletBond[] {
  const bonds: WalletBond[] = [];
  const seen = new Set<string>();

  function addBond(from: string, to: string, sats: bigint): void {
    if (from === to) return;
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    if (seen.has(key)) return;
    seen.add(key);
    bonds.push({ fromAddress: from, toAddress: to, sats });
  }

  const satoshi = wallets.find((w) => w.role === 'satoshi');
  const miners = wallets.filter((w) => w.role === 'miner');
  const whales = wallets.filter((w) => w.role === 'whale');
  const significant = wallets.filter((w) => w.role === 'significant');
  const dust = wallets.filter((w) => w.role === 'dust');

  if (!satoshi) {
    throw new Error(
      'FREE_TIER_50 must contain a satoshi-role wallet for the bond fixture',
    );
  }

  // Satoshi → every miner: the early-coinbase-recipient lineage.
  // 50 BTC each (the original block subsidy).
  for (const miner of miners) {
    addBond(satoshi.address, miner.address, 5_000_000_000n);
  }

  // Each miner → 4 whales: mining-pool payouts. Whale partner picked
  // by hash + offset so each miner reaches a different whale subset.
  for (const miner of miners) {
    const seed = djb2(miner.address);
    for (let i = 0; i < 4; i++) {
      const whale = whales[(seed + i * 7) % whales.length];
      const sats = BigInt(2_000_000_000 + (seed % 8) * 500_000_000);
      addBond(miner.address, whale.address, sats);
    }
  }

  // Whales among themselves — custodial flow / exchange settlement.
  // Each whale connects to 3 other whales by hash-rotated offsets.
  for (let i = 0; i < whales.length; i++) {
    const seed = djb2(whales[i].address);
    for (let j = 1; j <= 3; j++) {
      const partner = whales[(i + j * 3) % whales.length];
      const sats = BigInt(1_000_000_000 + (seed % 12) * 250_000_000);
      addBond(whales[i].address, partner.address, sats);
    }
  }

  // Significant wallets connect into the network: 1 whale + 1 miner
  // + occasional sibling significant. These are exchange depositors,
  // OTC traders, mid-tier holders.
  for (const sig of significant) {
    const seed = djb2(sig.address);
    addBond(
      sig.address,
      whales[seed % whales.length].address,
      BigInt(50_000_000 + (seed % 100) * 1_000_000),
    );
    addBond(
      sig.address,
      miners[(seed + 11) % miners.length].address,
      BigInt(20_000_000 + (seed % 80) * 500_000),
    );
    if (seed % 3 === 0) {
      addBond(
        sig.address,
        significant[(seed + 17) % significant.length].address,
        10_000_000n,
      );
    }
  }

  // Dust → 1 bond each, to a random significant or miner.
  // These are barely-active wallets — the rim of the lattice.
  for (const d of dust) {
    const seed = djb2(d.address);
    const partners = [...significant, ...miners];
    addBond(
      d.address,
      partners[seed % partners.length].address,
      1_000_000n,
    );
  }

  return bonds;
}

export const FREE_TIER_50_BONDS: readonly WalletBond[] = Object.freeze(
  generateBonds([...FREE_TIER_50]),
);
