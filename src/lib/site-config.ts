/**
 * Site-config — the only file that should differ between the Grid and Graph
 * repos in their shared layer (NavBar, SiteFooter, page.tsx, layout).
 *
 * Each sibling project declares its own VIEW + sister-domain pointer here;
 * everything downstream reads from these constants so the components remain
 * byte-identical between the two repos. To keep the repos in sync,
 * components and pages are copied 1:1 — only this file diverges.
 */

export type ViewId = 'grid' | 'graph';

export const VIEW: ViewId = 'graph';

export const VIEW_BRAND = 'GRAPH';
export const VIEW_DOMAIN = 'timechaingraph.com';
export const VIEW_TAGLINE = 'a force-directed Obsidian-style graph of Bitcoin';
export const VIEW_ACCENT = 'gold' as const;

export const VIEW_HERO_TOP = 'Bitcoin,';
export const VIEW_HERO_BOTTOM = 'as a graph.';
export const VIEW_HERO_DESCRIPTION =
  'A force-directed lattice in the Obsidian vault style. Position emerges from transaction frequency, edges fade across the next ten blocks, hubs swell with degree centrality. Miners glow red, whales gold, dust grey. Satoshi at the brass-gold center.';

export const SISTER_BRAND = 'GRID';
export const SISTER_DOMAIN = 'timechaingrid.com';
export const SISTER_TAGLINE = 'a stationary node grid of Bitcoin';
export const SISTER_ACCENT = 'cyan' as const;
export const SISTER_URL = `https://${SISTER_DOMAIN}`;

export const BRAND_TAGLINE = 'Bitcoin Visualised';

/**
 * Show sister-project callouts (sister link in footer, "two views" copy).
 * Set to true on Graph since the brain-vault narrative is mutual: graph
 * surfaces wallets-as-neurons, grid surfaces coins-as-real-estate, and
 * each is enriched by the other. Sister chose `false` for Grid's reset
 * to a self-contained "Bitcoin's digital real estate" narrative.
 */
export const SHOW_SISTER_CALLOUTS = true;

export const SITE_URL = `https://${VIEW_DOMAIN}`;
export const SITE_TITLE = `Timechain ${VIEW_BRAND}`;
export const SITE_TITLE_FULL = `${BRAND_TAGLINE} — Timechain ${VIEW_BRAND}`;
export const SITE_DESCRIPTION =
  'Bitcoin Visualised. Force-directed Obsidian-style graph of every economically significant Bitcoin wallet. Position emerges from transaction frequency. Public, privacy-first, no third-party scripts.';
