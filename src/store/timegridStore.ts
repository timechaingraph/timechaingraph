import { create } from 'zustand';
import type { GridPosition } from '@/types/lattice';

type DockPanelId = 'block-stats' | 'wallet-inspector' | 'epoch-jumps' | null;

interface TimegridState {
  // Time scrubber
  /** Current block height the lattice is rendering. */
  currentBlock: number;
  setCurrentBlock(height: number): void;

  /** Highest block known to the adapter (live tail updates this). */
  latestBlock: number;
  setLatestBlock(height: number): void;

  // Selection
  selectedWallet: string | null;
  setSelectedWallet(address: string | null): void;

  // Dock panel (right sidebar)
  activeDockPanel: DockPanelId;
  setActiveDockPanel(id: DockPanelId): void;

  // Camera
  camera: { position: GridPosition; zoom: number };
  setCamera(camera: { position: GridPosition; zoom: number }): void;

  // Playback — auto-advancement of currentBlock. Lifted to the store
  // so canvas + scrubber + halving-timeline interactions can pause
  // the auto-advance without coupling to the Playback component.
  playbackPlaying: boolean;
  setPlaybackPlaying(playing: boolean): void;
  /** Index into the SPEED_OPTIONS array in Playback.tsx. */
  playbackSpeedIdx: number;
  setPlaybackSpeedIdx(idx: number): void;

  /**
   * Live chain tip from our same-origin /api/tip relay (height + the tip
   * block's mined timestamp, unix seconds). null until the first poll lands.
   * Written by useLiveTip (mounted on /graph); read by BlockStats' ticker.
   */
  liveTip: { height: number; timestamp: number | null } | null;
  setLiveTip(tip: { height: number; timestamp: number | null }): void;
}

const INITIAL_BLOCK = 0;
const INITIAL_LATEST = 0;

export const useTimegridStore = create<TimegridState>((set, get) => ({
  currentBlock: INITIAL_BLOCK,
  setCurrentBlock(height) {
    const clamped = Math.max(0, Math.min(height, get().latestBlock));
    set({ currentBlock: clamped });
  },

  latestBlock: INITIAL_LATEST,
  setLatestBlock(height) {
    set({ latestBlock: Math.max(0, height) });
  },

  selectedWallet: null,
  setSelectedWallet(address) {
    set({ selectedWallet: address });
  },

  activeDockPanel: null,
  // Pure setter — no toggle-on-same-id behavior. Callers that want a
  // toggle (e.g., a UI button that opens + closes a panel on repeated
  // press) should read activeDockPanel and decide to pass null vs id
  // explicitly. Toggling here was a bug magnet for committed-selection
  // flows: tap coin A → 'wallet-inspector', tap coin B with the same
  // call → null (panel disappears) instead of staying open with the
  // new wallet.
  setActiveDockPanel(id) {
    set({ activeDockPanel: id });
  },

  camera: { position: { x: 0, y: 0 }, zoom: 1 },
  setCamera(camera) {
    set({ camera });
  },

  // Index 0 in Playback's SPEED_OPTIONS is the "Narrate" mode (1 block
  // per 10s) — the default narrative pace. Page-mount Auto-start logic
  // begins playback at this speed so the lattice plays itself unless
  // the user grabs the scrubber.
  playbackPlaying: false,
  setPlaybackPlaying(playing) {
    set({ playbackPlaying: playing });
  },
  playbackSpeedIdx: 0,
  setPlaybackSpeedIdx(idx) {
    set({ playbackSpeedIdx: Math.max(0, idx) });
  },

  liveTip: null,
  setLiveTip(tip) {
    set({ liveTip: tip });
  },
}));
