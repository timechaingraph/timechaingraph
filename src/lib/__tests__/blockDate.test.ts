import { describe, it, expect } from 'vitest';
import {
  estimateBlockDate,
  formatBlockDate,
  blockDate,
  GENESIS_TIMESTAMP_MS,
} from '../blockDate';

describe('blockDate', () => {
  it('estimateBlockDate(0) is the genesis timestamp', () => {
    expect(estimateBlockDate(0).getTime()).toBe(GENESIS_TIMESTAMP_MS);
  });

  it('formats genesis as 2009-01-03', () => {
    expect(formatBlockDate(estimateBlockDate(0))).toBe('2009-01-03');
  });

  it('advances exactly 10 minutes per block in the estimate', () => {
    const span = estimateBlockDate(144).getTime() - estimateBlockDate(0).getTime();
    expect(span).toBe(144 * 10 * 60 * 1000); // ~1 day at 144 blocks
  });

  it('falls back to the estimate (flagged) when the substrate has no real time', () => {
    // Default active substrate is the fixture, whose blockTime() is undefined.
    const r = blockDate(0);
    expect(r.estimated).toBe(true);
    expect(r.date.getTime()).toBe(GENESIS_TIMESTAMP_MS);
  });
});
