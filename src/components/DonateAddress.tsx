'use client';

import { useState } from 'react';

/**
 * DonateAddress — the live on-chain block: QR + address + copy button.
 *
 * Client component (the donate page itself stays server-rendered) so the
 * long bech32 address is one tap to copy instead of a fiddly manual select.
 * Clipboard can throw in an insecure context; the address stays visible and
 * selectable, so a failed copy degrades gracefully (button just doesn't flip
 * to "Copied").
 */
export function DonateAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context / permission denied) — the
      // address is still on screen and selectable; nothing to surface.
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element -- static pre-generated QR SVG; no image optimization needed on a static export */}
      <img
        src="/donate-btc-qr.svg"
        alt="QR code for the on-chain Bitcoin donation address"
        width={128}
        height={128}
        className="shrink-0 rounded-md border border-[color:var(--color-card-border)] bg-white p-2"
      />
      <div className="min-w-0 flex-1">
        <code className="text-mono block break-all rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-3 py-2 text-sm text-[color:var(--color-gold)]">
          {address}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className="text-mono mt-2 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-card-border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:var(--color-gold)]/60 hover:text-[color:var(--color-gold)]"
        >
          {copied ? '✓ Copied' : 'Copy address'}
        </button>
      </div>
    </div>
  );
}
