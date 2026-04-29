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
 * wants force layout — sister's Grid is stationary by design and won't
 * call these, but the lib lives in shared infrastructure.
 */

export interface PhysicsBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  pinned: boolean;
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
};

/** Pull each non-pinned body toward the origin, scaled by its mass. */
export function applyGravity(
  bodies: readonly PhysicsBody[],
  dt: number,
  k: number,
): void {
  for (const body of bodies) {
    if (body.pinned) continue;
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
    for (let j = i + 1; j < bodies.length; j++) {
      const bi = bodies[i];
      const bj = bodies[j];
      const dx = bj.x - bi.x;
      const dy = bj.y - bi.y;
      const distSq = dx * dx + dy * dy + 1; // +1 prevents div-by-zero blow-up
      const dist = Math.sqrt(distSq);
      const f = k / distSq;
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
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const stretch = dist - restLength;
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
    if (body.pinned) continue;
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
  applyRepulsion(bodies, clamped, params.repulsion);
  applySprings(bodies, links, clamped, params.springRest);
  integrate(bodies, clamped, params.damping);
}
