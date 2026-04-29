import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { GraphView } from '../views/GraphView';

vi.mock('pixi.js', () => {
  class Application {
    canvas = document.createElement('canvas');
    screen = { width: 800, height: 600 };
    stage = {
      addChild: vi.fn(),
      on: vi.fn(),
      eventMode: 'none' as string,
      hitArea: null as unknown,
    };
    ticker = { add: vi.fn(), deltaMS: 16 };
    init = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn();
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
  }
  return { Application, Graphics };
});

describe('<GraphView>', () => {
  it('renders a container div without crashing', () => {
    const { container } = render(<GraphView />);
    expect(container.querySelector('div')).toBeTruthy();
  });
});
