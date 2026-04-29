import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BitcoinChainAdapter } from '../BitcoinChainAdapter';

const REAL_FETCH = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = REAL_FETCH;
});

describe('BitcoinChainAdapter.getStatus', () => {
  it('fetches /status.json against the configured cdnBase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ currentBlock: 876_500 }),
    });
    const adapter = new BitcoinChainAdapter('https://data.example.com');
    await adapter.getStatus();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://data.example.com/status.json',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('returns the parsed currentBlock when the fetch succeeds', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        currentBlock: 876_500,
        lastBlockTime: 1714409400000,
        nextBlockEtaMs: 600_000,
      }),
    });
    const adapter = new BitcoinChainAdapter();
    const status = await adapter.getStatus();
    expect(status).toEqual({
      currentBlock: 876_500,
      lastBlockTime: 1714409400000,
      nextBlockEtaMs: 600_000,
    });
  });

  it('returns currentBlock=0 if the response is not ok', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ currentBlock: 999 }),
    });
    const adapter = new BitcoinChainAdapter();
    const status = await adapter.getStatus();
    expect(status).toEqual({ currentBlock: 0 });
  });

  it('returns currentBlock=0 if fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
    const adapter = new BitcoinChainAdapter();
    const status = await adapter.getStatus();
    expect(status).toEqual({ currentBlock: 0 });
  });

  it('drops malformed currentBlock and falls back to 0', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ currentBlock: 'not-a-number' }),
    });
    const adapter = new BitcoinChainAdapter();
    const status = await adapter.getStatus();
    expect(status.currentBlock).toBe(0);
  });

  it('strips lastBlockTime/nextBlockEtaMs if not numeric', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        currentBlock: 876_500,
        lastBlockTime: 'never',
        nextBlockEtaMs: null,
      }),
    });
    const adapter = new BitcoinChainAdapter();
    const status = await adapter.getStatus();
    expect(status.currentBlock).toBe(876_500);
    expect(status.lastBlockTime).toBeUndefined();
    expect(status.nextBlockEtaMs).toBeUndefined();
  });

  it('handles trailing slash on cdnBase', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ currentBlock: 0 }),
    });
    const adapter = new BitcoinChainAdapter('https://data.example.com/');
    await adapter.getStatus();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://data.example.com/status.json',
      expect.anything(),
    );
  });
});

describe('BitcoinChainAdapter stubs (v0.2 work)', () => {
  it('getNodes() returns an empty array', async () => {
    const adapter = new BitcoinChainAdapter();
    expect(await adapter.getNodes()).toEqual([]);
  });

  it('getActivity() returns null', async () => {
    const adapter = new BitcoinChainAdapter();
    expect(await adapter.getActivity(420_000)).toBeNull();
  });

  it('getBlock() returns null', async () => {
    const adapter = new BitcoinChainAdapter();
    expect(await adapter.getBlock(420_000)).toBeNull();
  });
});
