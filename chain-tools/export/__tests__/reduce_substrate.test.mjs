import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PY = join(REPO, 'chain-tools', '.venv', 'bin', 'python');
const REDUCER = join(REPO, 'chain-tools', 'export', 'reduce_substrate.py');
// The reducer needs the operator venv (duckdb). Skip cleanly where it's absent
// (CI / a fresh checkout) so `npm test` stays green; runs for real locally.
const hasVenv = existsSync(PY);

function gzPart(dir, name, rows) {
  mkdirSync(dir, { recursive: true });
  const jsonl = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(join(dir, name), gzipSync(jsonl));
}
function readJsonl(file) {
  return readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

const SATS = 100_000_000;

describe.skipIf(!hasVenv)('reduce_substrate.py', () => {
  it('applies the significance floor + sig↔sig bond filter + cross-window merge', () => {
    const root = mkdtempSync(join(tmpdir(), 'reduce-test-'));
    try {
      const agg = join(root, 'agg');

      // Window 1: a whale (≥1000 BTC → free), a miner (kept by flag), a dust
      // wallet (1000 sats, 1 tx, not miner → below the Max-tier floor → dropped).
      gzPart(join(agg, 'wallets'), 'part-0000000-0000010.jsonl.gz', [
        { address: 'WHALE', firstSeenBlock: 10, lastActiveBlock: 10, totalReceivedSats: String(1000 * SATS), txCount: 1, isMiner: false },
        { address: 'MINER', firstSeenBlock: 8, lastActiveBlock: 8, totalReceivedSats: String(50 * SATS), txCount: 1, isMiner: true },
        { address: 'DUST', firstSeenBlock: 10, lastActiveBlock: 10, totalReceivedSats: '1000', txCount: 1, isMiner: false },
      ]);
      // Window 2: WHALE recurs — exercises HUGEINT sum + min(firstSeen)/max(lastActive).
      gzPart(join(agg, 'wallets'), 'part-0000011-0000020.jsonl.gz', [
        { address: 'WHALE', firstSeenBlock: 5, lastActiveBlock: 20, totalReceivedSats: String(500 * SATS), txCount: 2, isMiner: false },
      ]);
      gzPart(join(agg, 'bonds'), 'part-0000000-0000010.jsonl.gz', [
        { fromAddress: 'MINER', toAddress: 'WHALE', sats: '5', formationBlock: 10 }, // both kept
        { fromAddress: 'DUST', toAddress: 'WHALE', sats: '3', formationBlock: 10 }, // DUST dropped → bond dropped
      ]);
      gzPart(join(agg, 'timestamps'), 'part-0000000-0000010.jsonl.gz', [{ b: 10, t: 1_231_006_505 }]);
      writeFileSync(
        join(agg, 'meta.json'),
        JSON.stringify({ schema: 'real-substrate-agg/v5', lastFlushedBlock: 20, parts: 3 }),
      );

      execFileSync(PY, [REDUCER, '--agg-dir', agg, '--out-dir', root], { stdio: 'pipe' });

      // Wallets: DUST dropped; WHALE + MINER kept.
      const wallets = readJsonl(join(root, 'real-substrate-wallets.jsonl'));
      const byAddr = Object.fromEntries(wallets.map((w) => [w.address, w]));
      expect(Object.keys(byAddr).sort()).toEqual(['MINER', 'WHALE']);

      // WHALE merged across windows.
      const whale = byAddr.WHALE;
      expect(whale.totalReceivedSats).toBe(String(1500 * SATS)); // 1000 + 500
      expect(whale.txCount).toBe(3); // 1 + 2
      expect(whale.firstSeenBlock).toBe(5); // min(10, 5)
      expect(whale.lastActiveBlock).toBe(20); // max(10, 20)
      expect(typeof whale.totalReceivedSats).toBe('string'); // emitted as string

      // Bonds: only MINER↔WHALE survives (DUST dropped its bond).
      const bonds = readJsonl(join(root, 'real-substrate-bonds.jsonl'));
      expect(bonds.length).toBe(1);
      expect([bonds[0].fromAddress, bonds[0].toAddress].sort()).toEqual(['MINER', 'WHALE']);
      expect(bonds[0].sats).toBe('5');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
