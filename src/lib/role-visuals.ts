import type { WalletRole } from '@/types/wallet';

/**
 * Role → visual encoding. Shared between Grid (PixiJS dots) and Graph
 * (PixiJS force-directed nodes) because the color identity of a role
 * is the same whichever geometry we render.
 *
 *   ROLE_COLOR  — hex int for PIXI.Graphics.fill()
 *   ROLE_CSS    — CSS string for HTML overlays (WalletInspector etc.)
 *   ROLE_RADIUS — base px radius (each view may scale further)
 *   ROLE_LABEL  — human-readable display name
 *
 * Both repos consume this file 1:1; it is a shared-path file. Edit
 * here and propagate via `bash scripts/sync-sibling.sh --pull` on the
 * other side.
 */

export const ROLE_COLOR: Record<WalletRole, number> = {
  satoshi: 0xc28840, // brass — anchor at origin
  miner: 0xef4444, // red
  whale: 0xffd700, // gold
  significant: 0x00d4ff, // cyan
  dust: 0x64748b, // grey
};

export const ROLE_CSS: Record<WalletRole, string> = {
  satoshi: '#C28840',
  miner: '#EF4444',
  whale: '#FFD700',
  significant: '#00D4FF',
  dust: '#64748B',
};

export const ROLE_RADIUS: Record<WalletRole, number> = {
  satoshi: 4,
  miner: 2.5,
  whale: 3,
  significant: 2,
  dust: 1.5,
};

export const ROLE_LABEL: Record<WalletRole, string> = {
  satoshi: 'Satoshi',
  miner: 'Miner',
  whale: 'Whale',
  significant: 'Significant',
  dust: 'Dust',
};
