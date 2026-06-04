import { getActiveSubstrate } from '@/data/substrate';

/**
 * blockDate — resolve a block height to a wall-clock date.
 *
 * Prefers the REAL mined time from the active substrate's `blockTime()`
 * (backed by the bundle's timestamps asset). When that's unknown — the fixture
 * substrate, an old bundle without timestamps, or a height past the tip — it
 * falls back to the canonical 10-minute-average estimate from genesis, and
 * flags the result as `estimated` so the UI can mark it (e.g. a leading "~").
 *
 * Bitcoin's genesis block timestamp: 2009-01-03 18:15:05 UTC.
 */
export const GENESIS_TIMESTAMP_MS = 1_231_006_505 * 1000;
const AVG_BLOCK_TIME_MS = 10 * 60 * 1000;

/** Pure 10-minute-average estimate (no substrate lookup). */
export function estimateBlockDate(height: number): Date {
  return new Date(GENESIS_TIMESTAMP_MS + height * AVG_BLOCK_TIME_MS);
}

/** YYYY-MM-DD (UTC). */
export function formatBlockDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface BlockDate {
  date: Date;
  /** true when this is the 10-min estimate, not a real mined time. */
  estimated: boolean;
}

export function blockDate(height: number): BlockDate {
  const t = getActiveSubstrate().blockTime(height);
  if (t !== undefined) return { date: new Date(t * 1000), estimated: false };
  return { date: estimateBlockDate(height), estimated: true };
}
