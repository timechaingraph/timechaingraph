'use client';

import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { getActiveSubstrate } from '@/data/substrate';
import { ROLE_COLOR, ROLE_RADIUS } from '@/lib/role-visuals';
import { useTimegridStore } from '@/store/timegridStore';
import { BRAND_TAGLINE } from '@/lib/site-config';
import { step as physicsStep, type PhysicsLink } from '@/lib/forceLayout';
import type { WalletBond, WalletData, WalletRole } from '@/types/wallet';

// GraphView reads its chain digest through the ChainSubstrate
// contract rather than direct fixture imports. v0.1 substrate is
// fixture-backed; v0.2+ swaps in an R2/parquet implementation
// without touching this file.
// Read at module-evaluation time from the ACTIVE substrate — GraphCanvas
// calls loadSubstrate() before it dynamic-imports this module, so these
// capture real chain data (static importers like tests get the fixture).
//
// Barnes-Hut (src/lib/forceLayout) makes physics O(n log n), and nodes now render
// as batched, shared-texture Sprites (one draw call for the whole set) instead of
// a Graphics-per-node — so this cap can sit at the free-tier scale. The remaining
// per-tick cost is the single `edges` Graphics redraw; lifting the cap much higher
// would make THAT the bottleneck (next steps: edge batching / viewport culling +
// LOD for the Max tier's millions).
// EDGE-FIRST selection: greedily take the strongest bonds + their endpoints
// up to MAX_RENDER_NODES, then keep further bonds that join two already-kept
// wallets. Every node ends up with ≥1 connection, so the layout shows real
// hubs + spokes — picking top wallets by *value* instead leaves them
// disconnected (their bonds point outside the set) and it collapses to a blob.
const MAX_RENDER_NODES = 12000;
const _sub = getActiveSubstrate();
let WALLETS: readonly WalletData[];
let BONDS: readonly WalletBond[];
if (_sub.wallets.length <= MAX_RENDER_NODES) {
  WALLETS = _sub.wallets;
  BONDS = _sub.bonds;
} else {
  const byAddr = new Map(_sub.wallets.map((w) => [w.address, w] as const));
  const rankedBonds = [..._sub.bonds].sort((a, b) => (b.sats > a.sats ? 1 : -1));
  const keptW = new Map<string, WalletData>();
  const keptB: WalletBond[] = [];
  for (const b of rankedBonds) {
    const hasF = keptW.has(b.fromAddress);
    const hasT = keptW.has(b.toAddress);
    if (keptW.size + (hasF ? 0 : 1) + (hasT ? 0 : 1) > MAX_RENDER_NODES) {
      if (hasF && hasT) keptB.push(b); // densify within the kept set
      continue;
    }
    const wf = byAddr.get(b.fromAddress);
    const wt = byAddr.get(b.toAddress);
    if (!wf || !wt) continue;
    keptW.set(wf.address, wf);
    keptW.set(wt.address, wt);
    keptB.push(b);
  }
  WALLETS = [...keptW.values()];
  BONDS = keptB;
}

const RING_RADIUS: Record<WalletRole, number> = {
  satoshi: 0,
  whale: 90,
  miner: 140,
  significant: 210,
  dust: 290,
};

const PHYSICS = {
  // Tuned up from the 50-node fixture defaults for the multi-thousand-node real
  // graph: weaker gravity + stronger repulsion so it spreads into a readable
  // network instead of a tight ball. step() auto-switches to Barnes-Hut above
  // BH_THRESHOLD; theta is its opening angle (0.8 = fast, fine for this view).
  gravity: 0.025,
  repulsion: 1200,
  spring: 0.012,
  springRest: 80,
  damping: 0.86,
  maxStep: 1 / 30,
  theta: 0.8,
};

/** Edge fade per project spec — bonds fade to alpha 0 over 10 blocks of inactivity. */
const EDGE_FADE_BLOCKS = 10;
const EDGE_BASE_ALPHA = 0.4;

/**
 * Bond-formation ramp. A synapse fades in over its first N blocks
 * of life (rather than appearing fully formed). The brain learns
 * one connection at a time; new synapses ease in as the chain
 * scrubber crosses their formation block.
 */
const BOND_FORMATION_BLOCKS = 10;

/**
 * Synapse-pulse parameters. When the user targets a wallet (hover
 * or focus), a wave of pulses travels outward along every incident
 * synapse — the brain "fires" along its connections from the
 * targeted neuron. Per-frame progress increment; completion in
 * ~25 frames (~400ms at 60fps).
 */
const PULSE_SPEED = 0.04;
const PULSE_RADIUS = 1.8;
const PULSE_COLOR = 0xffd700; // brass-gold

/** Hover-spotlight multiplier for non-neighbors — focus on the active branch. */
const SPOTLIGHT_DIM = 0.15;

/**
 * Spotlight depths the user can cycle through. Hop 1 = direct
 * neighbors only (default). Hop 2/3 = expanding lineage (matches
 * the empire BFS in the brain generator). 'all'
 * lifts the dim entirely so the full lattice reads as bright.
 */
const SPOTLIGHT_DEPTHS = [1, 2, 3, Infinity] as const;
type SpotlightDepth = (typeof SPOTLIGHT_DEPTHS)[number];
const SPOTLIGHT_DEPTH_LABELS: Record<string, string> = {
  '1': 'Hop 1',
  '2': 'Hop 2',
  '3': 'Hop 3',
  Infinity: 'All',
};

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.0015;

// Demo timeline upper bound. Aligns with the chain-tools snapshot
// generator's SNAPSHOT_THROUGH_BLOCK (= chain-tools TIP_BLOCK) so
// the scrubber range == the snapshot range == the playback timeline.
// Snapped to a recent live chain tip — bump on each ingest run.
// As the user scrubs through, FREE_TIER_50's wallets spawn at their
// firstSeenBlock — Satoshi at 0, miners by ~44k, whales from ~50k,
// significant from ~150k, then the lattice plays forward through
// epochs 1-4 with existing wallets active as edges fade in/out
// across blocks.
const FIXTURE_LATEST_BLOCK = getActiveSubstrate().tipBlock || 947_630;

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
  node: Sprite;
  halo: Graphics | null;
};

type Link = PhysicsLink & {
  /** Most recent activity from either endpoint — drives the fade-out math. */
  bondLastActive: number;
  /** Synapse formation block — drives the fade-in animation. */
  formationBlock: number;
};

/**
 * GraphView — force-directed renderer for timechaingraph.com.
 *
 * The full living-network experience:
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
  // Spotlight depth — controls how many BFS hops out from the focus
  // target the lattice stays bright. 1 = direct neighbors only;
  // Infinity = full empire (no dimming). React state for HUD render;
  // mirrored to a closure variable inside the effect for the graphics
  // pipeline.
  const [spotlightDepth, setSpotlightDepth] = useState<SpotlightDepth>(1);

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

    // Open at the chain tip so the full network is visible immediately.
    // With real data, genesis-start shows an empty canvas (Free-tier wallets
    // first appear thousands of blocks in) and Narrate-speed playback would
    // take days to populate it. The scrubber + playback stay available, so a
    // visitor can rewind to genesis and watch the lattice form.
    setLatestBlock(FIXTURE_LATEST_BLOCK);
    setCurrentBlock(FIXTURE_LATEST_BLOCK);
    const { setPlaybackSpeedIdx, setPlaybackPlaying } = useTimegridStore.getState();
    setPlaybackSpeedIdx(0); // Narrate (1 block / 10s) once the visitor presses play
    setPlaybackPlaying(false);

    function applyCamera(): void {
      const cam = useTimegridStore.getState().camera;
      viewport.position.set(cam.position.x, cam.position.y);
      viewport.scale.set(cam.zoom);
    }

    void (async () => {
      // Engine tuning per user directive 2026-04-30 ("better engine"):
      // - resolution = devicePixelRatio so retina/HiDPI screens render
      //   crisp circle edges + sharp synapse strokes (default is 1).
      // - autoDensity true so the canvas's CSS size stays at logical
      //   pixels while the backing store scales to physical pixels.
      // - antialias true (kept) for smooth organic-shape circles.
      // - hello false to silence Pixi's banner in production logs.
      await app.init({
        resizeTo: container,
        background: 0x08080c,
        antialias: true,
        resolution:
          typeof window !== 'undefined' && window.devicePixelRatio
            ? window.devicePixelRatio
            : 1,
        autoDensity: true,
        hello: false,
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

      // Pulse layer renders on top of edges but below dots — the
      // synapse-fire animation reads as "between the wires," not "on
      // top of the neurons."
      const pulseLayer = new Graphics();
      viewport.addChild(pulseLayer);

      // Active pulses traveling along synapses. Each entry is one
      // pulse from `fromIdx` toward `toIdx`; progress 0..1; removed
      // on completion.
      type Pulse = { fromIdx: number; toIdx: number; progress: number };
      const pulses: Pulse[] = [];

      // Tracks which block the pulse-spawner last saw, so playback
      // forward through history fires a pulse on each bond AT its
      // formation block. The lattice "learns" its connections as the
      // scrubber moves forward.
      let lastSpawnedBlock = useTimegridStore.getState().currentBlock;
      const MAX_PULSES_PER_FRAME = 5;

      function spawnPulsesFromSeed(seedAddress: string): void {
        const seedIdx = idxByAddr.get(seedAddress);
        if (seedIdx === undefined) return;
        for (const link of links) {
          let toIdx: number | null = null;
          if (link.a === seedIdx) toIdx = link.b;
          else if (link.b === seedIdx) toIdx = link.a;
          if (toIdx === null) continue;
          pulses.push({ fromIdx: seedIdx, toIdx, progress: 0 });
        }
      }

      function spawnPulsesForNewBonds(): void {
        if (currentBlock <= lastSpawnedBlock) {
          // Backward scrubbing or no advance — re-baseline without
          // spawning.
          lastSpawnedBlock = currentBlock;
          return;
        }
        let spawned = 0;
        for (const link of links) {
          if (spawned >= MAX_PULSES_PER_FRAME) break;
          if (
            link.formationBlock > lastSpawnedBlock &&
            link.formationBlock <= currentBlock
          ) {
            const a = bodies[link.a];
            const b = bodies[link.b];
            // Skip if either endpoint isn't yet visible
            if (a.node.alpha === 0 || b.node.alpha === 0) continue;
            pulses.push({ fromIdx: link.a, toIdx: link.b, progress: 0 });
            spawned++;
          }
        }
        lastSpawnedBlock = currentBlock;
      }

      let draggedBody: Body | null = null;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      let currentBlock = useTimegridStore.getState().currentBlock;
      let panning = false;
      let panStart = { x: 0, y: 0 };
      let panStartCam = { x: 0, y: 0 };
      let hoveredAddress: string | null = null;
      let focusedAddress: string | null = null;
      let activeSpotlightDepth: SpotlightDepth = 1;
      let spotlightDistances = new Map<string, number>();
      const neighborsByAddr = new Map<string, Set<string>>();

      function shouldBePinned(body: Body): boolean {
        if (body === draggedBody) return true;
        if (body.wallet.role === 'satoshi') return true;
        if (body.wallet.firstSeenBlock > currentBlock) return true;
        return false;
      }

      // Three orthogonal alpha layers compose multiplicatively here:
      //   activity (alive 1 / gone-dark 0.3 / pre-birth 0)
      //   × spotlight (1 if within depth hops of target; else 0.15)
      //   = final node alpha
      // Spotlight target is `focusedAddress ?? hoveredAddress` — focus is
      // a sticky hover. Depth comes from `activeSpotlightDepth` (1, 2, 3,
      // or Infinity for full empire).
      function spotlightTarget(): string | null {
        return focusedAddress ?? hoveredAddress;
      }

      // BFS through neighborsByAddr from a seed up to maxDepth. Returns
      // a Map<address, hopDistance>. Same algorithm the snapshot
      // generator uses for empire emit; both surfaces compute
      // identical distances by construction.
      function bfsFrom(seed: string, maxDepth: number): Map<string, number> {
        const distances = new Map<string, number>();
        distances.set(seed, 0);
        const queue: string[] = [seed];
        while (queue.length > 0) {
          const current = queue.shift();
          if (current === undefined) break;
          const currentDist = distances.get(current);
          if (currentDist === undefined || currentDist >= maxDepth) continue;
          const neighbors = neighborsByAddr.get(current);
          if (!neighbors) continue;
          for (const neighbor of neighbors) {
            if (!distances.has(neighbor)) {
              distances.set(neighbor, currentDist + 1);
              queue.push(neighbor);
            }
          }
        }
        return distances;
      }

      function recomputeSpotlight(): void {
        const target = spotlightTarget();
        if (!target) {
          spotlightDistances = new Map();
          return;
        }
        spotlightDistances = bfsFrom(target, activeSpotlightDepth);
      }

      function nodeAlpha(body: Body): number {
        const born = body.wallet.firstSeenBlock <= currentBlock;
        const active = born && body.wallet.lastActiveBlock >= currentBlock;
        const activityA = !born ? 0 : active ? 1 : 0.3;
        if (!spotlightTarget()) return activityA;
        if (spotlightDistances.has(body.wallet.address)) return activityA;
        return activityA * SPOTLIGHT_DIM;
      }

      function applyAlpha(): void {
        for (const body of bodies) {
          if (body === draggedBody) continue;
          const alpha = nodeAlpha(body);
          body.node.alpha = alpha;
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

      // One shared, high-res white circle texture for every node. Sprites that
      // share a texture batch into ~one draw call (vs a Graphics-per-node) — the
      // key to scaling the node count. Generated big + hi-res then scaled DOWN
      // per role, so dots stay crisp at any zoom.
      const NODE_TEX_RADIUS = 32;
      const circleTex = new Graphics().circle(0, 0, NODE_TEX_RADIUS).fill(0xffffff);
      const nodeTexture = app.renderer.generateTexture({
        target: circleTex,
        resolution: Math.max(2, (window.devicePixelRatio || 1) * 2),
        antialias: true,
      });
      circleTex.destroy();

      const bodies: Body[] = WALLETS.map((wallet) => {
        const seed = seedPosition(wallet);
        const radius = ROLE_RADIUS[wallet.role];
        const scale = radius / NODE_TEX_RADIUS;

        // Shared-texture Sprite (batched) instead of a per-node Graphics. Sprite
        // and Graphics share the interaction API, so every handler below is
        // unchanged — only the visual + hit-area math differ.
        const dot = new Sprite(nodeTexture);
        dot.anchor.set(0.5);
        dot.tint = ROLE_COLOR[wallet.role];
        dot.scale.set(scale);
        dot.position.set(cx + seed.x, cy + seed.y);
        dot.eventMode = 'static';
        dot.cursor = 'grab';
        // hitArea is tested in the sprite's LOCAL (unscaled) space; divide the
        // desired world hit radius (≥6px — generous for tiny dots) by the scale.
        const hitR = Math.max(radius, 6) / scale;
        dot.hitArea = {
          contains: (mx: number, my: number) => mx * mx + my * my <= hitR * hitR,
        };

        const body: Body = {
          wallet,
          x: seed.x,
          y: seed.y,
          vx: 0,
          vy: 0,
          mass: massOf(wallet),
          pinned: false,
          node: dot,
          halo: null,
        };

        dot.on('pointerover', () => {
          if (draggedBody || panning) return;
          // While focused, hover does nothing — focus is locked and the
          // user has already committed to a wallet via click.
          if (focusedAddress) return;
          setSelectedWallet(wallet.address);
          hoveredAddress = wallet.address;
          recomputeSpotlight();
          spawnPulsesFromSeed(wallet.address);
          applyAlpha();
        });
        dot.on('pointerout', () => {
          if (draggedBody || panning) return;
          if (focusedAddress) return;
          setSelectedWallet(null);
          hoveredAddress = null;
          recomputeSpotlight();
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
            spawnPulsesFromSeed(wallet.address);
          }
          recomputeSpotlight();
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
        body.node.cursor = 'grab';
        body.node.alpha =
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
        // ESC clears focus (existing behavior).
        if (event.key === 'Escape') {
          if (!focusedAddress) return;
          focusedAddress = null;
          setSelectedWallet(null);
          setFocusActive(false);
          recomputeSpotlight();
          applyAlpha();
          return;
        }
        // Number keys 1/2/3/0 cycle spotlight depth — quick
        // brain-empire navigation. Press 2 to expand the spotlight
        // from direct neighbors to 2-hop reach; 0 lifts the dim
        // entirely (full empire visible). Only fires when focused
        // OR hovered, so accidental keypresses don't churn the
        // visual.
        if (event.key === '1' || event.key === '2' || event.key === '3') {
          const newDepth = parseInt(event.key, 10) as SpotlightDepth;
          activeSpotlightDepth = newDepth;
          setSpotlightDepth(newDepth);
          recomputeSpotlight();
          applyAlpha();
          return;
        }
        if (event.key === '0') {
          activeSpotlightDepth = Infinity;
          setSpotlightDepth(Infinity);
          recomputeSpotlight();
          applyAlpha();
        }
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

      // Wheel zoom on the canvas DOM element. Cursor-anchored: the
      // world point under the mouse stays under the mouse after the
      // zoom — the lattice grows or shrinks around wherever the user
      // is looking, instead of always pivoting on world-origin.
      // preventDefault stops the page from scrolling while the user
      // explores the lattice.
      const onWheel = (event: WheelEvent): void => {
        event.preventDefault();
        const cam = useTimegridStore.getState().camera;
        const delta = -event.deltaY * ZOOM_STEP;
        const nextZoom = Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, cam.zoom * (1 + delta)),
        );
        if (nextZoom === cam.zoom) return;

        // Mouse position in stage coords (canvas-local, top-left = 0,0).
        const rect = app.canvas.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;
        // World point currently under the mouse, before the zoom.
        const wx = (mx - cam.position.x) / cam.zoom;
        const wy = (my - cam.position.y) / cam.zoom;
        // Camera position needed so that (wx, wy) lands at (mx, my)
        // after applying nextZoom.
        const nextX = mx - wx * nextZoom;
        const nextY = my - wy * nextZoom;
        setCamera({ position: { x: nextX, y: nextY }, zoom: nextZoom });
      };
      app.canvas.addEventListener('wheel', onWheel, { passive: false });
      cleanupFns.push(() => {
        app.canvas.removeEventListener('wheel', onWheel);
      });

      const idxByAddr = new Map(bodies.map((b, i) => [b.wallet.address, i]));
      const links: Link[] = [];
      for (const bond of BONDS) {
        const a = idxByAddr.get(bond.fromAddress);
        const b = idxByAddr.get(bond.toAddress);
        if (a === undefined || b === undefined) continue;
        const strength =
          PHYSICS.spring * (Math.log10(Number(bond.sats) + 1) * 0.1 + 0.6);
        const aWallet = bodies[a].wallet;
        const bWallet = bodies[b].wallet;
        const bondLastActive = Math.max(
          aWallet.lastActiveBlock,
          bWallet.lastActiveBlock,
        );
        // Formation block — the bond's TRUE first-appearance block, carried by
        // the parquet substrate (reduce computes MIN(formationBlock) across the
        // chain). The synapse fade-in ramp + formation pulse fire as the scrubber
        // crosses it, so playback from genesis replays each connection forming at
        // its real on-chain birth. The 50-node fixture omits it, so fall back to a
        // deterministic djb2 pick within the endpoints' overlap window.
        let formationBlock = bond.formationBlock;
        if (formationBlock === undefined) {
          const lo = Math.max(aWallet.firstSeenBlock, bWallet.firstSeenBlock);
          const hi = Math.min(aWallet.lastActiveBlock, bWallet.lastActiveBlock);
          formationBlock =
            hi <= lo
              ? lo
              : lo + (djb2(`${bond.fromAddress}|${bond.toAddress}`) % (hi - lo));
        }
        links.push({ a, b, strength, bondLastActive, formationBlock });
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

      // Programmatic depth updates from the React HUD button row.
      // Listening on the canvas so external code can dispatch a
      // CustomEvent('graphview:spotlight-depth', { detail: depth }).
      const onDepthChange = (event: Event): void => {
        const e = event as CustomEvent<SpotlightDepth>;
        if (typeof e.detail !== 'number') return;
        activeSpotlightDepth = e.detail;
        recomputeSpotlight();
        applyAlpha();
      };
      document.addEventListener('graphview:spotlight-depth', onDepthChange);
      cleanupFns.push(() => {
        document.removeEventListener('graphview:spotlight-depth', onDepthChange);
      });
      const unsubscribeCamera = useTimegridStore.subscribe((state, prev) => {
        if (state.camera !== prev.camera) applyCamera();
      });
      cleanupFns.push(unsubscribeBlock, unsubscribeCamera);

      applyScrubberState();
      applyCamera();

      function tick(): void {
        // Physics is pure functions in src/lib/forceLayout — gravity +
        // repulsion + springs + damping/integrate, all mutating bodies
        // in place. The graphics resync below is the only PIXI-coupled
        // part of the tick.
        physicsStep(bodies, links, app.ticker.deltaMS / 1000, PHYSICS);

        for (const body of bodies) {
          body.node.position.set(cx + body.x, cy + body.y);
          if (body.halo) body.halo.position.set(cx + body.x, cy + body.y);
        }

        // Spawn formation pulses for any bonds that crossed their
        // formationBlock since the last frame — synapses "fire" as
        // the brain learns them during playback.
        spawnPulsesForNewBonds();

        // Synapse-fire pulses — render before edges so edges underlay,
        // dots overlay, pulses sit between. Iterate backwards so we
        // can splice completed pulses without skipping.
        pulseLayer.clear();
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          p.progress += PULSE_SPEED;
          if (p.progress >= 1) {
            pulses.splice(i, 1);
            continue;
          }
          const fromBody = bodies[p.fromIdx];
          const toBody = bodies[p.toIdx];
          // Skip pulses where either endpoint is invisible (pre-birth)
          if (fromBody.node.alpha === 0 || toBody.node.alpha === 0) {
            continue;
          }
          const t = p.progress;
          const px = cx + fromBody.x + (toBody.x - fromBody.x) * t;
          const py = cy + fromBody.y + (toBody.y - fromBody.y) * t;
          // Pulse alpha eases out near the end of travel so completion
          // is gentle rather than abrupt.
          const pulseAlpha = Math.max(0.2, 1 - p.progress * 0.5);
          pulseLayer
            .circle(px, py, PULSE_RADIUS)
            .fill({ color: PULSE_COLOR, alpha: pulseAlpha });
        }

        edges.clear();
        for (const link of links) {
          const a = bodies[link.a];
          const b = bodies[link.b];
          // Skip edges where either endpoint is fully invisible (pre-birth)
          if (a.node.alpha === 0 || b.node.alpha === 0) continue;
          // Synapse formation ramp — 0 → 1 over the bond's first
          // BOND_FORMATION_BLOCKS blocks. Pre-formation: edge invisible.
          const formationAge = currentBlock - link.formationBlock;
          if (formationAge < 0) continue;
          const formationAlpha =
            formationAge >= BOND_FORMATION_BLOCKS
              ? 1
              : formationAge / BOND_FORMATION_BLOCKS;
          // Existing fade-out math past last activity.
          const blocksAfter = Math.max(0, currentBlock - link.bondLastActive);
          const fadeAlpha = Math.max(0, 1 - blocksAfter / EDGE_FADE_BLOCKS);
          let alpha = formationAlpha * fadeAlpha * EDGE_BASE_ALPHA;
          // Edge spotlight: hot iff both endpoints are inside the
          // current spotlight set (BFS up to activeSpotlightDepth from
          // the target). Outside-the-set edges dim by SPOTLIGHT_DIM.
          if (spotlightTarget()) {
            const aHot = spotlightDistances.has(a.wallet.address);
            const bHot = spotlightDistances.has(b.wallet.address);
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
      // Only destroy once PixiJS has finished its async init(). React
      // StrictMode runs this cleanup before init() resolves on the first
      // mount, and destroy() on an uninitialized app throws
      // ("_cancelResize is not a function"); the async init's own
      // `if (cancelled)` guard handles teardown in that case.
      if (app.renderer) app.destroy(true, { children: true });
    };
  }, []);

  const handleReset = (): void => {
    document.dispatchEvent(new Event('graphview:reset'));
  };

  const handleSpotlightDepth = (depth: SpotlightDepth): void => {
    setSpotlightDepth(depth);
    document.dispatchEvent(
      new CustomEvent('graphview:spotlight-depth', { detail: depth }),
    );
  };

  function depthKey(d: SpotlightDepth): string {
    return d === Infinity ? 'Infinity' : String(d);
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        aria-label="Timechain Graph — force-directed Bitcoin wallet network. Drag empty space to pan, scroll to zoom, drag any wallet to pull it through the layout, click a wallet to focus on its neighborhood, ESC to clear focus"
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
        className="text-mono absolute left-3 top-12 flex items-center gap-1 rounded-full border border-[color:var(--color-card-border)] bg-[color:var(--color-background)]/70 px-1.5 py-1 backdrop-blur-sm"
        role="group"
        aria-label="Spotlight depth"
      >
        <span className="px-1 text-[9px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
          Hops
        </span>
        {SPOTLIGHT_DEPTHS.map((d) => {
          const active = depthKey(d) === depthKey(spotlightDepth);
          return (
            <button
              key={depthKey(d)}
              type="button"
              onClick={() => handleSpotlightDepth(d)}
              aria-pressed={active}
              className={[
                'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] transition-colors',
                active
                  ? 'bg-[color:var(--color-amber)]/15 text-[color:var(--color-amber)]'
                  : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)]',
              ].join(' ')}
            >
              {SPOTLIGHT_DEPTH_LABELS[depthKey(d)].replace('Hop ', '')}
            </button>
          );
        })}
      </div>
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
