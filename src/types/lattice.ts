/**
 * Lattice rendering primitives.
 *
 * Generic types and contracts used by the canvas, store, and data adapter.
 * These were once shared via @exodus/lattice-core in the Exodus monorepo;
 * inlined here so this project has no cross-repo dependency.
 */

/** A 2D coordinate in the visual (rendering) coordinate space. */
export interface GridPosition {
  x: number;
  y: number;
}

/**
 * Minimum shape every node on the lattice has. The app extends this with
 * its own domain fields (see WalletNode in src/types/wallet.ts).
 */
export interface LatticeNode {
  /** Stable identifier (Bitcoin address, in this project). */
  id: string;
  /** Visual position on the rendered lattice. */
  position: GridPosition;
}

/** A snapshot of the underlying chain's progression, surfaced in the dock UI. */
export interface LatticeStatus {
  /** Current block height the lattice is rendering. */
  currentBlock: number;
  /** Wall-clock timestamp of the most recent block, in ms since epoch. */
  lastBlockTime?: number;
  /** Cycle hint for the dock — display "next block in X seconds". */
  nextBlockEtaMs?: number;
}

/**
 * Generic data-source adapter for the lattice. The Bitcoin implementation
 * (BitcoinChainAdapter) reads parquet snapshots from our own CDN.
 * READ-only by contract; this project never writes to a chain.
 */
export interface ChainAdapter<TNode extends LatticeNode = LatticeNode> {
  /** Bulk-fetch all nodes currently visible on the lattice. */
  getNodes(): Promise<TNode[]>;
  /** Fetch the current block height + timing. */
  getStatus?(): Promise<LatticeStatus>;
}
