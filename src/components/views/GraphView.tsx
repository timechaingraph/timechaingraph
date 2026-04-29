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
 * miners next, significant out further, dust on the rim. Pre-birth
 * wallets stay pinned at their seed until the scrubber crosses their
 * firstSeenBlock — then they un-pin and join the simulation, the
 * lattice "grows in" as you scrub forward through history.
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

/** Edge fade window per project spec — bonds fade to alpha 0 over 10 blocks of inactivity. */
const EDGE_FADE_BLOCKS = 10;
/** Base alpha for fully-active edges (lower = sparser graph; tuned for visibility). */
const EDGE_BASE_ALPHA = 0.4;

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

type Link = { a: number; b: number; strength: number; bondLastActive: number };

/**
 * GraphView — force-directed Obsidian-style renderer for timechaingraph.com.
 *
 * Renders FREE_TIER_50 + FREE_TIER_50_BONDS as a living lattice with:
 *  - Velocity-Verlet physics (gravity + Coulomb repulsion + Hooke springs)
 *  - Drag-to-pin (Obsidian-graph-engine feel)
 *  - Scrubber-driven node visibility — pre-birth wallets alpha=0 + pinned
 *    at seed; un-pin + alpha=1 once scrubber crosses firstSeenBlock
 *  - Edge fade per spec — alpha = max(0, 1 - max(0, currentBlock -
 *    max(a.lastActive, b.lastActive)) / 10) so bonds fade out over 10
 *    blocks of bilateral inactivity
 *  - Satoshi permanent-anchored at (0, 0)
 *
 * Phase-C v0.1 progress:
 *   ✓ skeleton                                      (0f0a161)
 *   ✓ render fixture + hover/click + Inspector      (983a0b9)
 *   ✓ force simulation + bonds                      (20b58ab)
 *   ✓ drag-to-pin                                   (ce5feef)
 *   ✓ scrubber-driven fade + edge fade              (this commit)
 *   · pan / zoom                                    (next)
 *   · real BitcoinChainAdapter                      (later)
 */
export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const app = new Application();
    let cancelled = false;
    const cleanupFns: Array<() => void> = [];

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
      let currentBlock = useTimegridStore.getState().currentBlock;

      function shouldBePinned(body: Body): boolean {
        if (body === draggedBody) return true;
        if (body.wallet.role === 'satoshi') return true;
        if (body.wallet.firstSeenBlock > currentBlock) return true;
        return false;
      }

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
          pinned: false, // computed properly below
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
          // Pre-birth wallets are alpha=0; ignore drag attempts so the
          // user can't grab invisible nodes.
          if (body.wallet.firstSeenBlock > currentBlock) return;
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

        body.pinned = shouldBePinned(body);
        return body;
      });

      // Stage-level pointer handlers — the dragged body follows the cursor
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
        const body = draggedBody;
        draggedBody = null;
        body.graphics.cursor = 'grab';
        body.graphics.alpha =
          body.wallet.firstSeenBlock <= currentBlock ? 1 : 0;
        body.pinned = shouldBePinned(body);
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
        const bondLastActive = Math.max(
          bodies[a].wallet.lastActiveBlock,
          bodies[b].wallet.lastActiveBlock,
        );
        links.push({ a, b, strength, bondLastActive });
      }

      function applyScrubberState(): void {
        for (const body of bodies) {
          const born = body.wallet.firstSeenBlock <= currentBlock;
          // Skip alpha update for currently-dragged body — drag handler
          // holds it at 0.85 until release.
          if (body !== draggedBody) {
            body.graphics.alpha = born ? 1 : 0;
            if (body.halo) body.halo.alpha = born ? 0.75 : 0;
          }
          const wasPinned = body.pinned;
          body.pinned = shouldBePinned(body);
          // Just-born wallets pop in from their seed with zero velocity
          // — feels like emergence, not flying-from-genesis chaos.
          if (!body.pinned && wasPinned && body !== draggedBody) {
            body.vx = 0;
            body.vy = 0;
          }
        }
      }

      const unsubscribe = useTimegridStore.subscribe((state, prev) => {
        if (state.currentBlock !== prev.currentBlock) {
          currentBlock = state.currentBlock;
          applyScrubberState();
        }
      });

      // Apply initial state — covers the case where the store was already
      // seeded by another viewer or carries state across navigation.
      applyScrubberState();

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

        // Damping + integration + position update
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

        // Redraw edges with per-bond alpha:
        //   alpha = max(0, 1 - max(0, currentBlock - bondLastActive) / 10)
        // Multiplied by EDGE_BASE_ALPHA so even fresh bonds aren't blinding.
        // PIXI 8 commits a styled subpath per stroke() call — separate
        // strokes are needed for varying alpha, and at fixture scale (~80
        // bonds) this is well within budget.
        edges.clear();
        for (const link of links) {
          const a = bodies[link.a];
          const b = bodies[link.b];
          // Skip edges whose endpoints aren't both born
          if (a.graphics.alpha === 0 || b.graphics.alpha === 0) continue;
          const blocksAfter = Math.max(0, currentBlock - link.bondLastActive);
          const fade = Math.max(0, 1 - blocksAfter / EDGE_FADE_BLOCKS);
          const alpha = fade * EDGE_BASE_ALPHA;
          if (alpha <= 0) continue;
          edges
            .moveTo(cx + a.x, cy + a.y)
            .lineTo(cx + b.x, cy + b.y)
            .stroke({ width: 0.6, color: 0xc28840, alpha });
        }
      }

      app.ticker.add(tick);

      cleanupFns.push(unsubscribe);
    })();

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) fn();
      app.destroy(true, { children: true });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="aspect-square w-full"
      aria-label="Timechain Graph lattice — force-directed Obsidian-style placement of Bitcoin wallets, scrub the halving timeline to watch the lattice grow in, drag any node to play with the layout"
    />
  );
}
