import type { WalletData, WalletRole } from '@/types/wallet';

/**
 * Free-tier mock fixture — 50 wallets covering the full role spectrum.
 *
 *   1 satoshi    (brass-gold; genesis miner)
 *   5 miners     (red; coinbase recipients)
 *  10 whales     (gold; > 1,000 BTC ever held)
 *  25 significant (cyan; mid-tier holders)
 *   9 dust       (grey; just-over-threshold)
 *
 * Both Grid and Graph views consume this set; each view computes its own
 * coordinates from the metadata. Block heights span genesis (block 0) to
 * roughly the current tip (~876,000) so the scrubber has something to
 * scrub through during dev.
 *
 * Addresses past the satoshi entry are obvious mocks (`1MockX...`) — do
 * not interpret them as real wallets. The satoshi entry uses Bitcoin's
 * actual genesis coinbase recipient (public knowledge, BIP citation).
 *
 * One source of truth, both views read it. If the shape changes, the
 * sister should pull via `bash scripts/sync-sibling.sh --pull`.
 */

const SATS = 100_000_000n; // 1 BTC = 100M sats

function mockAddress(prefix: string, n: number): string {
  // Bitcoin P2PKH addresses are 26–35 chars. We pad to 34 with `X` so
  // the test set "looks like" an address without claiming to be one.
  const indexed = `${prefix}${String(n).padStart(3, '0')}`;
  const padding = 'X'.repeat(34 - indexed.length - 1);
  return `1${indexed}${padding}`;
}

function build(
  prefix: string,
  role: WalletRole,
  count: number,
  base: { btc: bigint; firstSeen: number; lastActive: number; txMin: number; txMax: number },
): WalletData[] {
  return Array.from({ length: count }, (_, i) => {
    // Spread the cohort linearly across its base range so each wallet
    // has a slightly different first-seen / activity profile.
    const t = count === 1 ? 0 : i / (count - 1);
    const txCount = Math.floor(base.txMin + (base.txMax - base.txMin) * t);
    return {
      address: mockAddress(prefix, i + 1),
      role,
      firstSeenBlock: Math.floor(base.firstSeen + (876_000 - base.firstSeen) * t * 0.05),
      lastActiveBlock: Math.floor(base.lastActive - (876_000 - base.lastActive) * t * 0.05),
      totalReceivedSats: base.btc * SATS,
      txCount,
      isMiner: role === 'miner' || role === 'satoshi',
    };
  });
}

export const FREE_TIER_50: WalletData[] = [
  // Satoshi — the well-known genesis coinbase recipient.
  {
    address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    role: 'satoshi',
    firstSeenBlock: 0,
    lastActiveBlock: 0,
    totalReceivedSats: 50n * SATS,
    txCount: 1,
    isMiner: true,
  },

  // 5 miners — early through modern pools, all still active-ish.
  ...build('MockMiner', 'miner', 5, {
    btc: 1_500n,
    firstSeen: 100,
    lastActive: 876_000,
    txMin: 8_000,
    txMax: 60_000,
  }),

  // 10 whales — Mt-Gox-era through modern cold storage, > 1,000 BTC held.
  ...build('MockWhale', 'whale', 10, {
    btc: 5_000n,
    firstSeen: 50_000,
    lastActive: 850_000,
    txMin: 200,
    txMax: 4_000,
  }),

  // 25 significant — the mid-tier; > 1 BTC OR > 100 txs.
  ...build('MockSig', 'significant', 25, {
    btc: 25n,
    firstSeen: 150_000,
    lastActive: 870_000,
    txMin: 50,
    txMax: 800,
  }),

  // 9 dust — just over the significance threshold.
  ...build('MockDust', 'dust', 9, {
    btc: 2n,
    firstSeen: 400_000,
    lastActive: 870_000,
    txMin: 5,
    txMax: 100,
  }),
];

/**
 * Quick role-filter helper for view code that needs a subset
 * (e.g., "show only miners").
 */
export function filterByRole(role: WalletRole): WalletData[] {
  return FREE_TIER_50.filter((w) => w.role === role);
}
