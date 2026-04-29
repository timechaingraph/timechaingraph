'use client';

import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics } from 'pixi.js';
import { FREE_TIER_50 } from '@/data/__fixtures__/free-tier-50';
import { FREE_TIER_50_BONDS } from '@/data/__fixtures__/free-tier-50-bonds';
import { ROLE_COLOR, ROLE_RADIUS } from '@/lib/role-visuals';
import { useTimegridStore } from '@/store/timegridStore';
import { BRAND_TAGLINE } from '@/lib/site-config';
import type { WalletData, WalletRole } from '@/types/wallet';

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

/** Edge fade per project spec — bonds fade to alpha 0 over 10 blocks of inactivity. */
const EDGE_FADE_BLOCKS = 10;
const EDGE_BASE_ALPHA = 0.4;

/** Hover-spotlight multiplier for non-neighbors (Obsidian-graph signature). */
const SPOTLIGHT_DIM = 0.15;

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.0015;

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
 * The full Obsidian-graph-engine experience:
 *   - Velocity-Verlet physics (gravity + Coulomb repulsion + Hooke springs)
 *   - Drag-to-pin per node (the "game feel")
 *   - Pan empty space, scroll to zoom
 *   - Scrubber-driven node fade (alpha=0 + pinned for pre-birth) and
 *     edge fade per spec (alpha decays 10 blocks past last activity)
 *   - Satoshi permanent-anchored at world origin
 *
 * Phase-C v0.1 progress:
 *   ✓ skeleton                                      (0f0a161)
 *   ✓ render fixture + hover/click + Inspector      (983a0b9)
 *   ✓ force simulation + bonds                      (20b58ab)
 *   ✓ drag-to-pin                                   (ce5feef)
 *   ✓ scrubber fade + edge fade                     (d9102f0)
 *   ✓ pan + zoom viewport                           (this commit)
 *   · real BitcoinChainAdapter                      (later)
 */
export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentBlock = useTimegridStore((s) => s.currentBlock);
  // Mirrored from the imperative `focusedAddress` closure inside the
  // PIXI effect — used only by the HUD render path (conditional ESC
  // hint). The graphics pipeline never reads React state.
  const [focusActive, setFocusActive] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const app = new Application();
    let cancelled = false;
    const cleanupFns: Array<() => void> = [];
    const viewport = new Container();

    const {
      setSelectedWallet,
      setActiveDockPanel,
      setLatestBlock,
      setCurrentBlock,
      setCamera,
    } = useTimegridStore.getState();

    if (useTimegridStore.getState().latestBlock === 0) {
      setLatestBlock(FIXTURE_LATEST_BLOCK);
      setCurrentBlock(FIXTURE_LATEST_BLOCK);
    }

    function applyCamera(): void {
      const cam = useTimegridStore.getState().camera;
      viewport.position.set(cam.position.x, cam.position.y);
      viewport.scale.set(cam.zoom);
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

      // Viewport holds the lattice; pan/zoom transforms the viewport,
      // not the stage. Backdrop guide rings live inside the viewport so
      // they pan/zoom with the role-radius encoding they represent —
      // unlike Grid where the backdrop is a fixed frame.
      app.stage.addChild(viewport);

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
      viewport.addChild(backdrop);

      const edges = new Graphics();
      viewport.addChild(edges);

      let draggedBody: Body | null = null;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      let currentBlock = useTimegridStore.getState().currentBlock;
      let panning = false;
      let panStart = { x: 0, y: 0 };
      let panStartCam = { x: 0, y: 0 };
      let hoveredAddress: string | null = null;
      let focusedAddress: string | null = null;
      const neighborsByAddr = new Map<string, Set<string>>();

      function shouldBePinned(body: Body): boolean {
        if (body === draggedBody) return true;
        if (body.wallet.role === 'satoshi') return true;
        if (body.wallet.firstSeenBlock > currentBlock) return true;
        return false;
      }

      // Three orthogonal alpha layers compose multiplicatively here:
      //   activity (alive 1 / gone-dark 0.3 / pre-birth 0)
      //   × spotlight (1 if hovered/focused or a neighbor; else 0.15)
      //   = final node alpha
      // Spotlight target is `focusedAddress ?? hoveredAddress` — focus is
      // a sticky hover. Drag has its own cue (alpha 0.85 inline) and
      // bypasses this path entirely.
      function spotlightTarget(): string | null {
        return focusedAddress ?? hoveredAddress;
      }

      function nodeAlpha(body: Body): number {
        const born = body.wallet.firstSeenBlock <= currentBlock;
        const active = born && body.wallet.lastActiveBlock >= currentBlock;
        const activityA = !born ? 0 : active ? 1 : 0.3;
        const target = spotlightTarget();
        if (!target) return activityA;
        if (body.wallet.address === target) return activityA;
        if (neighborsByAddr.get(target)?.has(body.wallet.address)) {
          return activityA;
        }
        return activityA * SPOTLIGHT_DIM;
      }

      function applyAlpha(): void {
        for (const body of bodies) {
          if (body === draggedBody) continue;
          const alpha = nodeAlpha(body);
          body.graphics.alpha = alpha;
          if (body.halo) body.halo.alpha = alpha === 0 ? 0 : 0.75 * alpha;
        }
      }

      // Convert screen-space cursor to viewport-local coords. Required
      // because the viewport may be panned/zoomed when drag happens.
      function cursorInViewport(global: { x: number; y: number }): {
        x: number;
        y: number;
      } {
        return {
          x: (global.x - viewport.position.x) / viewport.scale.x,
          y: (global.y - viewport.position.y) / viewport.scale.y,
        };
      }

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
          pinned: false,
          graphics: dot,
          halo: null,
        };

        dot.on('pointerover', () => {
          if (draggedBody || panning) return;
          // While focused, hover does nothing — focus is locked and the
          // user has already committed to a wallet via click.
          if (focusedAddress) return;
          setSelectedWallet(wallet.address);
          hoveredAddress = wallet.address;
          applyAlpha();
        });
        dot.on('pointerout', () => {
          if (draggedBody || panning) return;
          if (focusedAddress) return;
          setSelectedWallet(null);
          hoveredAddress = null;
          applyAlpha();
        });
        dot.on('pointertap', () => {
          // Click toggles local-graph focus on this wallet.
          // Click same wallet again → unlock. Click different wallet →
          // switch focus. ESC also unlocks (handler below).
          if (focusedAddress === wallet.address) {
            focusedAddress = null;
            setSelectedWallet(null);
            setFocusActive(false);
          } else {
            focusedAddress = wallet.address;
            hoveredAddress = null; // focus supersedes hover
            setSelectedWallet(wallet.address);
            setActiveDockPanel('wallet-inspector');
            setFocusActive(true);
          }
          applyAlpha();
        });
        dot.on(
          'pointerdown',
          (e: {
            global: { x: number; y: number };
            stopPropagation: () => void;
          }) => {
            if (body.wallet.firstSeenBlock > currentBlock) return;
            // Stop propagation so the stage doesn't also start a pan.
            e.stopPropagation();
            draggedBody = body;
            body.pinned = true;
            body.vx = 0;
            body.vy = 0;
            const v = cursorInViewport(e.global);
            dragOffsetX = v.x - (cx + body.x);
            dragOffsetY = v.y - (cy + body.y);
            dot.cursor = 'grabbing';
            dot.alpha = 0.85;
            setSelectedWallet(wallet.address);
          },
        );

        viewport.addChild(dot);

        if (wallet.role === 'satoshi') {
          const halo = new Graphics();
          halo
            .circle(0, 0, ROLE_RADIUS.satoshi + 7)
            .stroke({ width: 1.4, color: ROLE_COLOR.satoshi, alpha: 0.75 });
          halo.position.set(cx + seed.x, cy + seed.y);
          viewport.addChild(halo);
          body.halo = halo;
        }

        body.pinned = shouldBePinned(body);
        return body;
      });

      // Stage-level event handling: pan when empty space is hit;
      // pointermove handles either drag or pan depending on which is
      // active; pointerup ends whichever is active.
      app.stage.eventMode = 'static';
      app.stage.hitArea = { contains: () => true };
      app.stage.on(
        'pointerdown',
        (e: {
          target: unknown;
          global: { x: number; y: number };
        }) => {
          if (e.target !== app.stage) return; // a dot was hit
          panning = true;
          panStart = { x: e.global.x, y: e.global.y };
          panStartCam = { ...useTimegridStore.getState().camera.position };
          app.canvas.style.cursor = 'grabbing';
        },
      );
      app.stage.on(
        'pointermove',
        (e: { global: { x: number; y: number } }) => {
          if (draggedBody) {
            const v = cursorInViewport(e.global);
            draggedBody.x = v.x - dragOffsetX - cx;
            draggedBody.y = v.y - dragOffsetY - cy;
            draggedBody.vx = 0;
            draggedBody.vy = 0;
          } else if (panning) {
            const cam = useTimegridStore.getState().camera;
            setCamera({
              position: {
                x: panStartCam.x + (e.global.x - panStart.x),
                y: panStartCam.y + (e.global.y - panStart.y),
              },
              zoom: cam.zoom,
            });
          }
        },
      );

      function endDrag(): void {
        if (!draggedBody) return;
        const body = draggedBody;
        draggedBody = null;
        body.graphics.cursor = 'grab';
        body.graphics.alpha =
          body.wallet.firstSeenBlock <= currentBlock ? 1 : 0;
        body.pinned = shouldBePinned(body);
      }
      function endPan(): void {
        panning = false;
        app.canvas.style.cursor = '';
      }
      app.stage.on('pointerup', () => {
        endDrag();
        endPan();
      });
      app.stage.on('pointerupoutside', () => {
        endDrag();
        endPan();
      });

      // ESC clears focus mode. document-level so it works regardless of
      // canvas focus state. No-op when nothing is focused.
      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') return;
        if (!focusedAddress) return;
        focusedAddress = null;
        setSelectedWallet(null);
        setFocusActive(false);
        applyAlpha();
      };
      document.addEventListener('keydown', onKeyDown);
      cleanupFns.push(() => {
        document.removeEventListener('keydown', onKeyDown);
      });

      // Reset Layout — re-seed every non-satoshi position to its ring
      // origin and zero velocities. Triggered by the React reset button
      // via a custom DOM event so the React tree doesn't have to hold a
      // ref into PIXI internals.
      const onReset = (): void => {
        for (const body of bodies) {
          if (body.wallet.role === 'satoshi') continue;
          const seed = seedPosition(body.wallet);
          body.x = seed.x;
          body.y = seed.y;
          body.vx = 0;
          body.vy = 0;
        }
      };
      document.addEventListener('graphview:reset', onReset);
      cleanupFns.push(() => {
        document.removeEventListener('graphview:reset', onReset);
      });

      // Wheel zoom on the canvas DOM element. preventDefault stops the
      // page from scrolling while the user explores the lattice.
      const onWheel = (event: WheelEvent): void => {
        event.preventDefault();
        const cam = useTimegridStore.getState().camera;
        const delta = -event.deltaY * ZOOM_STEP;
        const nextZoom = Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, cam.zoom * (1 + delta)),
        );
        setCamera({ position: cam.position, zoom: nextZoom });
      };
      app.canvas.addEventListener('wheel', onWheel, { passive: false });
      cleanupFns.push(() => {
        app.canvas.removeEventListener('wheel', onWheel);
      });

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

      // Build the neighbor map once — used by hover-spotlight to flag
      // every wallet bonded to the hovered node.
      for (const link of links) {
        const aAddr = bodies[link.a].wallet.address;
        const bAddr = bodies[link.b].wallet.address;
        if (!neighborsByAddr.has(aAddr)) neighborsByAddr.set(aAddr, new Set());
        if (!neighborsByAddr.has(bAddr)) neighborsByAddr.set(bAddr, new Set());
        neighborsByAddr.get(aAddr)!.add(bAddr);
        neighborsByAddr.get(bAddr)!.add(aAddr);
      }

      function applyScrubberState(): void {
        // Pin/un-pin per current-block; alpha is computed downstream by
        // applyAlpha() which composes activity-bloom with hover-spotlight.
        for (const body of bodies) {
          const wasPinned = body.pinned;
          body.pinned = shouldBePinned(body);
          if (!body.pinned && wasPinned && body !== draggedBody) {
            body.vx = 0;
            body.vy = 0;
          }
        }
        applyAlpha();
      }

      const unsubscribeBlock = useTimegridStore.subscribe((state, prev) => {
        if (state.currentBlock !== prev.currentBlock) {
          currentBlock = state.currentBlock;
          applyScrubberState();
        }
      });
      const unsubscribeCamera = useTimegridStore.subscribe((state, prev) => {
        if (state.camera !== prev.camera) applyCamera();
      });
      cleanupFns.push(unsubscribeBlock, unsubscribeCamera);

      applyScrubberState();
      applyCamera();

      function tick(): void {
        const dt = Math.min(app.ticker.deltaMS / 1000, PHYSICS.maxStep);

        for (const body of bodies) {
          if (body.pinned) continue;
          body.vx += -body.x * PHYSICS.gravity * body.mass * dt;
          body.vy += -body.y * PHYSICS.gravity * body.mass * dt;
        }

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

        edges.clear();
        for (const link of links) {
          const a = bodies[link.a];
          const b = bodies[link.b];
          // Skip edges where either endpoint is fully invisible (pre-birth)
          if (a.graphics.alpha === 0 || b.graphics.alpha === 0) continue;
          const blocksAfter = Math.max(0, currentBlock - link.bondLastActive);
          const fade = Math.max(0, 1 - blocksAfter / EDGE_FADE_BLOCKS);
          let alpha = fade * EDGE_BASE_ALPHA;
          // Edge spotlight: hot iff both endpoints are hovered/focused or
          // neighbors thereof. Otherwise dim by the same factor as non-
          // neighbor nodes — visually "the connection isn't relevant
          // right now."
          const target = spotlightTarget();
          if (target) {
            const aAddr = a.wallet.address;
            const bAddr = b.wallet.address;
            const neighbors = neighborsByAddr.get(target);
            const aHot = aAddr === target || (neighbors?.has(aAddr) ?? false);
            const bHot = bAddr === target || (neighbors?.has(bAddr) ?? false);
            if (!(aHot && bHot)) alpha *= SPOTLIGHT_DIM;
          }
          if (alpha <= 0) continue;
          edges
            .moveTo(cx + a.x, cy + a.y)
            .lineTo(cx + b.x, cy + b.y)
            .stroke({ width: 0.6, color: 0xc28840, alpha });
        }
      }

      app.ticker.add(tick);
    })();

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) fn();
      app.destroy(true, { children: true });
    };
  }, []);

  const handleReset = (): void => {
    document.dispatchEvent(new Event('graphview:reset'));
  };

  return (
    <div className="relative aspect-square w-full overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        aria-label="Timechain Graph lattice — force-directed Obsidian-style placement of Bitcoin wallets, drag empty space to pan, scroll to zoom, drag any wallet to pull it through the layout, click a wallet to focus on its neighborhood, ESC to clear focus"
      />
      <button
        type="button"
        onClick={handleReset}
        className="text-mono absolute left-3 top-3 rounded-full border border-[color:var(--color-card-border)] bg-[color:var(--color-background)]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] backdrop-blur-sm transition-colors hover:border-[color:var(--color-gold)]/60 hover:text-[color:var(--color-gold)]"
        aria-label="Reset lattice positions"
      >
        ↺ Reset
      </button>
      <div
        aria-hidden
        className="text-mono pointer-events-none absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.28em] text-[color:var(--color-gold)] mix-blend-screen"
      >
        {BRAND_TAGLINE}
      </div>
      <div
        aria-hidden
        className="text-mono pointer-events-none absolute bottom-3 right-3 text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]"
      >
        Block{' '}
        <span className="text-[color:var(--color-text-primary)]">
          {currentBlock.toLocaleString()}
        </span>
      </div>
      {focusActive && (
        <div
          aria-live="polite"
          className="text-mono pointer-events-none absolute right-3 top-3 rounded-full border border-[color:var(--color-amber)]/40 bg-[color:var(--color-background)]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-amber)] backdrop-blur-sm"
        >
          Focus locked ·{' '}
          <span className="text-[color:var(--color-text-secondary)]">
            ESC to clear
          </span>
        </div>
      )}
    </div>
  );
}
