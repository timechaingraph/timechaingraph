/**
 * prefersReducedMotion — reads the user's OS/browser "reduce motion" setting.
 * SSR-safe (returns false when window/matchMedia is unavailable, e.g. static
 * prerender). Used to gate autoplay + freeze the graph sim (UX#3); the CSS
 * keyframe animations are gated separately via @media in globals.css.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
}
