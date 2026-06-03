/**
 * Site-config — the only file that should differ between the Grid and Graph
 * repos in their shared layer (NavBar, SiteFooter, page.tsx, layout).
 *
 * Each companion project declares its own VIEW + companion-view pointer here;
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

export const OTHER_VIEW_BRAND = 'GRID';
export const OTHER_VIEW_DOMAIN = 'timechaingrid.com';
export const OTHER_VIEW_TAGLINE = "Bitcoin's digital real estate";
export const OTHER_VIEW_ACCENT = 'cyan' as const;
export const OTHER_VIEW_URL = `https://${OTHER_VIEW_DOMAIN}`;

export const BRAND_TAGLINE = 'Bitcoin Visualised';

/**
 * Footer cross-view callout. The topbar button is the canonical entry
 * point to the other view; the footer mention is optional context.
 * Graph keeps this true (a small mention at the bottom); Grid keeps
 * it false. The big home-page card has been removed from both —
 * topbar button is enough.
 */
export const SHOW_OTHER_VIEW_CALLOUTS = true;

export const SITE_URL = `https://${VIEW_DOMAIN}`;
export const SITE_TITLE = `Timechain ${VIEW_BRAND}`;
export const SITE_TITLE_FULL = `${BRAND_TAGLINE} — Timechain ${VIEW_BRAND}`;
export const SITE_DESCRIPTION =
  'Bitcoin Visualised. The living network — every wallet a neuron, every transaction a synapse. Public, privacy-first, no third-party scripts.';

/** Proper-case brand for prose ("Timechain Graph"). VIEW_BRAND is the
 *  stylised uppercase form; this is the readable one. Diverges Graph/Grid. */
export const VIEW_BRAND_NAME = 'Graph';

/**
 * Donation rails — Bitcoin-native, self-custodial (see /donate). The ONLY
 * operator receive identifiers; these MUST differ between Graph and Grid.
 * Self-custodial on-chain receipt needs no account, no KYC, no third party —
 * the regulatorily-cleanest path under Turkey's CASP regime (the weight there
 * is on custodians, not self-custody). Lightning arrives later via a
 * SELF-HOSTED node (BTCPay/LNbits), never a custodial service.
 *
 * ⚠️  DONATION_BTC_ADDRESS is a PLACEHOLDER. /donate detects the placeholder
 * and shows a "coming" state instead of a bogus address, so a wrong address
 * can never reach a donor. Replace with the real Graph on-chain receive
 * address (from any wallet you control) to go live.
 */
export const DONATION_BTC_ADDRESS = 'PLACEHOLDER_REPLACE_WITH_REAL_GRAPH_BTC_ADDRESS';
export const DONATION_LIGHTNING_ADDRESS = ''; // coming: self-hosted via BTCPay/LNbits
export const DONATION_LIVE =
  DONATION_BTC_ADDRESS.length > 0 && !DONATION_BTC_ADDRESS.includes('PLACEHOLDER');
