import { describe, it, expect, vi } from 'vitest';
import { applyTip } from '../liveTip';

/**
 * INVARIANT under test (operator bug-report 2026-06-13): the live tip is
 * DISPLAY-ONLY. applyTip must record it via setLiveTip and must NEVER touch
 * latestBlock / currentBlock — the scrubber and stats are bounded by the DATA
 * tip, because the graph has nothing to render past the deployed bundle.
 */
function storeDouble() {
  return {
    setLiveTip: vi.fn(),
    // present to catch any regression that starts calling them again:
    setLatestBlock: vi.fn(),
    setCurrentBlock: vi.fn(),
  };
}

describe('applyTip (display-only invariant)', () => {
  it('ignores empty payloads entirely', () => {
    const s = storeDouble();
    applyTip(s, { height: null, timestamp: null });
    expect(s.setLiveTip).not.toHaveBeenCalled();
  });

  it('records the tip', () => {
    const s = storeDouble();
    applyTip(s, { height: 953_420, timestamp: 1_781_300_000 });
    expect(s.setLiveTip).toHaveBeenCalledWith({ height: 953_420, timestamp: 1_781_300_000 });
  });

  it('NEVER extends latestBlock or moves currentBlock — for any payload', () => {
    const s = storeDouble();
    applyTip(s, { height: 999_999_999, timestamp: 1 });
    applyTip(s, { height: 1, timestamp: null });
    applyTip(s, { height: null, timestamp: null });
    expect(s.setLatestBlock).not.toHaveBeenCalled();
    expect(s.setCurrentBlock).not.toHaveBeenCalled();
  });
});
