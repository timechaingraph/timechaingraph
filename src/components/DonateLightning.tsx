'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * DonateLightning — Lightning Address display with QR + copy.
 *
 * Shows the operator's self-hosted Lightning Address (user@domain form, LUD-16).
 * The QR encodes the bare address — modern LN wallets that support Lightning
 * Address resolve it directly on scan. For wallets that don't, the text address
 * is always visible and copyable.
 *
 * IMPORTANT: This component only renders when DONATION_LIGHTNING_ADDRESS is
 * non-empty. The address resolves via a phoenixd LNURL-pay endpoint at the
 * operator's self-hosted `lightning.timechaingraph.com` — never a custodial service.
 */
export function DonateLightning({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState('');

  useEffect(() => {
    let live = true;
    QRCode.toString(address, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((svg) => {
        if (live) setQrSvg(svg);
      })
      .catch(() => {
        // QR render failed — address text remains.
      });
    return () => {
      live = false;
    };
  }, [address]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — address is still on screen and selectable.
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {qrSvg ? (
          // eslint-disable-next-line @next/next/no-img-element -- locally generated data URL; SVG-as-img cannot execute scripts
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
            alt="QR code for the Lightning donation address"
            width={128}
            height={128}
            className="h-[128px] w-[128px] shrink-0 rounded-md border border-[color:var(--color-card-border)] bg-white p-2"
          />
        ) : (
          <div
            aria-hidden
            className="h-[128px] w-[128px] shrink-0 rounded-md border border-[color:var(--color-card-border)] bg-white p-2"
          />
        )}
        <div className="min-w-0 flex-1">
          <code className="text-mono block break-all rounded-md border border-[color:var(--color-card-border)] bg-[color:var(--color-background-light)] px-3 py-2 text-sm text-[color:var(--color-amber)]">
            {address}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-live="polite"
            className="text-mono mt-2 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-card-border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)] transition-colors hover:border-[color:var(--color-amber)]/60 hover:text-[color:var(--color-amber)]"
          >
            {copied ? '✓ Copied' : 'Copy address'}
          </button>
          <p className="text-mono mt-2 text-[11px] text-[color:var(--color-text-muted)]">
            Paste into any Lightning wallet, or scan to pay.
          </p>
        </div>
      </div>
    </div>
  );
}
