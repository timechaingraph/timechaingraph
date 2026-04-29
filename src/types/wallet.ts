import type { LatticeNode } from '@/types/lattice';

/**
 * Role classification used for color encoding on both views.
 *
 *   satoshi      → brass-gold, special-cased; reserved for the genesis miner
 *   miner        → red;        every coinbase recipient ever
 *   whale        → gold;       > 1,000 BTC ever held
 *   significant  → cyan;       > 1 BTC ever held OR > 100 lifetime txs
 *   dust         → grey;       below the significance threshold
 */
export type WalletRole = 'satoshi' | 'miner' | 'whale' | 'significant' | 'dust';

/**
 * Bitcoin wallet metadata, position-free. Both Grid and Graph views consume
 * the same WalletData[] from `src/data/__fixtures__/` and from the eventual
 * BitcoinChainAdapter; each view computes its own coordinates from this
 * metadata.
 *
 *   Grid view  → position derived deterministically from address hash
 *   Graph view → position emerges from force simulation over txCount edges
 */
export interface WalletData {
  /** Bitcoin address — the visual identity, also used as node id. */
  address: string;
  /** Role classification for color encoding. */
  role: WalletRole;
  /** Block height at which this wallet first received any output. */
  firstSeenBlock: number;
  /** Block height of the wallet's most recent activity (input or output). */
  lastActiveBlock: number;
  /** Total satoshis ever received (lifetime cumulative). */
  totalReceivedSats: bigint;
  /** Lifetime count of transactions referencing this address. */
  txCount: number;
  /** True if this address has ever received a coinbase output. */
  isMiner: boolean;
}

/**
 * A wallet placed onto the lattice. Each view's placement function takes a
 * WalletData and returns a WalletNode (assigning `id` and `position` from
 * the view-specific algorithm).
 */
export interface WalletNode extends LatticeNode, WalletData {}

/**
 * Per-block activity slice. The browser fetches the slice for the current
 * scrubber position and computes node highlights from this.
 */
export interface BlockActivity {
  /** Block height. */
  height: number;
  /** Addresses that received a coinbase output in this block. */
  miners: string[];
  /** Addresses that appeared as a tx input (spending). */
  spenders: string[];
  /** Addresses that appeared as a tx output (receiving). */
  recipients: string[];
  /** Edges for transient-bond rendering (input address → output address). */
  bonds: WalletBond[];
}

/** A transient transaction-bond between two wallets, rendered as a fading edge. */
export interface WalletBond {
  fromAddress: string;
  toAddress: string;
  /** Bond size in satoshis (drives line color bucket). */
  sats: bigint;
}
