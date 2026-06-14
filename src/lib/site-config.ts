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

export const VIEW_HERO_TOP = 'Timechain Graph';
export const VIEW_HERO_BOTTOM = 'of Bitcoin.';
export const VIEW_HERO_DESCRIPTION =
  '“Timechain” was Satoshi’s name for the blockchain — a chain of timestamped blocks. Here it is, the living network it always was: every wallet a node, every transaction an edge, the ledger legible in your browser. Public to watch, private to use.';

export const OTHER_VIEW_BRAND = 'GRID';
export const OTHER_VIEW_DOMAIN = 'timechaingrid.com';
export const OTHER_VIEW_TAGLINE = "Bitcoin's digital real estate";
export const OTHER_VIEW_ACCENT = 'gold' as const;
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
  'The Timechain Graph — Satoshi’s name for the blockchain, drawn as a living network. Every wallet a node, every transaction an edge. Public, privacy-first, no third-party scripts.';

/** Proper-case brand for prose ("Timechain Graph"). VIEW_BRAND is the
 *  stylised uppercase form; this is the readable one. Diverges Graph/Grid. */
export const VIEW_BRAND_NAME = 'Graph';

/**
 * Donation rails — Bitcoin-native, self-custodial (see /donate). The ONLY
 * operator receive identifier; Grid intentionally shares this SAME address
 * (one Sparrow wallet collects for both sites — operator decision 2026-06-05).
 * Self-custodial on-chain receipt needs no account, no KYC, no third party —
 * the regulatorily-cleanest path under Turkey's CASP regime (the weight there
 * is on custodians, not self-custody). Lightning arrives later via a
 * SELF-HOSTED node (BTCPay/LNbits), never a custodial service.
 *
 * DONATION_BTC_ADDRESS is the live, verified operator receive address —
 * a native segwit (bech32) address the operator controls. Because it is a
 * real address (not a placeholder), DONATION_LIVE evaluates true, so /donate
 * renders the address plus its QR rather than a "coming" state.
 */
export const DONATION_BTC_ADDRESS = 'bc1q2hhsxyuzj4e6wcjegayddjphdry02wdef9v62l';
export const DONATION_LIGHTNING_ADDRESS = ''; // coming: self-hosted via BTCPay/LNbits
export const DONATION_LIVE =
  DONATION_BTC_ADDRESS.length > 0 && !DONATION_BTC_ADDRESS.includes('PLACEHOLDER');

/**
 * Contact + social. Per-site support mailbox (operator provisions it). Social
 * handles are EMPTY until the accounts exist — each footer link renders only
 * when its handle is set, so going live is a one-line edit here (no code change,
 * same gating idea as DONATION_LIVE). These MUST diverge between Graph and Grid.
 * Typed `: string` so the "is it set?" conditionals aren't constant-folded.
 */
export const SUPPORT_EMAIL: string = 'support@timechaingraph.com';
export const X_HANDLE: string = 'TimechainGraph'; // x.com/TimechainGraph (no @)
export const NOSTR_NPUB: string = 'npub12ynwkvuxjxv5qjqpzn3gsrvvfaydafjwfhsved2y6du6u3462pgs6sp0au'; // @TimechainGraph; footer → njump.me/<npub>; verifies as timechaingraph.com via /.well-known/nostr.json
export const GITHUB_URL: string = 'https://github.com/timechaingraph/timechaingraph'; // set once repo is public

export interface SocialLink {
  label: string;
  href: string;
  icon: 'mail' | 'github' | 'x' | 'nostr';
}
/** Configured socials only, in display order (mail → github → X → nostr). */
export const SOCIAL_LINKS: SocialLink[] = [
  ...(SUPPORT_EMAIL ? [{ label: 'Email', href: `mailto:${SUPPORT_EMAIL}`, icon: 'mail' as const }] : []),
  ...(GITHUB_URL ? [{ label: 'GitHub', href: GITHUB_URL, icon: 'github' as const }] : []),
  ...(X_HANDLE ? [{ label: 'X', href: `https://x.com/${X_HANDLE}`, icon: 'x' as const }] : []),
  ...(NOSTR_NPUB ? [{ label: 'Nostr', href: `https://njump.me/${NOSTR_NPUB}`, icon: 'nostr' as const }] : []),
];
