'use client';

import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const app = new Application();
    let cancelled = false;

    void (async () => {
      await app.init({
        resizeTo: container,
        background: 0x0a0a0a,
        antialias: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      container.appendChild(app.canvas);

      const dot = new Graphics();
      dot
        .circle(app.screen.width / 2, app.screen.height / 2, 1)
        .fill(0xffd700);
      app.stage.addChild(dot);
    })();

    return () => {
      cancelled = true;
      app.destroy(true, { children: true });
    };
  }, []);

  return <div ref={containerRef} className="h-screen w-full" />;
}
