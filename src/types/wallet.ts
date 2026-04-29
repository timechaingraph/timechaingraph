import type { LatticeNode } from '@/types/lattice';

/**
 * A Bitcoin wallet (address) as rendered on the lattice. Extends the base
 * LatticeNode contract with on-chain metadata derived from the offline
 * extraction pipeline (chain-tools/ingest).
 */
export interface WalletNode extends LatticeNode {
  /** Bitcoin address, the visual identity. */
  address: string;
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
