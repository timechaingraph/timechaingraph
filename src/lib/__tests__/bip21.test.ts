import { describe, it, expect } from 'vitest';
import { satsToBtc, bip21Uri, DUST_FLOOR_SATS } from '../bip21';

const ADDR = 'bc1q2hhsxyuzj4e6wcjegayddjphdry02wdef9v62l';

describe('satsToBtc (exact decimal string, no float drift)', () => {
  it('converts the preset amounts', () => {
    expect(satsToBtc(10_000)).toBe('0.0001');
    expect(satsToBtc(50_000)).toBe('0.0005');
    expect(satsToBtc(100_000)).toBe('0.001');
  });

  it('handles sub-1000 sat values without scientific notation', () => {
    expect(satsToBtc(546)).toBe('0.00000546');
    expect(satsToBtc(1)).toBe('0.00000001');
  });

  it('handles whole and mixed BTC values', () => {
    expect(satsToBtc(100_000_000)).toBe('1');
    expect(satsToBtc(150_000_000)).toBe('1.5');
    expect(satsToBtc(2_100_000_000_000_000)).toBe('21000000');
  });

  it('trims trailing zeros but keeps integer part', () => {
    expect(satsToBtc(120_000_000)).toBe('1.2');
    expect(satsToBtc(100_000_001)).toBe('1.00000001');
  });
});

describe('bip21Uri', () => {
  it('bare address when no amount', () => {
    expect(bip21Uri(ADDR)).toBe(`bitcoin:${ADDR}`);
  });

  it('encodes amount as decimal BTC', () => {
    expect(bip21Uri(ADDR, { sats: 10_000 })).toBe(`bitcoin:${ADDR}?amount=0.0001`);
  });

  it('percent-encodes the label (space must NOT become +)', () => {
    expect(bip21Uri(ADDR, { sats: 50_000, label: 'Timechain Graph' })).toBe(
      `bitcoin:${ADDR}?amount=0.0005&label=Timechain%20Graph`,
    );
  });

  it('label without amount still forms a valid URI', () => {
    expect(bip21Uri(ADDR, { label: 'Timechain Graph' })).toBe(
      `bitcoin:${ADDR}?label=Timechain%20Graph`,
    );
  });

  it('ignores sats below the dust floor', () => {
    expect(bip21Uri(ADDR, { sats: DUST_FLOOR_SATS - 1 })).toBe(`bitcoin:${ADDR}`);
    expect(bip21Uri(ADDR, { sats: 0 })).toBe(`bitcoin:${ADDR}`);
  });

  it('ignores non-integer sats', () => {
    expect(bip21Uri(ADDR, { sats: 0.5 })).toBe(`bitcoin:${ADDR}`);
    expect(bip21Uri(ADDR, { sats: NaN })).toBe(`bitcoin:${ADDR}`);
  });
});
