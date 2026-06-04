import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { GraphView } from '../views/GraphView';

vi.mock('pixi.js', () => {
  class Application {
    canvas = Object.assign(document.createElement('canvas'), {
      style: { cursor: '' },
    });
    screen = { width: 800, height: 600 };
    stage = {
      addChild: vi.fn(),
      on: vi.fn(),
      eventMode: 'none' as string,
      hitArea: null as unknown,
    };
    ticker = { add: vi.fn(), deltaMS: 16 };
    // jsdom has no WebGL; the node renderer mocks generateTexture so the
    // shared-node-texture path doesn't throw during the async init.
    renderer = { generateTexture: vi.fn(() => ({ destroy: vi.fn() })) };
    init = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn();
  }
  class Container {
    position = { set: vi.fn(), x: 0, y: 0 };
    scale = { set: vi.fn(), x: 1, y: 1 };
    addChild = vi.fn();
  }
  class Graphics {
    eventMode: string = 'none';
    cursor: string = 'auto';
    hitArea: unknown = null;
    alpha: number = 1;
    position = { set: vi.fn() };
    circle() {
      return this;
    }
    fill() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    stroke() {
      return this;
    }
    clear() {
      return this;
    }
    on() {
      return this;
    }
    destroy() {}
  }
  // Nodes now render as shared-texture Sprites; mirror the interaction API
  // the GraphView handlers touch (anchor/scale/tint + events).
  class Sprite {
    eventMode: string = 'none';
    cursor: string = 'auto';
    hitArea: unknown = null;
    alpha: number = 1;
    tint: number = 0xffffff;
    anchor = { set: vi.fn() };
    scale = { set: vi.fn(), x: 1, y: 1 };
    position = { set: vi.fn() };
    constructor(_texture?: unknown) {}
    on() {
      return this;
    }
    destroy() {}
  }
  return { Application, Container, Graphics, Sprite };
});

describe('<GraphView>', () => {
  it('renders a container div without crashing', () => {
    const { container } = render(<GraphView />);
    expect(container.querySelector('div')).toBeTruthy();
  });
});
