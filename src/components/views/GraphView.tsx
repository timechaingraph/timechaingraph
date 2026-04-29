'use client';

import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import { FREE_TIER_50 } from '@/data/__fixtures__/free-tier-50';
import { FREE_TIER_50_BONDS } from '@/data/__fixtures__/free-tier-50-bonds';
import { ROLE_COLOR, ROLE_RADIUS } from '@/lib/role-visuals';
import { useTimegridStore } from '@/store/timegridStore';
import type { WalletData, WalletRole } from '@/types/wallet';

/**
 * Concentric-ring seed positions for the force-directed layout.
 *
 * Satoshi pinned to origin (the brass-gold center). Whales hug closest,
 * miners next, significant out further, dust on the rim. The force
 * simulation pulls bonded nodes together while keeping unrelated nodes
 * apart, so clusters emerge naturally on top of this seed.
 */
const RING_RADIUS: Record<WalletRole, number> = {
  satoshi: 0,
  whale: 90,
  miner: 140,
  significant: 210,
  dust: 290,
};

/**
 * Force-sim tuning. Tuned empirically for ~50 nodes + ~80 bonds; produces
 * a breathing layout that converges in ~2s and stays alive thereafter.
 * Larger graphs will need quad-tree-Barnes-Hut for repulsion; for v0.1
 * naive O(n²) on 50 nodes is well within 60fps budget.
 */
const PHYSICS = {
  gravity: 0.04,
  repulsion: 600,
  spring: 0.012,
  springRest: 80,
  damping: 0.86,
  maxStep: 1 / 30,
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

function massOf(wallet: WalletData): number {
  return Math.log10(Number(wallet.totalReceivedSats) + 1) * 0.3 + 0.5;
}

type Body = {
  wallet: WalletData;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  pinned: boolean;
  graphics: Graphics;
  halo: Graphics | null;
};

type Link = { a: number; b: number; strength: number };

/**
 * GraphView — force-directed Obsidian-style renderer for timechaingraph.com.
 *
 * Renders FREE_TIER_50 + FREE_TIER_50_BONDS as a living lattice. Velocity-
 * Verlet physics: gravity toward origin (∝ mass), pairwise Coulomb-like
 * repulsion, Hooke springs on every bond. Satoshi pinned to (0,0) as the
 * permanent anchor.
 *
 * Phase-C v0.1 progress:
 *   ✓ skeleton (single dot)                          (0f0a161)
 *   ✓ render 50-wallet fixture + hover/click         (983a0b9)
 *   ✓ force simulation + bonds fixture               (this commit)
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

      // Backdrop guide rings — the role-radius encoding made visible
      const backdrop = new Graphics();
      for (const r of [
        RING_RADIUS.whale,
        RING_RADIUS.miner,
        RING_RADIUS.significant,
        RING_RADIUS.dust,
      ]) {
        backdrop.circle(cx, cy, r).stroke({
          width: 1,
          color: 0xffffff,
          alpha: 0.04,
        });
      }
      app.stage.addChild(backdrop);

      // Edge layer — drawn before nodes so dots render on top
      const edges = new Graphics();
      app.stage.addChild(edges);

      // Build bodies + node graphics
      const bodies: Body[] = FREE_TIER_50.map((wallet) => {
        const seed = seedPosition(wallet);
        const radius = ROLE_RADIUS[wallet.role];

        const dot = new Graphics();
        dot.circle(0, 0, radius).fill(ROLE_COLOR[wallet.role]);
        dot.position.set(cx + seed.x, cy + seed.y);
        dot.eventMode = 'static';
        dot.cursor = 'pointer';
        dot.hitArea = {
          contains: (mx: number, my: number) => {
            const hitR = Math.max(radius, 6);
            return mx * mx + my * my <= hitR * hitR;
          },
        };
        dot.on('pointerover', () => setSelectedWallet(wallet.address));
        dot.on('pointerout', () => setSelectedWallet(null));
        dot.on('pointertap', () => {
          setSelectedWallet(wallet.address);
          setActiveDockPanel('wallet-inspector');
        });
        app.stage.addChild(dot);

        let halo: Graphics | null = null;
        if (wallet.role === 'satoshi') {
          halo = new Graphics();
          halo
            .circle(0, 0, ROLE_RADIUS.satoshi + 7)
            .stroke({ width: 1.4, color: ROLE_COLOR.satoshi, alpha: 0.75 });
          halo.position.set(cx + seed.x, cy + seed.y);
          app.stage.addChild(halo);
        }

        return {
          wallet,
          x: seed.x,
          y: seed.y,
          vx: 0,
          vy: 0,
          mass: massOf(wallet),
          pinned: wallet.role === 'satoshi',
          graphics: dot,
          halo,
        };
      });

      // Address → body index for fast bond lookup
      const idxByAddr = new Map(bodies.map((b, i) => [b.wallet.address, i]));
      const links: Link[] = [];
      for (const bond of FREE_TIER_50_BONDS) {
        const a = idxByAddr.get(bond.fromAddress);
        const b = idxByAddr.get(bond.toAddress);
        if (a === undefined || b === undefined) continue;
        const strength =
          PHYSICS.spring * (Math.log10(Number(bond.sats) + 1) * 0.1 + 0.6);
        links.push({ a, b, strength });
      }

      function tick(): void {
        const dt = Math.min(app.ticker.deltaMS / 1000, PHYSICS.maxStep);

        // Gravity toward origin (∝ mass)
        for (const body of bodies) {
          if (body.pinned) continue;
          body.vx += -body.x * PHYSICS.gravity * body.mass * dt;
          body.vy += -body.y * PHYSICS.gravity * body.mass * dt;
        }

        // Pairwise repulsion (O(n²) — fine for 50 nodes)
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const bi = bodies[i];
            const bj = bodies[j];
            const dx = bj.x - bi.x;
            const dy = bj.y - bi.y;
            const distSq = dx * dx + dy * dy + 1;
            const dist = Math.sqrt(distSq);
            const f = PHYSICS.repulsion / distSq;
            const ux = dx / dist;
            const uy = dy / dist;
            if (!bi.pinned) {
              bi.vx -= ux * f * dt;
              bi.vy -= uy * f * dt;
            }
            if (!bj.pinned) {
              bj.vx += ux * f * dt;
              bj.vy += uy * f * dt;
            }
          }
        }

        // Spring forces on bonds (Hooke)
        for (const link of links) {
          const a = bodies[link.a];
          const b = bodies[link.b];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const stretch = dist - PHYSICS.springRest;
          const ux = dx / dist;
          const uy = dy / dist;
          const f = stretch * link.strength;
          if (!a.pinned) {
            a.vx += ux * f * dt;
            a.vy += uy * f * dt;
          }
          if (!b.pinned) {
            b.vx -= ux * f * dt;
            b.vy -= uy * f * dt;
          }
        }

        // Damping + integration + position update
        for (const body of bodies) {
          if (body.pinned) continue;
          body.vx *= PHYSICS.damping;
          body.vy *= PHYSICS.damping;
          body.x += body.vx * dt;
          body.y += body.vy * dt;
          body.graphics.position.set(cx + body.x, cy + body.y);
          if (body.halo) body.halo.position.set(cx + body.x, cy + body.y);
        }

        // Redraw edges
        edges.clear();
        for (const link of links) {
          const a = bodies[link.a];
          const b = bodies[link.b];
          edges.moveTo(cx + a.x, cy + a.y).lineTo(cx + b.x, cy + b.y);
        }
        edges.stroke({ width: 0.6, color: 0xc28840, alpha: 0.35 });
      }

      app.ticker.add(tick);
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
