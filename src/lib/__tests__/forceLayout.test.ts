import { describe, it, expect } from 'vitest';
import {
  applyGravity,
  applyRepulsion,
  applySprings,
  integrate,
  step,
  DEFAULT_PHYSICS,
  type PhysicsBody,
  type PhysicsLink,
} from '../forceLayout';

function makeBody(over: Partial<PhysicsBody> = {}): PhysicsBody {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    mass: 1,
    pinned: false,
    ...over,
  };
}

describe('forceLayout — applyGravity', () => {
  it('pulls non-pinned bodies toward origin', () => {
    const body = makeBody({ x: 100, y: 50 });
    applyGravity([body], 1, 0.1);
    expect(body.vx).toBeLessThan(0);
    expect(body.vy).toBeLessThan(0);
  });

  it('does not touch pinned bodies', () => {
    const body = makeBody({ x: 100, y: 50, pinned: true });
    applyGravity([body], 1, 0.1);
    expect(body.vx).toBe(0);
    expect(body.vy).toBe(0);
  });

  it('scales linearly with mass', () => {
    const light = makeBody({ x: 100, mass: 1 });
    const heavy = makeBody({ x: 100, mass: 10 });
    applyGravity([light, heavy], 1, 0.01);
    expect(Math.abs(heavy.vx)).toBeCloseTo(Math.abs(light.vx) * 10, 5);
  });

  it('does nothing to a body at the origin', () => {
    const body = makeBody({ x: 0, y: 0, vx: 0, vy: 0 });
    applyGravity([body], 1, 0.1);
    expect(body.vx).toBe(0);
    expect(body.vy).toBe(0);
  });
});

describe('forceLayout — applyRepulsion', () => {
  it('pushes a colinear pair apart along the line connecting them', () => {
    const a = makeBody({ x: 0, y: 0 });
    const b = makeBody({ x: 10, y: 0 });
    applyRepulsion([a, b], 1, 100);
    expect(a.vx).toBeLessThan(0); // pushed left (away from b)
    expect(b.vx).toBeGreaterThan(0); // pushed right
    expect(Math.abs(a.vy)).toBeLessThan(1e-9);
    expect(Math.abs(b.vy)).toBeLessThan(1e-9);
  });

  it('skips pinned bodies but still pushes the un-pinned partner', () => {
    const a = makeBody({ x: 0, y: 0, pinned: true });
    const b = makeBody({ x: 10, y: 0 });
    applyRepulsion([a, b], 1, 100);
    expect(a.vx).toBe(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('produces opposite forces on the pair (Newton 3rd)', () => {
    const a = makeBody({ x: 0, y: 0 });
    const b = makeBody({ x: 10, y: 0 });
    applyRepulsion([a, b], 1, 100);
    expect(a.vx).toBeCloseTo(-b.vx, 9);
  });
});

describe('forceLayout — applySprings', () => {
  it('pulls a stretched bond back together', () => {
    const a = makeBody({ x: 0, y: 0 });
    const b = makeBody({ x: 200, y: 0 }); // far past rest length 80
    const link: PhysicsLink = { a: 0, b: 1, strength: 0.01 };
    applySprings([a, b], [link], 1, 80);
    expect(a.vx).toBeGreaterThan(0); // pulled toward b
    expect(b.vx).toBeLessThan(0); // pulled toward a
  });

  it('pushes a compressed bond apart', () => {
    const a = makeBody({ x: 0, y: 0 });
    const b = makeBody({ x: 20, y: 0 }); // way under rest length 80
    const link: PhysicsLink = { a: 0, b: 1, strength: 0.01 };
    applySprings([a, b], [link], 1, 80);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('does nothing when bond is at exact rest length', () => {
    const a = makeBody({ x: 0, y: 0 });
    const b = makeBody({ x: 80, y: 0 });
    const link: PhysicsLink = { a: 0, b: 1, strength: 1 };
    applySprings([a, b], [link], 1, 80);
    // Tiny non-zero from the +0.01 distance hedge, but effectively zero
    expect(Math.abs(a.vx)).toBeLessThan(0.05);
    expect(Math.abs(b.vx)).toBeLessThan(0.05);
  });

  it('respects pinned bodies on either end', () => {
    const a = makeBody({ x: 0, y: 0, pinned: true });
    const b = makeBody({ x: 200, y: 0 });
    const link: PhysicsLink = { a: 0, b: 1, strength: 0.01 };
    applySprings([a, b], [link], 1, 80);
    expect(a.vx).toBe(0);
    expect(b.vx).toBeLessThan(0);
  });
});

describe('forceLayout — integrate', () => {
  it('damps velocity and updates position', () => {
    const body = makeBody({ x: 0, y: 0, vx: 100, vy: 0 });
    integrate([body], 1, 0.5);
    expect(body.vx).toBe(50);
    expect(body.x).toBe(50);
  });

  it('skips pinned bodies entirely', () => {
    const body = makeBody({ x: 5, y: 5, vx: 100, vy: 100, pinned: true });
    integrate([body], 1, 0.5);
    expect(body.x).toBe(5);
    expect(body.y).toBe(5);
    expect(body.vx).toBe(100);
    expect(body.vy).toBe(100);
  });
});

describe('forceLayout — step', () => {
  it('clamps dt to maxStep so a giant gap doesn’t blow the integration', () => {
    const body = makeBody({ x: 100 });
    step([body], [], 999, DEFAULT_PHYSICS);
    // Without clamping, the body would have flown miles. With dt
    // capped at 1/30s the displacement stays bounded.
    expect(Math.abs(body.x - 100)).toBeLessThan(50);
  });

  it('moves a single body toward origin over many ticks under default physics', () => {
    const body = makeBody({ x: 100 });
    for (let i = 0; i < 200; i++) step([body], [], 1 / 60);
    expect(Math.abs(body.x)).toBeLessThan(100);
  });

  it('does not blow up a two-body bonded pair — system reaches near-rest', () => {
    const a = makeBody({ x: -50, y: 0 });
    const b = makeBody({ x: 50, y: 0 });
    const link: PhysicsLink = { a: 0, b: 1, strength: 0.05 };
    for (let i = 0; i < 500; i++) step([a, b], [link], 1 / 60);
    // System should converge near origin (gravity wins) with finite velocities
    expect(Math.abs(a.vx)).toBeLessThan(10);
    expect(Math.abs(b.vx)).toBeLessThan(10);
    expect(Number.isFinite(a.x)).toBe(true);
    expect(Number.isFinite(b.x)).toBe(true);
  });
});
