import { describe, it, expect, beforeEach } from 'vitest';
import { useTimegridStore } from '../timegridStore';

const INITIAL = {
  currentBlock: 0,
  latestBlock: 0,
  selectedWallet: null,
  activeDockPanel: null,
  camera: { position: { x: 0, y: 0 }, zoom: 1 },
};

beforeEach(() => {
  // Reset slice values; action functions remain (Zustand setState merges shallowly).
  useTimegridStore.setState(INITIAL);
});

describe('setCurrentBlock', () => {
  it('clamps below zero to zero', () => {
    useTimegridStore.getState().setLatestBlock(100);
    useTimegridStore.getState().setCurrentBlock(-10);
    expect(useTimegridStore.getState().currentBlock).toBe(0);
  });

  it('clamps above latestBlock to latestBlock', () => {
    useTimegridStore.getState().setLatestBlock(100);
    useTimegridStore.getState().setCurrentBlock(150);
    expect(useTimegridStore.getState().currentBlock).toBe(100);
  });

  it('passes through values within range', () => {
    useTimegridStore.getState().setLatestBlock(100);
    useTimegridStore.getState().setCurrentBlock(42);
    expect(useTimegridStore.getState().currentBlock).toBe(42);
  });

  it('with latestBlock=0, every value collapses to 0', () => {
    useTimegridStore.getState().setCurrentBlock(50);
    expect(useTimegridStore.getState().currentBlock).toBe(0);
  });
});

describe('setLatestBlock', () => {
  it('clamps negatives to zero', () => {
    useTimegridStore.getState().setLatestBlock(-5);
    expect(useTimegridStore.getState().latestBlock).toBe(0);
  });

  it('passes positive values through', () => {
    useTimegridStore.getState().setLatestBlock(876_500);
    expect(useTimegridStore.getState().latestBlock).toBe(876_500);
  });
});

describe('setSelectedWallet', () => {
  it('starts null', () => {
    expect(useTimegridStore.getState().selectedWallet).toBeNull();
  });

  it('stores the address string', () => {
    useTimegridStore.getState().setSelectedWallet('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    expect(useTimegridStore.getState().selectedWallet).toBe(
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    );
  });

  it('clears back to null', () => {
    useTimegridStore.getState().setSelectedWallet('addr');
    useTimegridStore.getState().setSelectedWallet(null);
    expect(useTimegridStore.getState().selectedWallet).toBeNull();
  });
});

describe('setActiveDockPanel', () => {
  it('starts null', () => {
    expect(useTimegridStore.getState().activeDockPanel).toBeNull();
  });

  it('opens a panel by id', () => {
    useTimegridStore.getState().setActiveDockPanel('block-stats');
    expect(useTimegridStore.getState().activeDockPanel).toBe('block-stats');
  });

  it('stays open when called with the same id (pure setter, not a toggle)', () => {
    // Toggle-on-same-id was a bug magnet for committed-selection flows
    // (tap coin → 'wallet-inspector', tap another → null instead of
    // staying open). Callers wanting a toggle now do it explicitly.
    useTimegridStore.getState().setActiveDockPanel('block-stats');
    useTimegridStore.getState().setActiveDockPanel('block-stats');
    expect(useTimegridStore.getState().activeDockPanel).toBe('block-stats');
  });

  it('closes when called with null', () => {
    useTimegridStore.getState().setActiveDockPanel('block-stats');
    useTimegridStore.getState().setActiveDockPanel(null);
    expect(useTimegridStore.getState().activeDockPanel).toBeNull();
  });

  it('switches to a different panel without closing', () => {
    useTimegridStore.getState().setActiveDockPanel('block-stats');
    useTimegridStore.getState().setActiveDockPanel('wallet-inspector');
    expect(useTimegridStore.getState().activeDockPanel).toBe('wallet-inspector');
  });
});

describe('setCamera', () => {
  it('starts at origin with zoom 1', () => {
    expect(useTimegridStore.getState().camera).toEqual({
      position: { x: 0, y: 0 },
      zoom: 1,
    });
  });

  it('replaces the camera object', () => {
    useTimegridStore.getState().setCamera({ position: { x: 10, y: -5 }, zoom: 2 });
    expect(useTimegridStore.getState().camera).toEqual({
      position: { x: 10, y: -5 },
      zoom: 2,
    });
  });
});
