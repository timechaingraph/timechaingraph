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
 * Renders FREE_TIER_50 + FREE_TIER_50_BONDS as a living lattice with
 * drag-to-pin interactivity (Obsidian-graph-engine feel). Velocity-Verlet
 * physics each tick: gravity toward origin (∝ mass), pairwise Coulomb
 * repulsion, Hooke springs on every bond. Satoshi permanent-pinned at
 * (0, 0). Other nodes follow physics until grabbed; dragged nodes pin
 * to the cursor; release un-pins and the system resettles.
 *
 * Phase-C v0.1 progress:
 *   ✓ skeleton (single dot)                          (0f0a161)
 *   ✓ render 50-wallet fixture + hover/click         (983a0b9)
 *   ✓ force simulation + bonds fixture               (20b58ab)
 *   ✓ drag-and-drop                                  (this commit)
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

      // Drag state — single drag at a time; null when idle.
      let draggedBody: Body | null = null;
      let dragOffsetX = 0;
      let dragOffsetY = 0;

      // Build bodies + node graphics
      const bodies: Body[] = FREE_TIER_50.map((wallet) => {
        const seed = seedPosition(wallet);
        const radius = ROLE_RADIUS[wallet.role];

        const dot = new Graphics();
        dot.circle(0, 0, radius).fill(ROLE_COLOR[wallet.role]);
        dot.position.set(cx + seed.x, cy + seed.y);
        dot.eventMode = 'static';
        dot.cursor = 'grab';
        dot.hitArea = {
          contains: (mx: number, my: number) => {
            const hitR = Math.max(radius, 6);
            return mx * mx + my * my <= hitR * hitR;
          },
        };

        const body: Body = {
          wallet,
          x: seed.x,
          y: seed.y,
          vx: 0,
          vy: 0,
          mass: massOf(wallet),
          pinned: wallet.role === 'satoshi',
          graphics: dot,
          halo: null,
        };

        dot.on('pointerover', () => {
          if (!draggedBody) setSelectedWallet(wallet.address);
        });
        dot.on('pointerout', () => {
          if (!draggedBody) setSelectedWallet(null);
        });
        dot.on('pointertap', () => {
          setSelectedWallet(wallet.address);
          setActiveDockPanel('wallet-inspector');
        });
        dot.on('pointerdown', (e: { global: { x: number; y: number } }) => {
          draggedBody = body;
          body.pinned = true;
          body.vx = 0;
          body.vy = 0;
          dragOffsetX = e.global.x - (cx + body.x);
          dragOffsetY = e.global.y - (cy + body.y);
          dot.cursor = 'grabbing';
          dot.alpha = 0.85;
          setSelectedWallet(wallet.address);
        });

        app.stage.addChild(dot);

        if (wallet.role === 'satoshi') {
          const halo = new Graphics();
          halo
            .circle(0, 0, ROLE_RADIUS.satoshi + 7)
            .stroke({ width: 1.4, color: ROLE_COLOR.satoshi, alpha: 0.75 });
          halo.position.set(cx + seed.x, cy + seed.y);
          app.stage.addChild(halo);
          body.halo = halo;
        }

        return body;
      });

      // Stage-level pointer handlers — the dragged body follows the cursor
      // until release. Only one drag at a time. Pointer capture covers the
      // whole canvas so the user can drag past the node's tiny hitbox.
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      app.stage.on('pointermove', (e: { global: { x: number; y: number } }) => {
        if (!draggedBody) return;
        draggedBody.x = e.global.x - dragOffsetX - cx;
        draggedBody.y = e.global.y - dragOffsetY - cy;
        draggedBody.vx = 0;
        draggedBody.vy = 0;
      });

      function endDrag(): void {
        if (!draggedBody) return;
        draggedBody.graphics.cursor = 'grab';
        draggedBody.graphics.alpha = 1;
        // Permanent anchors stay pinned; everything else returns to physics
        if (draggedBody.wallet.role !== 'satoshi') {
          draggedBody.pinned = false;
        }
        draggedBody = null;
      }

      app.stage.on('pointerup', endDrag);
      app.stage.on('pointerupoutside', endDrag);

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

        // Pairwise repulsion
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

        // Spring forces on bonds
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

        // Damping + integration + position update.
        // Pinned bodies (satoshi + the drag target) skip integration but
        // still get their graphics position resynced with their authoritative
        // x/y — necessary because the drag handler writes directly to body.x/y.
        for (const body of bodies) {
          if (!body.pinned) {
            body.vx *= PHYSICS.damping;
            body.vy *= PHYSICS.damping;
            body.x += body.vx * dt;
            body.y += body.vy * dt;
          }
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
      aria-label="Timechain Graph lattice — force-directed Obsidian-style placement of Bitcoin wallets, drag any node to pull it through the layout"
    />
  );
}
