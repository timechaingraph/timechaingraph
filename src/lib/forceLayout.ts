/**
 * forceLayout — pure-function physics for the force-directed lattice.
 *
 * Velocity-Verlet integration with three contributing force fields:
 *   - Gravity:    radial pull toward origin, scaled by body mass
 *   - Repulsion:  pairwise inverse-square push (Coulomb-like), O(n²)
 *   - Springs:    Hooke per link with configurable rest length + per-link stiffness
 *
 * Each function mutates the bodies / links arrays in place — that's the
 * hot-path contract for the canvas tick loop. None of these functions
 * touch PIXI or the DOM; they're pure numerics suitable for unit testing
 * and for drop-in replacement (e.g., quad-tree Barnes-Hut for the 10k+
 * scale once the BitcoinChainAdapter ships real free-tier data).
 *
 * Used by GraphView's render tick. Could be reused by any view that
 * wants force layout — the Grid view is stationary by design and won't
 * call these, but the lib lives in shared infrastructure.
 */

export interface PhysicsBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  pinned: boolean;
  /**
   * Repulsion weight (default 1). Higher = pushes others harder, so big hubs
   * claim more space and spread apart instead of clumping. Consulted by both
   * the O(n²) and Barnes-Hut repulsion as the per-body "charge".
   */
  charge?: number;
  /**
   * Per-node spring-force scale (default 1). < 1 caps how hard this node is
   * pulled by ITS springs — set to ~1/√(degree) so a mega-hub bonded to
   * hundreds of wallets isn't dragged into their centroid (the central-clump
   * fix). Applied per endpoint, so leaves still attach fully to their hub.
   */
  springScale?: number;
  /**
   * When true the body is excluded from the simulation entirely — no gravity,
   * repulsion (as source or target), or springs. Used for pre-birth nodes so
   * invisible wallets don't distort the visible layout. Default false.
   */
  inactive?: boolean;
}

export interface PhysicsLink {
  /** Index into the bodies array. */
  a: number;
  /** Index into the bodies array. */
  b: number;
  /** Per-link spring stiffness (already includes log-of-sats scaling at construction). */
  strength: number;
}

export interface PhysicsParams {
  /** Pull-toward-origin coefficient. Larger = tighter cluster. */
  gravity: number;
  /** Pairwise repulsion coefficient. Larger = more spacing between non-bonded nodes. */
  repulsion: number;
  /** Hooke rest length in pixels. */
  springRest: number;
  /** Velocity multiplier each tick. < 1 to bleed energy and reach equilibrium. */
  damping: number;
  /** Upper bound on dt in seconds — protects against tab-resume spikes. */
  maxStep: number;
  /**
   * Barnes-Hut opening angle ∈ (0,1]. A quad-tree cell is treated as a single
   * pseudo-body when cellSize/distance < theta. Smaller = more accurate +
   * slower; 0 would degenerate to exact O(n²). Only consulted for graphs above
   * BH_THRESHOLD. Defaults to 0.7 when omitted.
   */
  theta?: number;
}

/**
 * Default physics parameters tuned for ~50 nodes + ~80 bonds. Larger
 * graphs will need different damping + repulsion balance; treat these
 * as a starting point, not a universal.
 */
export const DEFAULT_PHYSICS: PhysicsParams = {
  gravity: 0.04,
  repulsion: 600,
  springRest: 80,
  damping: 0.86,
  maxStep: 1 / 30,
  theta: 0.7,
};

/**
 * Above this body count, step() swaps the O(n²) applyRepulsion for the
 * O(n log n) Barnes-Hut approximation. Below it, the exact pairwise force is
 * cheaper than building a tree (and keeps small graphs bit-for-bit identical).
 */
export const BH_THRESHOLD = 512;

/** Pull each non-pinned body toward the origin, scaled by its mass. */
export function applyGravity(
  bodies: readonly PhysicsBody[],
  dt: number,
  k: number,
): void {
  for (const body of bodies) {
    if (body.pinned || body.inactive) continue;
    body.vx += -body.x * k * body.mass * dt;
    body.vy += -body.y * k * body.mass * dt;
  }
}

/**
 * Pairwise inverse-square repulsion. O(n²) — fine at fixture scale.
 * Replace with Barnes-Hut quad-tree decomposition once the body count
 * approaches the 10k free-tier target.
 */
export function applyRepulsion(
  bodies: readonly PhysicsBody[],
  dt: number,
  k: number,
): void {
  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i];
    if (bi.inactive) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const bj = bodies[j];
      if (bj.inactive) continue;
      const dx = bj.x - bi.x;
      const dy = bj.y - bi.y;
      const distSq = dx * dx + dy * dy + 1; // +1 prevents div-by-zero blow-up
      const dist = Math.sqrt(distSq);
      const ux = dx / dist;
      const uy = dy / dist;
      // Force on each body scales by the OTHER body's charge (a big hub pushes
      // its neighbors harder). charge defaults to 1 → identical to the old law.
      if (!bi.pinned) {
        const f = (k * (bj.charge ?? 1)) / distSq;
        bi.vx -= ux * f * dt;
        bi.vy -= uy * f * dt;
      }
      if (!bj.pinned) {
        const f = (k * (bi.charge ?? 1)) / distSq;
        bj.vx += ux * f * dt;
        bj.vy += uy * f * dt;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Barnes-Hut quad-tree repulsion — O(n log n) approximation of applyRepulsion.
//
// applyRepulsion is O(n²): fine to a few hundred bodies, but the free tier is
// ~10k nodes. Barnes-Hut groups distant bodies into their centroid and applies
// one aggregated push when a cell is "far enough" (cellSize/distance < theta).
// Because the underlying repulsion is mass-INDEPENDENT (f = k/dist² per body),
// a cell's aggregate "charge" is its body COUNT and its centroid is unweighted
// — so this converges to the exact pairwise force as theta → 0.
// ---------------------------------------------------------------------------

interface QuadNode {
  x0: number;
  y0: number;
  size: number;
  cx: number; // running charge-weighted centroid
  cy: number;
  charge: number; // sum of body charges in this cell (the repulsion weight)
  count: number; // body count (leaf detection + emptiness)
  body: number; // body index if this is a single-body leaf, else -1
  children: (QuadNode | null)[] | null; // [SW, SE, NW, NE] once subdivided
}

const BH_MIN_CELL = 1e-3; // stop subdividing below this cell size
const BH_MAX_DEPTH = 48; // hard recursion bound for near-coincident bodies

function bhNode(x0: number, y0: number, size: number): QuadNode {
  return { x0, y0, size, cx: 0, cy: 0, charge: 0, count: 0, body: -1, children: null };
}

/** Build a quad-tree over all bodies. Returns null for empty input. */
export function buildQuadTree(bodies: readonly PhysicsBody[]): QuadNode | null {
  if (bodies.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of bodies) {
    if (b.inactive) continue;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x > maxX) maxX = b.x;
    if (b.y > maxY) maxY = b.y;
  }
  if (minX === Infinity) return null; // every body inactive — nothing to build
  // Square root cell covering all bodies (slight pad avoids exact edge ties).
  const size = Math.max(maxX - minX, maxY - minY, 1) * 1.0001;
  const root = bhNode(minX, minY, size);

  const placeInChild = (
    node: QuadNode,
    i: number,
    x: number,
    y: number,
    depth: number,
  ): void => {
    const h = node.size / 2;
    const qx = x >= node.x0 + h ? 1 : 0;
    const qy = y >= node.y0 + h ? 1 : 0;
    const q = (qy << 1) | qx;
    let child = node.children![q];
    if (!child) {
      child = bhNode(node.x0 + qx * h, node.y0 + qy * h, h);
      node.children![q] = child;
    }
    insert(child, i, x, y, depth + 1);
  };

  const insert = (
    node: QuadNode,
    i: number,
    x: number,
    y: number,
    depth: number,
  ): void => {
    // Fold body i into this cell's running charge-weighted centroid.
    const c = bodies[i].charge ?? 1;
    node.cx = (node.cx * node.charge + x * c) / (node.charge + c);
    node.cy = (node.cy * node.charge + y * c) / (node.charge + c);
    node.charge += c;
    node.count += 1;

    if (node.count === 1) {
      node.body = i; // first body in this cell — it's a leaf
      return;
    }
    // >1 body: make the cell internal — unless it's too small/deep, in which
    // case it stays a "fat leaf" (many near-coincident bodies as one centroid).
    if (node.children === null) {
      if (node.size <= BH_MIN_CELL || depth >= BH_MAX_DEPTH) {
        node.body = -1;
        return;
      }
      node.children = [null, null, null, null];
      if (node.body >= 0) {
        const ob = node.body;
        node.body = -1;
        placeInChild(node, ob, bodies[ob].x, bodies[ob].y, depth);
      }
    }
    placeInChild(node, i, x, y, depth);
  };

  for (let i = 0; i < bodies.length; i++) {
    if (bodies[i].inactive) continue;
    insert(root, i, bodies[i].x, bodies[i].y, 0);
  }
  return root;
}

/**
 * Barnes-Hut repulsion: for each non-pinned body, walk the quad-tree and sum
 * the push from every other body, approximating far cells by their centroid.
 * Matches applyRepulsion's force law (k * charge / dist², mass-independent),
 * so it is a drop-in replacement for large graphs. theta ∈ (0,1]; smaller is
 * more accurate. Pinned bodies are skipped (they don't move) but still act as
 * repulsion sources, exactly as in applyRepulsion.
 */
export function applyRepulsionBarnesHut(
  bodies: readonly PhysicsBody[],
  dt: number,
  k: number,
  theta = 0.7,
): void {
  const root = buildQuadTree(bodies);
  if (!root) return;
  const thetaSq = theta * theta;
  const stack: QuadNode[] = []; // reused across bodies to avoid per-body GC

  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i];
    if (bi.pinned || bi.inactive) continue;
    let fx = 0;
    let fy = 0;
    stack.length = 0;
    stack.push(root);
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.count === 0) continue;
      const dx = node.cx - bi.x;
      const dy = node.cy - bi.y;
      const distSq = dx * dx + dy * dy + 1; // +1 matches applyRepulsion's hedge
      const isLeaf = node.children === null;
      // Open the cell only if it's an internal node that's too close/large.
      if (!isLeaf && (node.size * node.size) / distSq >= thetaSq) {
        const c = node.children!;
        if (c[0]) stack.push(c[0]);
        if (c[1]) stack.push(c[1]);
        if (c[2]) stack.push(c[2]);
        if (c[3]) stack.push(c[3]);
        continue;
      }
      if (isLeaf && node.body === i) continue; // don't repel self
      // Aggregate push from this (pseudo-)body: sum of charges at the centroid.
      const dist = Math.sqrt(distSq);
      const f = (k * node.charge) / distSq;
      fx -= (dx / dist) * f;
      fy -= (dy / dist) * f;
    }
    bi.vx += fx * dt;
    bi.vy += fy * dt;
  }
}

/**
 * Hooke spring force per link. Stretch beyond rest → pulls endpoints
 * together; compression below rest → pushes them apart. Per-link
 * `strength` lets caller weight by transaction frequency or sat amount.
 */
export function applySprings(
  bodies: readonly PhysicsBody[],
  links: readonly PhysicsLink[],
  dt: number,
  restLength: number,
): void {
  for (const link of links) {
    const a = bodies[link.a];
    const b = bodies[link.b];
    if (a.inactive || b.inactive) continue; // skip springs to pre-birth nodes
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const stretch = dist - restLength;
    const ux = dx / dist;
    const uy = dy / dist;
    const f = stretch * link.strength;
    // Scale per endpoint by its springScale (default 1) so high-degree hubs
    // aren't dragged into their many neighbors' centroid.
    if (!a.pinned) {
      const fa = f * (a.springScale ?? 1);
      a.vx += ux * fa * dt;
      a.vy += uy * fa * dt;
    }
    if (!b.pinned) {
      const fb = f * (b.springScale ?? 1);
      b.vx -= ux * fb * dt;
      b.vy -= uy * fb * dt;
    }
  }
}

/**
 * Damp velocities and integrate position. Pinned bodies skip both —
 * their position is the authoritative source (set externally e.g. by
 * a drag handler or scrubber pin).
 */
export function integrate(
  bodies: readonly PhysicsBody[],
  dt: number,
  damping: number,
): void {
  for (const body of bodies) {
    if (body.pinned || body.inactive) continue;
    body.vx *= damping;
    body.vy *= damping;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }
}

/**
 * One full simulation tick — gravity, repulsion, springs, damping +
 * integration in that order. dt is clamped to params.maxStep before
 * any force is applied (large dt blows up Verlet integration).
 */
export function step(
  bodies: readonly PhysicsBody[],
  links: readonly PhysicsLink[],
  dt: number,
  params: PhysicsParams = DEFAULT_PHYSICS,
): void {
  const clamped = Math.min(dt, params.maxStep);
  applyGravity(bodies, clamped, params.gravity);
  if (bodies.length > BH_THRESHOLD) {
    applyRepulsionBarnesHut(bodies, clamped, params.repulsion, params.theta ?? 0.7);
  } else {
    applyRepulsion(bodies, clamped, params.repulsion);
  }
  applySprings(bodies, links, clamped, params.springRest);
  integrate(bodies, clamped, params.damping);
}
