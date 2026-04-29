/**
 * Subset of Bitcoin block metadata surfaced in the dock UI. Populated from
 * the offline extraction pipeline (chain-tools/ingest), not from a live RPC
 * call — privacy posture forbids per-block external requests.
 */
export interface BitcoinBlock {
  height: number;
  hash: string;
  /** Unix timestamp (seconds) per Bitcoin Core convention. */
  time: number;
  txCount: number;
  /** Total fees collected by miner, in satoshis. */
  feeSats: bigint;
  /** Coinbase recipient address (the miner that mined this block). */
  minerAddress: string;
  /** Difficulty epoch index this block belongs to (height / 2016). */
  epoch: number;
}

/** True at heights {210000, 420000, 630000, 840000, ...} */
export function isHalvingBlock(height: number): boolean {
  return height > 0 && height % 210_000 === 0;
}

export function epochFromHeight(height: number): number {
  return Math.floor(height / 2016);
}

export function isFirstBlockOfEpoch(height: number): boolean {
  return height % 2016 === 0;
}
