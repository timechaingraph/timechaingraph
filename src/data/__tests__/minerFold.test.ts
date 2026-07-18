import { describe, it, expect } from 'vitest';
import { minersFolded } from '../minerFold';

// perf#2 staged flag. The runtime drops the ~9MB block-miners.parquet fetch
// ONLY when the bundle manifest proves the coinbase-miner set was folded into
// wallets.is_miner at build time. Fail-closed: anything other than an explicit
// `true` keeps the current fetch-and-override behavior (the live bundle has no
// flag, so it is untouched by this change).
describe('minersFolded (perf#2 staged flag)', () => {
  it('is true only when the manifest explicitly sets minersFolded: true', () => {
    expect(minersFolded({ minersFolded: true })).toBe(true);
  });

  it('is false when the flag is absent (pre-fold / current live bundle)', () => {
    expect(minersFolded({})).toBe(false);
  });

  it('is false when the flag is explicitly false', () => {
    expect(minersFolded({ minersFolded: false })).toBe(false);
  });

  it('treats undefined as false (never skips block-miners without proof)', () => {
    expect(minersFolded({ minersFolded: undefined })).toBe(false);
  });
});
