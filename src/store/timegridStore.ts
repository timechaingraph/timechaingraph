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
  setActiveDockPanel(id) {
    set((s) => ({ activeDockPanel: s.activeDockPanel === id ? null : id }));
  },

  camera: { position: { x: 0, y: 0 }, zoom: 1 },
  setCamera(camera) {
    set({ camera });
  },
}));
