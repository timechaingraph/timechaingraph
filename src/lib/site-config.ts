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
export const VIEW_TAGLINE = 'the living network of Bitcoin';
export const VIEW_ACCENT = 'gold' as const;

export const VIEW_HERO_TOP = 'The brain';
export const VIEW_HERO_BOTTOM = 'of Bitcoin.';
export const VIEW_HERO_DESCRIPTION =
  'Bitcoin has been thinking in public for sixteen years. Until now, only specialists could read it. Timechain Graph is the lens — every wallet a neuron, every transaction a synapse, the whole network legible in a browser. Public ledger, public view. No one watches you watch.';

export const SISTER_BRAND = 'GRID';
export const SISTER_DOMAIN = 'timechaingrid.com';
export const SISTER_TAGLINE = "Bitcoin's digital real estate";
export const SISTER_ACCENT = 'cyan' as const;
export const SISTER_URL = `https://${SISTER_DOMAIN}`;

export const BRAND_TAGLINE = 'Bitcoin Visualised';

/**
 * Show sister-project callouts (sister link in footer, "two views" copy).
 * Graph keeps the dual-domain framing visible — the network and the lattice
 * are mutual; visitors who land on Graph benefit from knowing Grid exists,
 * and vice versa. Sister chose `false` for Grid's self-contained reset.
 */
export const SHOW_SISTER_CALLOUTS = true;

export const SITE_URL = `https://${VIEW_DOMAIN}`;
export const SITE_TITLE = `Timechain ${VIEW_BRAND}`;
export const SITE_TITLE_FULL = `${BRAND_TAGLINE} — Timechain ${VIEW_BRAND}`;
export const SITE_DESCRIPTION =
  'Bitcoin Visualised. The living network — every wallet a neuron, every transaction a synapse. Public, privacy-first, no third-party scripts.';
