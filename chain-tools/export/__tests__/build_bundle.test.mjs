import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
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
const BUILDER = join(REPO, 'chain-tools', 'export', 'build_bundle.py');
// build_bundle needs the operator venv (pyarrow). Skip cleanly where it is
// absent (CI / a fresh checkout) so `npm test` stays green; runs for real
// locally — mirrors reduce_substrate.test.mjs.
const hasVenv = existsSync(PY);

const SATS = 100_000_000;
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

describe.skipIf(!hasVenv)('build_bundle.py — perf#2 coinbase-miner fold', () => {
  it('folds the coinbase-proven miner set into wallets.is_miner + stamps minersFolded', () => {
    const root = mkdtempSync(join(tmpdir(), 'build-bundle-test-'));
    try {
      const sub = join(root, 'sub');
      mkdirSync(sub, { recursive: true });

      // WHALE  — above the 1000-BTC floor, never a miner.
      // POOL   — heuristic miner AND coinbase-proven (in block-miners).
      // TAINT  — heuristic miner but NOT coinbase-proven (a downstream pool-payout
      //          address the walker over-flags): the discriminator — the fold MUST
      //          correct its is_miner to false, and it MUST still appear (node set
      //          is preserved: inclusion stays on the heuristic flag).
      // SATOSHI— genesis coinbase recipient (block 0), proven miner.
      // SMALL  — below the floor, not a miner → dropped entirely.
      writeFileSync(join(sub, 'real-substrate-wallets.jsonl'), jsonl([
        { address: 'WHALE', firstSeenBlock: 100, lastActiveBlock: 200, totalReceivedSats: String(2000 * SATS), txCount: 5, isMiner: false },
        { address: 'POOL', firstSeenBlock: 1, lastActiveBlock: 200, totalReceivedSats: String(60 * SATS), txCount: 9, isMiner: true },
        { address: 'TAINT', firstSeenBlock: 50, lastActiveBlock: 60, totalReceivedSats: String(70 * SATS), txCount: 3, isMiner: true },
        { address: 'SATOSHI', firstSeenBlock: 0, lastActiveBlock: 0, totalReceivedSats: String(50 * SATS), txCount: 1, isMiner: true },
        { address: 'SMALL', firstSeenBlock: 10, lastActiveBlock: 10, totalReceivedSats: String(5 * SATS), txCount: 1, isMiner: false },
      ]));
      writeFileSync(join(sub, 'real-substrate-bonds.jsonl'), jsonl([
        { fromAddress: 'POOL', toAddress: 'WHALE', sats: String(3 * SATS), formationBlock: 100 }, // both kept
        { fromAddress: 'WHALE', toAddress: 'SMALL', sats: '9', formationBlock: 100 }, // SMALL dropped → bond dropped
      ]));
      // block → primary coinbase recipient. Proven miner set = {SATOSHI, POOL}.
      // block 3 has an empty recipient → excluded from the set. TAINT never appears.
      writeFileSync(join(sub, 'block-miners.jsonl'), jsonl([
        { block: 0, address: 'SATOSHI' },
        { block: 1, address: 'POOL' },
        { block: 2, address: 'POOL' },
        { block: 3, address: '' },
      ]));
      writeFileSync(
        join(sub, 'real-substrate-meta.json'),
        JSON.stringify({ schema: 'real-substrate/v5', tipBlock: 3 }),
      );

      const out = join(root, 'out');
      execFileSync(
        PY,
        [BUILDER, '--substrate-dir', sub, '--output-dir', out, '--min-btc', '1000', '--bundle-version', 'v-test'],
        { stdio: 'pipe' },
      );

      const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
      expect(manifest.minersFolded).toBe(true); // fold flag stamped
      expect(manifest.blockMiners).toBeTruthy(); // block-miners.parquet still built (Grid coin-ownership consumer)
      expect(manifest.blockMiners.rows).toBe(4);

      // Read wallets.is_miner back via the venv (parquet → {address: is_miner}).
      const dump = execFileSync(
        PY,
        [
          '-c',
          'import sys,json,pyarrow.parquet as pq;'
            + 't=pq.read_table(sys.argv[1]).to_pylist();'
            + "print(json.dumps({r['address']: bool(r['is_miner']) for r in t}))",
          join(out, 'wallets.parquet'),
        ],
        { encoding: 'utf8' },
      );
      const isMiner = JSON.parse(dump);

      // SMALL dropped by the floor; the other four kept (node set preserved).
      expect(Object.keys(isMiner).sort()).toEqual(['POOL', 'SATOSHI', 'TAINT', 'WHALE']);
      // is_miner == coinbase-proven membership, NOT the walker heuristic:
      expect(isMiner.POOL).toBe(true); // heuristic miner AND proven
      expect(isMiner.SATOSHI).toBe(true); // genesis coinbase recipient, proven
      expect(isMiner.TAINT).toBe(false); // heuristic miner but NOT proven → corrected
      expect(isMiner.WHALE).toBe(false); // never a miner
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
