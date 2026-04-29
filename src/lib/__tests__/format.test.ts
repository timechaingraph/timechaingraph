import { describe, it, expect } from 'vitest';
import { sciFormat, sciRate } from '../format';

describe('sciFormat', () => {
  it('returns "0.0000" for zero', () => {
    expect(sciFormat(0)).toBe('0.0000');
  });

  it('uses fixed-4 notation for mid-range values', () => {
    expect(sciFormat(42.7)).toBe('42.7000');
    expect(sciFormat(1)).toBe('1.0000');
    expect(sciFormat(0.01)).toBe('0.0100');
    expect(sciFormat(999999)).toBe('999999.0000');
  });

  it('uses scientific notation for values >= 1e6', () => {
    expect(sciFormat(1_500_000)).toBe('1.5000e6');
    expect(sciFormat(1_000_000)).toBe('1.0000e6');
    expect(sciFormat(1.5e9)).toBe('1.5000e9');
  });

  it('uses scientific notation for values < 0.01', () => {
    expect(sciFormat(0.005)).toBe('5.0000e-3');
    expect(sciFormat(0.0001)).toBe('1.0000e-4');
    expect(sciFormat(3.4e-7)).toBe('3.4000e-7');
  });

  it('preserves sign for negative values', () => {
    expect(sciFormat(-42.7)).toBe('-42.7000');
    expect(sciFormat(-1_500_000)).toBe('-1.5000e6');
    expect(sciFormat(-0.005)).toBe('-5.0000e-3');
  });
});

describe('sciRate', () => {
  it('returns "0.00" for zero (no sign)', () => {
    expect(sciRate(0)).toBe('0.00');
  });

  it('prefixes positive values with "+"', () => {
    expect(sciRate(0.5)).toBe('+0.50');
    expect(sciRate(42.7)).toBe('+42.70');
    expect(sciRate(1_500_000)).toBe('+1.50e6');
  });

  it('prefixes negative values with "-"', () => {
    expect(sciRate(-0.5)).toBe('-0.50');
    expect(sciRate(-42.7)).toBe('-42.70');
    expect(sciRate(-1_500_000)).toBe('-1.50e6');
  });

  it('uses scientific notation at the same thresholds as sciFormat', () => {
    expect(sciRate(0.005)).toBe('+5.00e-3');
    expect(sciRate(1_000_000)).toBe('+1.00e6');
  });
});
