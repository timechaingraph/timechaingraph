'use client';

import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import { FREE_TIER_50 } from '@/data/__fixtures__/free-tier-50';
import { ROLE_COLOR, ROLE_RADIUS } from '@/lib/role-visuals';
import { useTimegridStore } from '@/store/timegridStore';
import type { WalletData, WalletRole } from '@/types/wallet';

/**
 * Concentric-ring seed positions for the force-directed layout.
 *
 * Satoshi pinned to origin (the brass-gold center, like the Obsidian
 * vault's home node). Whales hug closest, miners next, significant
 * out further, dust on the rim. The force simulation in the next
 * commit will move every non-pinned node away from this seed toward
 * its physics equilibrium — but the seed already encodes "mass" so
 * the system starts close to settled and finishes faster.
 */
const RING_RADIUS: Record<WalletRole, number> = {
  satoshi: 0,
  whale: 90,
  miner: 140,
  significant: 210,
  dust: 290,
};

const FIXTURE_LATEST_BLOCK = FREE_TIER_50.reduce(
  (max, w) => Math.max(max, w.lastActiveBlock),
  0,
);

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function seedPosition(wallet: WalletData): { x: number; y: number } {
  if (wallet.role === 'satoshi') return { x: 0, y: 0 };
  const angle = (djb2(wallet.address) / 0xffffffff) * Math.PI * 2;
  const r = RING_RADIUS[wallet.role];
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

/**
 * GraphView — force-directed Obsidian-style renderer for timechaingraph.com.
 *
 * Renders FREE_TIER_50 with role-colored nodes around a brass-gold satoshi
 * center. Hover dispatches `setSelectedWallet`; click also opens the
 * inspector dock panel. The next commit turns on the velocity-Verlet
 * physics that animates the lattice toward equilibrium; the commit after
 * that adds drag-to-pin so users can play with the layout (Obsidian
 * graph-view feel).
 *
 * Phase-C v0.1 progress:
 *   ✓ skeleton (single dot)                          (0f0a161)
 *   ✓ render 50-wallet fixture + hover/click         (this commit)
 *   · force simulation + bonds                       (next)
 *   · drag-and-drop                                  (next)
 *   · pan / zoom                                     (later)
 *   · real BitcoinChainAdapter                       (later)
 */
export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const app = new Application();
    let cancelled = false;

    const { setSelectedWallet, setActiveDockPanel, setLatestBlock, setCurrentBlock } =
      useTimegridStore.getState();

    if (useTimegridStore.getState().latestBlock === 0) {
      setLatestBlock(FIXTURE_LATEST_BLOCK);
      setCurrentBlock(FIXTURE_LATEST_BLOCK);
    }

    void (async () => {
      await app.init({
        resizeTo: container,
        background: 0x08080c,
        antialias: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      container.appendChild(app.canvas);

      const cx = app.screen.width / 2;
      const cy = app.screen.height / 2;

      // Backdrop — faint concentric guide rings (Obsidian-vault feel).
      // Each ring matches a role radius so the visual encoding self-documents.
      const backdrop = new Graphics();
      for (const r of [RING_RADIUS.whale, RING_RADIUS.miner, RING_RADIUS.significant, RING_RADIUS.dust]) {
        backdrop.circle(cx, cy, r).stroke({ width: 1, color: 0xffffff, alpha: 0.04 });
      }
      app.stage.addChild(backdrop);

      // Wallet dots
      for (const wallet of FREE_TIER_50) {
        const seed = seedPosition(wallet);
        const px = cx + seed.x;
        const py = cy + seed.y;
        const radius = ROLE_RADIUS[wallet.role];

        const dot = new Graphics();
        dot.circle(px, py, radius).fill(ROLE_COLOR[wallet.role]);

        dot.eventMode = 'static';
        dot.cursor = 'pointer';
        dot.hitArea = {
          contains: (mx: number, my: number) => {
            const dx = mx - px;
            const dy = my - py;
            const hitR = Math.max(radius, 6);
            return dx * dx + dy * dy <= hitR * hitR;
          },
        };
        dot.on('pointerover', () => setSelectedWallet(wallet.address));
        dot.on('pointerout', () => setSelectedWallet(null));
        dot.on('pointertap', () => {
          setSelectedWallet(wallet.address);
          setActiveDockPanel('wallet-inspector');
        });

        app.stage.addChild(dot);

        if (wallet.role === 'satoshi') {
          const halo = new Graphics();
          halo
            .circle(px, py, ROLE_RADIUS.satoshi + 7)
            .stroke({ width: 1.4, color: ROLE_COLOR.satoshi, alpha: 0.75 });
          app.stage.addChild(halo);
        }
      }
    })();

    return () => {
      cancelled = true;
      app.destroy(true, { children: true });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="aspect-square w-full"
      aria-label="Timechain Graph lattice — force-directed Obsidian-style placement of Bitcoin wallets, drag nodes to play with the layout"
    />
  );
}
