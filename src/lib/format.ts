/**
 * Format a number in scientific notation for large/small values,
 * or as a compact decimal for mid-range values.
 * Cuts off after 4 decimal places (0.0000).
 *
 *   1234567   → "1.2345e6"
 *   0.00034   → "3.4000e-4"
 *   42.7      → "42.7000"
 *   0         → "0.0000"
 */
export function sciFormat(n: number): string {
  if (n === 0) return '0.0000';

  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1e6 || (abs > 0 && abs < 0.01)) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = abs / Math.pow(10, exp);
    return `${sign}${mantissa.toFixed(4)}e${exp}`;
  }

  return `${sign}${abs.toFixed(4)}`;
}

/**
 * Short scientific format for rate displays (+X/t).
 * Uses 2 decimal places to keep it compact.
 */
export function sciRate(n: number): string {
  if (n === 0) return '0.00';

  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '+';

  if (abs >= 1e6 || (abs > 0 && abs < 0.01)) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = abs / Math.pow(10, exp);
    return `${sign}${mantissa.toFixed(2)}e${exp}`;
  }

  return `${sign}${abs.toFixed(2)}`;
}
