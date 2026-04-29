/**
 * dump-substrate.test.ts — TS substrate → JSON dump bridge.
 *
 * Vitest-runnable so we get TypeScript imports without a build step.
 * Writes `out/substrate-dump.json` whenever the test runs (CI + local
 * `npm run test:run`); the JSON is the input to
 * `chain-tools/ingest/from_fixture.py` which produces parquet
 * matching the schemas in `chain-tools/lib/schemas.py`.
 *
 * The "test" assertions are minimal — they verify the dump was
 * written + has the expected shape. The real value is the side
 * effect: a deterministic TS-fixture-to-JSON snapshot the Python
 * side can consume to exercise the parquet pipeline end-to-end
 * before bitcoind is online.
 *
 * Bigints are serialised as strings (JSON has no native bigint).
 * Python parses them back to int via the schema's uint64 column.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FIXTURE_SUBSTRATE } from '@/data/substrate';

function serialize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        serialize(v),
      ]),
    );
  }
  return value;
}

// chain-tools/out/ is gitignored and survives `next build` (which clobbers
// the top-level out/ dir for the static export).
const OUT_PATH = join(
  process.cwd(),
  'chain-tools',
  'out',
  'substrate-dump.json',
);

describe('substrate dump', () => {
  it('writes the substrate to JSON for the Python pipeline', () => {
    const dump = {
      schema: 'substrate-dump/v1',
      tipBlock: FIXTURE_SUBSTRATE.tipBlock,
      wallets: serialize(FIXTURE_SUBSTRATE.wallets),
      bonds: serialize(FIXTURE_SUBSTRATE.bonds),
      coins: serialize(FIXTURE_SUBSTRATE.coins),
      generatedAt: new Date().toISOString().slice(0, 10),
    };
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, JSON.stringify(dump, null, 2) + '\n');

    expect(dump.wallets).toHaveLength(FIXTURE_SUBSTRATE.wallets.length);
    expect(dump.bonds).toHaveLength(FIXTURE_SUBSTRATE.bonds.length);
    expect(dump.coins).toHaveLength(FIXTURE_SUBSTRATE.coins.length);
    expect(dump.tipBlock).toBeGreaterThan(0);
  });

  it('serializes bigints as strings (JSON has no native bigint)', () => {
    const sampleWallet = FIXTURE_SUBSTRATE.wallets.find(
      (w) => typeof w.totalReceivedSats === 'bigint',
    );
    expect(sampleWallet).toBeDefined();
    const serialised = serialize(sampleWallet) as Record<string, unknown>;
    expect(typeof serialised.totalReceivedSats).toBe('string');
  });
});
