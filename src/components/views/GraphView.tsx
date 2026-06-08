'use client';

import { useEffect, useRef, useState } from 'react';
import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { getActiveSubstrate } from '@/data/substrate';
import { ROLE_COLOR } from '@/lib/role-visuals';
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

// Degree centrality per address (how many distinct bonds touch it), from the
// rendered bond set. Drives node SIZE — the most-connected wallets read biggest.
const degreeByAddr = new Map<string, number>();
for (const b of BONDS) {
  degreeByAddr.set(b.fromAddress, (degreeByAddr.get(b.fromAddress) ?? 0) + 1);
  degreeByAddr.set(b.toAddress, (degreeByAddr.get(b.toAddress) ?? 0) + 1);
}

// Per-address bond list (counterparty + sats + formation block) — powers the
// focus ego-network view (a wallet's strongest bonds formed so far).
type BondEdge = { other: string; sats: bigint; formationBlock: number };
const adjByAddr = new Map<string, BondEdge[]>();
for (const b of BONDS) {
  const fb = b.formationBlock ?? 0;
  const a1 = adjByAddr.get(b.fromAddress);
  if (a1) a1.push({ other: b.toAddress, sats: b.sats, formationBlock: fb });
  else adjByAddr.set(b.fromAddress, [{ other: b.toAddress, sats: b.sats, formationBlock: fb }]);
  const a2 = adjByAddr.get(b.toAddress);
  if (a2) a2.push({ other: b.fromAddress, sats: b.sats, formationBlock: fb });
  else adjByAddr.set(b.toAddress, [{ other: b.fromAddress, sats: b.sats, formationBlock: fb }]);
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
  // Tuned to break up the dense central cluster of cross-bonded whales (which
  // booms after ~block 490k as the big wallets come online + transact with each
  // other). Four knobs, all pushing toward spread:
  //   gravity   ↓ — weaker pull to origin, so everything doesn't converge center
  //   repulsion ↑ — stronger push (charge-weighted: hubs push hardest)
  //   spring    ↓ — bonded nodes pull together less
  //   springRest ↑ — and they settle farther apart
  // If still too clumped: ↑repulsion / ↑springRest / ↓gravity. If it explodes or
  // drifts apart: the reverse.
  gravity: 0.014,
  repulsion: 1100,
  spring: 0.0075,
  springRest: 140,
  damping: 0.86,
  maxStep: 1 / 30,
  theta: 0.8,
};

/**
 * Transient edges: a bond is a per-block transaction event. It appears at its
 * real formation block and fades to alpha 0 over the next EDGE_FADE_BLOCKS,
 * then it's gone — so the canvas shows recent transaction activity around the
 * scrubber's block, not a persistent all-time hairball. (Focus mode overrides
 * this to show a wallet's full lifetime ego-network.) ~10000 blocks ≈ two months
 * of activity — wide enough that edges persist visibly without the all-time set.
 */
const EDGE_FADE_BLOCKS = 10000;
const EDGE_BASE_ALPHA = 0.4;

/** Hover-spotlight multiplier for non-neighbors — focus on the active branch. */
const SPOTLIGHT_DIM = 0.15;

/** Focus shows at most this many of a wallet's strongest bonds — keeps a hub's
 *  ego-network legible instead of a blob of hundreds of all-time links. */
const FOCUS_MAX_BONDS = 24;

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

// Uniform gravity: every wallet feels the same pull toward the origin. (Mass
// used to be log(received), which sucked the biggest wallets into a central
// clump; spreading is now handled by charge-weighted repulsion instead.)
function massOf(): number {
  return 1;
}

// Node radius by DEGREE CENTRALITY — the more bonds a wallet has, the bigger it
// reads (the documented "radius = base + log(centrality)" model). Satoshi is the
// genesis centerpiece: a fixed, largest radius, anchored at the origin.
const SATOSHI_RADIUS = 9;
const NODE_BASE_RADIUS = 1.2;
const NODE_DEGREE_SCALE = 1.4;
const NODE_MAX_RADIUS = 7;
function radiusFor(wallet: WalletData): number {
  if (wallet.role === 'satoshi') return SATOSHI_RADIUS;
  const degree = degreeByAddr.get(wallet.address) ?? 0;
  return Math.min(
    NODE_MAX_RADIUS,
    NODE_BASE_RADIUS + Math.log10(degree + 1) * NODE_DEGREE_SCALE,
  );
}

type Body = {
  wallet: WalletData;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  /** Repulsion weight ∝ radius (∝ log-degree) — hubs push harder, spread more. */
  charge: number;
  /** Pre-birth: excluded from the sim so invisible nodes don't warp the layout. */
  inactive: boolean;
  pinned: boolean;
  node: Sprite;
  halo: Graphics | null;
};

type Link = PhysicsLink & {
  /** The bond's real first-appearance block — drives the transient edge fade. */
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

    // Auto-play from genesis: the lattice weaves itself forward — Satoshi alone
    // at block 0, then wallets + bonds appear at their real blocks. 'Fast' runs
    // the full chain in ~2 min; the visitor can pause / scrub / change speed.
    setLatestBlock(FIXTURE_LATEST_BLOCK);
    setCurrentBlock(0);
    const { setPlaybackSpeedIdx, setPlaybackPlaying } = useTimegridStore.getState();
    setPlaybackSpeedIdx(3); // 'Fast' (~2 min full chain) — see SPEED_OPTIONS
    setPlaybackPlaying(true);

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

      let draggedBody: Body | null = null;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      let currentBlock = useTimegridStore.getState().currentBlock;
      let panning = false;
      let panMoved = false;
      let panStart = { x: 0, y: 0 };
      let panStartCam = { x: 0, y: 0 };
      // Active click-to-frame camera animation (null when idle).
      let camTween:
        | { fromX: number; fromY: number; fromZoom: number; toX: number; toY: number; toZoom: number; t: number }
        | null = null;
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

      // Focus ego-set: the focused wallet + its strongest bonds formed up to the
      // current block (capped to FOCUS_MAX_BONDS) — clicking a hub shows its
      // biggest, most legible connections, not its entire all-time neighborhood.
      function focusEgoSet(addr: string): Map<string, number> {
        const set = new Map<string, number>();
        set.set(addr, 0);
        const bonds = (adjByAddr.get(addr) ?? [])
          .filter((e) => e.formationBlock <= currentBlock)
          .sort((a, b) => (b.sats > a.sats ? 1 : b.sats < a.sats ? -1 : 0))
          .slice(0, FOCUS_MAX_BONDS);
        for (const e of bonds) set.set(e.other, 1);
        return set;
      }

      function recomputeSpotlight(): void {
        if (focusedAddress) {
          // Focus = capped, time-filtered ego-network (see focusEgoSet).
          spotlightDistances = focusEgoSet(focusedAddress);
          return;
        }
        const target = spotlightTarget();
        if (!target) {
          spotlightDistances = new Map();
          return;
        }
        spotlightDistances = bfsFrom(target, activeSpotlightDepth);
      }

      function nodeAlpha(body: Body): number {
        // Focus mode = time-independent ego-network: the focused node + its
        // neighbors render full, everything else is hidden — a click drills
        // into a wallet's lifetime connections, regardless of the scrubber.
        if (focusedAddress) {
          return spotlightDistances.has(body.wallet.address) ? 1 : 0;
        }
        const born = body.wallet.firstSeenBlock <= currentBlock;
        const active = born && body.wallet.lastActiveBlock >= currentBlock;
        const activityA = !born ? 0 : active ? 1 : 0.3;
        // Hover preview: dim non-neighbors, don't hide them.
        if (!hoveredAddress) return activityA;
        if (spotlightDistances.has(body.wallet.address)) return activityA;
        return activityA * SPOTLIGHT_DIM;
      }

      function applyAlpha(): void {
        for (const body of bodies) {
          if (body === draggedBody) continue;
          const alpha = nodeAlpha(body);
          body.node.alpha = alpha;
          // Invisible nodes (pre-birth, or hidden in focus mode) must not be
          // hoverable/clickable — otherwise you can select a node you can't see.
          body.node.eventMode = alpha > 0 ? 'static' : 'none';
          if (body.halo) body.halo.alpha = alpha === 0 ? 0 : 0.75 * alpha;
        }
      }

      // Clear any sticky focus/hover and return the lattice to its full,
      // undimmed view. Shared by ESC and the click-empty-canvas gesture.
      function clearFocus(): void {
        if (!focusedAddress && !hoveredAddress) return;
        focusedAddress = null;
        hoveredAddress = null;
        setSelectedWallet(null);
        setFocusActive(false);
        recomputeSpotlight();
        applyAlpha();
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
        const radius = radiusFor(wallet);
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
          mass: massOf(),
          charge: radius, // degree-weighted repulsion (radius ∝ log-degree)
          inactive: wallet.firstSeenBlock > currentBlock, // pre-birth = out of sim
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
          }
          recomputeSpotlight();
          applyAlpha();
          if (focusedAddress) frameEgo(); // click-to-frame the ego-network
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
            .circle(0, 0, SATOSHI_RADIUS + 7)
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
          camTween = null; // user grabbed the camera — cancel any click-to-frame
          panning = true;
          panMoved = false;
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
            // Flag a real drag once the pointer travels >5px, so a release
            // with no movement reads as a click (→ deselect), not a pan.
            const ddx = e.global.x - panStart.x;
            const ddy = e.global.y - panStart.y;
            if (ddx * ddx + ddy * ddy > 25) panMoved = true;
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
        // A press+release on empty canvas with no drag = click → clear focus
        // (return the lattice to its full, undimmed view).
        const emptyClick = panning && !panMoved;
        endDrag();
        endPan();
        if (emptyClick) clearFocus();
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
          clearFocus();
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
        camTween = null; // user grabbed the camera — cancel any click-to-frame
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
        // Formation block — the bond's TRUE first-appearance block, carried by
        // the parquet substrate (reduce computes MIN(formationBlock) across the
        // chain). Drives the transient edge: the bond flashes as the scrubber
        // crosses it, then fades. The 50-node fixture omits it, so fall back to a
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
        links.push({ a, b, strength, formationBlock });
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
          // Pre-birth wallets sit out of the sim (no repulsion/springs) so they
          // don't warp the visible layout while invisible.
          body.inactive = body.wallet.firstSeenBlock > currentBlock;
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
          if (focusedAddress) recomputeSpotlight(); // re-filter ego-set by time
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

      // Click-to-frame: smoothly pan/zoom so the focused wallet's ego-network
      // fills the viewport. Computes the spotlight bbox in viewport-local space
      // and arms a camera tween the tick eases out.
      function frameEgo(): void {
        let lxMin = Infinity, lyMin = Infinity, lxMax = -Infinity, lyMax = -Infinity, n = 0;
        for (const body of bodies) {
          if (!spotlightDistances.has(body.wallet.address)) continue;
          const lx = cx + body.x;
          const ly = cy + body.y;
          if (lx < lxMin) lxMin = lx;
          if (ly < lyMin) lyMin = ly;
          if (lx > lxMax) lxMax = lx;
          if (ly > lyMax) lyMax = ly;
          n++;
        }
        if (n === 0) return;
        const pad = 140;
        const bw = Math.max(lxMax - lxMin, 1);
        const bh = Math.max(lyMax - lyMin, 1);
        const sw = app.screen.width;
        const sh = app.screen.height;
        const zoom = Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, Math.min((sw - pad * 2) / bw, (sh - pad * 2) / bh)),
        );
        const centerLx = (lxMin + lxMax) / 2;
        const centerLy = (lyMin + lyMax) / 2;
        const cam = useTimegridStore.getState().camera;
        camTween = {
          fromX: cam.position.x,
          fromY: cam.position.y,
          fromZoom: cam.zoom,
          toX: sw / 2 - centerLx * zoom,
          toY: sh / 2 - centerLy * zoom,
          toZoom: zoom,
          t: 0,
        };
      }

      function tick(): void {
        // Click-to-frame camera animation (ease-out cubic over ~12 frames).
        if (camTween) {
          camTween.t = Math.min(1, camTween.t + 0.08);
          const e = 1 - Math.pow(1 - camTween.t, 3);
          setCamera({
            position: {
              x: camTween.fromX + (camTween.toX - camTween.fromX) * e,
              y: camTween.fromY + (camTween.toY - camTween.fromY) * e,
            },
            zoom: camTween.fromZoom + (camTween.toZoom - camTween.fromZoom) * e,
          });
          if (camTween.t >= 1) camTween = null;
        }

        // Physics is pure functions in src/lib/forceLayout — gravity +
        // repulsion + springs + damping/integrate, all mutating bodies
        // in place. The graphics resync below is the only PIXI-coupled
        // part of the tick.
        physicsStep(bodies, links, app.ticker.deltaMS / 1000, PHYSICS);

        for (const body of bodies) {
          body.node.position.set(cx + body.x, cy + body.y);
          if (body.halo) body.halo.position.set(cx + body.x, cy + body.y);
        }

        edges.clear();
        if (focusedAddress) {
          // Focus — the focused wallet's own bonds (a clean star) to its capped
          // top-N strongest neighbors (the time-filtered ego-set). Drawn full +
          // time-independent: you clicked to study this wallet's connections.
          const focusIdx = idxByAddr.get(focusedAddress);
          for (const link of links) {
            if (link.a !== focusIdx && link.b !== focusIdx) continue;
            const a = bodies[link.a];
            const b = bodies[link.b];
            if (
              !spotlightDistances.has(a.wallet.address) ||
              !spotlightDistances.has(b.wallet.address)
            ) {
              continue;
            }
            edges
              .moveTo(cx + a.x, cy + a.y)
              .lineTo(cx + b.x, cy + b.y)
              .stroke({ width: 0.8, color: 0xc28840, alpha: 0.85 });
          }
        } else {
          // Default — transient per-block edges: a bond appears at its real
          // formation block and fades out over EDGE_FADE_BLOCKS, then it's
          // gone. Only bonds formed within the fade window of the scrubber
          // render, so the frame is bounded — no persistent-hairball lag.
          for (const link of links) {
            const age = currentBlock - link.formationBlock;
            if (age < 0 || age >= EDGE_FADE_BLOCKS) continue;
            const a = bodies[link.a];
            const b = bodies[link.b];
            // Endpoints must be born/visible.
            if (a.node.alpha === 0 || b.node.alpha === 0) continue;
            let alpha = (1 - age / EDGE_FADE_BLOCKS) * EDGE_BASE_ALPHA;
            // Hover preview dims edges outside the hovered neighborhood.
            if (hoveredAddress) {
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
