import { describe, it, expect } from 'vitest';
import {
  chainToVisual,
  visualToChain,
  makeCoordMap,
  DEFAULT_CHAIN_GRID_MIN,
  DEFAULT_CHAIN_GRID_MAX,
  DEFAULT_VISUAL_HALF,
} from '../coords';

describe('default chainToVisual', () => {
  it('maps origin to origin', () => {
    expect(chainToVisual(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('maps the lower-left corner to (-visualHalf, -visualHalf)', () => {
    expect(chainToVisual(DEFAULT_CHAIN_GRID_MIN, DEFAULT_CHAIN_GRID_MIN)).toEqual({
      x: -DEFAULT_VISUAL_HALF,
      y: -DEFAULT_VISUAL_HALF,
    });
  });

  it('maps the upper-right corner to (+visualHalf, +visualHalf)', () => {
    expect(chainToVisual(DEFAULT_CHAIN_GRID_MAX, DEFAULT_CHAIN_GRID_MAX)).toEqual({
      x: DEFAULT_VISUAL_HALF,
      y: DEFAULT_VISUAL_HALF,
    });
  });
});

describe('default visualToChain', () => {
  it('maps origin to origin', () => {
    expect(visualToChain(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('maps (-visualHalf, -visualHalf) to the chain-grid lower bound', () => {
    expect(visualToChain(-DEFAULT_VISUAL_HALF, -DEFAULT_VISUAL_HALF)).toEqual({
      x: DEFAULT_CHAIN_GRID_MIN,
      y: DEFAULT_CHAIN_GRID_MIN,
    });
  });

  it('rounds to the nearest integer chain coordinate', () => {
    // halfway between two chain cells should land on one of them
    const result = visualToChain(0.1, 0.1);
    expect(Number.isInteger(result.x)).toBe(true);
    expect(Number.isInteger(result.y)).toBe(true);
  });
});

describe('round-trip chainToVisual ↔ visualToChain', () => {
  it('preserves integer chain coords through a round trip', () => {
    const cases = [
      { x: 0, y: 0 },
      { x: 100, y: -200 },
      { x: -3240, y: 3240 },
      { x: 1234, y: -567 },
    ];
    for (const c of cases) {
      const v = chainToVisual(c.x, c.y);
      expect(visualToChain(v.x, v.y)).toEqual(c);
    }
  });
});

describe('makeCoordMap with custom config', () => {
  it('honors a custom chain grid span', () => {
    const map = makeCoordMap({ chainGridMin: 0, chainGridSpan: 100, visualHalf: 50 });
    expect(map.chainToVisual(0, 0)).toEqual({ x: -50, y: -50 });
    expect(map.chainToVisual(100, 100)).toEqual({ x: 50, y: 50 });
    expect(map.chainToVisual(50, 50)).toEqual({ x: 0, y: 0 });
  });

  it('round-trips with custom config', () => {
    const map = makeCoordMap({ chainGridMin: 0, chainGridSpan: 100, visualHalf: 50 });
    const v = map.chainToVisual(42, 17);
    expect(map.visualToChain(v.x, v.y)).toEqual({ x: 42, y: 17 });
  });
});
