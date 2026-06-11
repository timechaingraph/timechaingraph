/**
 * bip21 — build `bitcoin:` payment URIs (BIP-0021) for the donate page.
 *
 * The amount param is denominated in DECIMAL BTC. We convert sats → BTC with
 * BigInt string math (never floats) so 10_000 sats is exactly "0.0001" — no
 * 9.999e-5 drift, no scientific notation, at any magnitude.
 *
 * The label is percent-encoded with encodeURIComponent. Deliberately NOT
 * URLSearchParams: it encodes spaces as '+', which some wallet URI parsers
 * take literally.
 */

/** Below this, an output is uneconomical to spend (P2WPKH dust ≈ 546 sats) —
 *  amounts under it are dropped from the URI rather than encoded. */
export const DUST_FLOOR_SATS = 546;

const SATS_PER_BTC = 100_000_000n;

/** Exact decimal-BTC string for a whole number of sats ("0.0001", "1.5"). */
export function satsToBtc(sats: number): string {
  const v = BigInt(sats);
  const whole = v / SATS_PER_BTC;
  const frac = (v % SATS_PER_BTC).toString().padStart(8, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

/**
 * `bitcoin:<address>[?amount=…][&label=…]`. Sats below the dust floor (or
 * non-integer / NaN) are ignored — the URI degrades to the bare address.
 */
export function bip21Uri(
  address: string,
  opts: { sats?: number; label?: string } = {},
): string {
  const params: string[] = [];
  if (
    opts.sats !== undefined &&
    Number.isInteger(opts.sats) &&
    opts.sats >= DUST_FLOOR_SATS
  ) {
    params.push(`amount=${satsToBtc(opts.sats)}`);
  }
  if (opts.label) params.push(`label=${encodeURIComponent(opts.label)}`);
  return params.length ? `bitcoin:${address}?${params.join('&')}` : `bitcoin:${address}`;
}
