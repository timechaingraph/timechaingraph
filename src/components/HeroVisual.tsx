/**
 * HeroVisual (Graph) — the view-specific inner art for the Graph landing,
 * dropped into the shared <HeroFrame/>: an Obsidian-style force-directed
 * wallet network with a Satoshi core.
 *
 * The frame (rings, notches, cogs, size, position) lives in HeroFrame and is
 * identical to Grid's. Only this inner art differs between the two repos —
 * Graph = network, Grid = tile lattice.
 *
 * Geometry is BAKED at build time (scripts/gen-hero-graph.mjs →
 * hero-graph-data.ts) so SSR + client render byte-identical positions (a live
 * force sim would diverge across JS engines and trigger hydration mismatch).
 */
import { HeroFrame } from './HeroFrame';
import { HERO_NODES, HERO_EDGES } from './hero-graph-data';

const CENTER = 220; // matches HeroFrame SIZE/2

/* Scrub timing — each leaf/edge loops on a slightly different period so the
 * network reshapes continuously, like scrubbing the live graph across chain
 * time. Edge.d carries its leaf endpoint's bucket, so edge + node stay synced. */
const scrubDur = (d: number) => 12 + (d % 4); // 12–15s
const scrubDelay = (d: number) => +(d * 0.8).toFixed(2);

export function HeroVisual() {
  return (
    <HeroFrame ariaLabel="Timechain Graph: a brass-framed force-directed network of Bitcoin wallets — Satoshi at the gold core, hub wallets ringed around it, leaf wallets connected by transaction edges that fade in and out as the graph scrubs through chain time.">
      {/* Edges — the synapses. Backbone stays lit; leaf edges scrub with their wallet. */}
      <g>
        {HERO_EDGES.map((e, i) => {
          const a = HERO_NODES[e.a];
          const b = HERO_NODES[e.b];
          const scrub = e.bb === 0;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={`rgba(224, 166, 86, ${e.bb ? 0.42 : 0.34})`}
              strokeWidth={e.bb ? 1.1 : 0.85}
              style={scrub ? { animation: `edge-scrub ${scrubDur(e.d)}s ease-in-out ${scrubDelay(e.d)}s infinite` } : undefined}
            />
          );
        })}
      </g>

      {/* Nodes (Satoshi drawn separately, last) */}
      {HERO_NODES.map((n, i) => {
        if (n.k === 2) return null;
        const scrub = n.p === 0;
        const isHub = n.k === 1;
        return (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={isHub ? 'rgba(232, 192, 40, 0.92)' : 'rgba(224, 166, 86, 0.62)'}
            filter={isHub ? 'url(#node-glow)' : undefined}
            style={
              scrub
                ? {
                    animation: `node-scrub ${scrubDur(n.d)}s ease-in-out ${scrubDelay(n.d)}s infinite`,
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }
                : { animation: `pulse-node ${3 + (n.d % 3)}s ease-in-out ${(n.d * 0.2).toFixed(2)}s infinite` }
            }
          />
        );
      })}

      {/* Satoshi anchor — contained glow + brass bezel + breathing core */}
      <circle cx={CENTER} cy={CENTER} r={24} fill="url(#satoshi-glow-outer)" />
      <circle cx={CENTER} cy={CENTER} r={16} fill="url(#satoshi-glow)" />
      <circle cx={CENTER} cy={CENTER} r={9} fill="none" stroke="url(#brass-grad)" strokeWidth={1.5} opacity={0.95} />
      <circle cx={CENTER} cy={CENTER} r={5} fill="rgb(255, 215, 0)" filter="url(#node-glow)" style={{ animation: 'pulse-satoshi 3.2s ease-in-out infinite' }} />
    </HeroFrame>
  );
}
