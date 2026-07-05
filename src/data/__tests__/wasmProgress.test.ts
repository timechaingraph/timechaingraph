import { describe, it, expect } from 'vitest';
import { wasmLoadStage } from '../wasmProgress';

describe('wasmLoadStage', () => {
  it('formats a mid-load percentage into stage + pct', () => {
    expect(wasmLoadStage({ bytesLoaded: 42, bytesTotal: 100 })).toEqual({
      stage: 'Loading query engine — 42%…',
      pct: 42,
    });
  });

  it('rounds to the nearest percent', () => {
    expect(wasmLoadStage({ bytesLoaded: 1, bytesTotal: 3 }).pct).toBe(33);
  });

  it('guards bytesTotal === 0 (no NaN before the total is known)', () => {
    expect(wasmLoadStage({ bytesLoaded: 0, bytesTotal: 0 }).pct).toBe(0);
  });

  it('clamps a >100 report down to 100', () => {
    expect(wasmLoadStage({ bytesLoaded: 200, bytesTotal: 100 }).pct).toBe(100);
  });

  it('reports 100% when fully loaded', () => {
    expect(wasmLoadStage({ bytesLoaded: 100, bytesTotal: 100 })).toEqual({
      stage: 'Loading query engine — 100%…',
      pct: 100,
    });
  });
});
