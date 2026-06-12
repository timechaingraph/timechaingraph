import { describe, it, expect, vi } from 'vitest';
import { applyTip } from '../liveTip';

/** Minimal store double capturing the calls applyTip makes. */
function storeDouble(over: Partial<{ latestBlock: number; currentBlock: number; playbackPlaying: boolean }> = {}) {
  return {
    latestBlock: 952_351,
    currentBlock: 952_351,
    playbackPlaying: false,
    setLatestBlock: vi.fn(),
    setCurrentBlock: vi.fn(),
    setLiveTip: vi.fn(),
    ...over,
  };
}

describe('applyTip (live-tail follow rules)', () => {
  it('ignores empty payloads entirely', () => {
    const s = storeDouble();
    applyTip(s, { height: null, timestamp: null });
    expect(s.setLiveTip).not.toHaveBeenCalled();
    expect(s.setLatestBlock).not.toHaveBeenCalled();
  });

  it('records the tip and extends latestBlock on a new block', () => {
    const s = storeDouble();
    applyTip(s, { height: 952_352, timestamp: 1_781_300_000 });
    expect(s.setLiveTip).toHaveBeenCalledWith({ height: 952_352, timestamp: 1_781_300_000 });
    expect(s.setLatestBlock).toHaveBeenCalledWith(952_352);
  });

  it('follows the tip when the viewer was parked at the old tip', () => {
    const s = storeDouble({ currentBlock: 952_351 });
    applyTip(s, { height: 952_353, timestamp: 1 });
    expect(s.setCurrentBlock).toHaveBeenCalledWith(952_353);
  });

  it('never yanks a viewer scrubbed into history', () => {
    const s = storeDouble({ currentBlock: 480_000 });
    applyTip(s, { height: 952_353, timestamp: 1 });
    expect(s.setLatestBlock).toHaveBeenCalledWith(952_353);
    expect(s.setCurrentBlock).not.toHaveBeenCalled();
  });

  it('never yanks a running playback, even at the tip', () => {
    const s = storeDouble({ playbackPlaying: true });
    applyTip(s, { height: 952_353, timestamp: 1 });
    expect(s.setCurrentBlock).not.toHaveBeenCalled();
  });

  it('records but does not shrink on a lagging upstream height', () => {
    const s = storeDouble();
    applyTip(s, { height: 900_000, timestamp: 1 });
    expect(s.setLiveTip).toHaveBeenCalled();
    expect(s.setLatestBlock).not.toHaveBeenCalled();
    expect(s.setCurrentBlock).not.toHaveBeenCalled();
  });
});
