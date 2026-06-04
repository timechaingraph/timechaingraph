import { describe, it, expect } from 'vitest';
import {
  btcToSats,
  adaptBlock,
  bondKey,
  p2pkAddressFromScript,
  addressFromOutput,
  extractAddresses,
} from '../extract.mjs';

const SATOSHI_GENESIS_SPK =
  '4104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac';

describe('extract.mjs — btcToSats', () => {
  it('converts BTC to integer sats and kills float drift', () => {
    expect(btcToSats(1)).toBe(100_000_000);
    expect(btcToSats(0.0001)).toBe(10_000);
    expect(btcToSats(50)).toBe(5_000_000_000);
    // 0.1 + 0.2 style drift must round cleanly
    expect(btcToSats(0.1 + 0.2)).toBe(30_000_000);
  });
  it('treats undefined/0 as 0', () => {
    expect(btcToSats(undefined)).toBe(0);
    expect(btcToSats(0)).toBe(0);
  });
});

describe('extract.mjs — bondKey', () => {
  it('is canonical (alphabetical, order-independent)', () => {
    expect(bondKey('zzz', 'aaa')).toBe('aaa|zzz');
    expect(bondKey('aaa', 'zzz')).toBe('aaa|zzz');
    expect(bondKey('aaa', 'zzz')).toBe(bondKey('zzz', 'aaa'));
  });
});

describe('extract.mjs — p2pkAddressFromScript', () => {
  it('derives Satoshi genesis P2PKH from the genesis coinbase P2PK', () => {
    expect(p2pkAddressFromScript(SATOSHI_GENESIS_SPK)).toBe(
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    );
  });
  it('returns null for non-P2PK scripts', () => {
    expect(p2pkAddressFromScript('6a04deadbeef')).toBeNull(); // OP_RETURN
    expect(p2pkAddressFromScript('')).toBeNull();
    expect(p2pkAddressFromScript(null)).toBeNull();
    expect(p2pkAddressFromScript('4104abcdac')).toBeNull(); // claims 65B push, too short
  });
});

describe('extract.mjs — addressFromOutput', () => {
  it('prefers the explicit address', () => {
    expect(addressFromOutput({ scriptpubkey_address: 'bc1qxyz' })).toBe('bc1qxyz');
  });
  it('derives p2pk when no address present', () => {
    expect(
      addressFromOutput({ scriptpubkey_type: 'p2pk', scriptpubkey: SATOSHI_GENESIS_SPK }),
    ).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
  });
  it('returns null for unspendable / address-less outputs (op_return, multisig)', () => {
    expect(addressFromOutput({ scriptpubkey_type: 'op_return' })).toBeNull();
    expect(addressFromOutput({ scriptpubkey_type: 'multisig' })).toBeNull();
  });
});

describe('extract.mjs — adaptBlock (getblock v3 → mempool shape)', () => {
  const blk = {
    hash: '00abc',
    time: 1_231_006_505,
    nTx: 2,
    tx: [
      { vin: [{ coinbase: 'deadbeef' }], vout: [{ value: 50, scriptPubKey: { address: 'MINER', type: 'pubkeyhash', hex: '76a914' } }] },
      {
        vin: [{ prevout: { value: 1, scriptPubKey: { address: 'A', type: 'pubkeyhash' } } }],
        vout: [{ value: 0.6, scriptPubKey: { address: 'B', type: 'pubkeyhash' } }],
      },
    ],
  };
  const adapted = adaptBlock(blk);

  it('maps header fields', () => {
    expect(adapted.header).toEqual({ id: '00abc', timestamp: 1_231_006_505, tx_count: 2 });
  });
  it('flags coinbase vin and converts vout BTC → sats', () => {
    expect(adapted.txs[0].vin[0]).toEqual({ is_coinbase: true });
    expect(adapted.txs[0].vout[0].value).toBe(5_000_000_000);
    expect(adapted.txs[0].vout[0].scriptpubkey_address).toBe('MINER');
  });
  it('carries vin.prevout (spent value + address) for non-coinbase', () => {
    expect(adapted.txs[1].vin[0].prevout.value).toBe(100_000_000);
    expect(adapted.txs[1].vin[0].prevout.scriptpubkey_address).toBe('A');
    expect(adapted.txs[1].vout[0].value).toBe(60_000_000);
  });
  it("remaps scriptPubKey type 'pubkey' → 'p2pk'", () => {
    const b = adaptBlock({ hash: 'h', time: 1, nTx: 1, tx: [{ vin: [{ coinbase: 'x' }], vout: [{ value: 1, scriptPubKey: { type: 'pubkey', hex: 'ab' } }] }] });
    expect(b.txs[0].vout[0].scriptpubkey_type).toBe('p2pk');
  });
});

describe('extract.mjs — extractAddresses', () => {
  it('splits outputs / inputs / coinbase flag and drops address-less outputs', () => {
    const tx = {
      vin: [{ prevout: { value: 1000, scriptpubkey_address: 'A' } }],
      vout: [
        { value: 600, scriptpubkey_address: 'B' },
        { value: 400, scriptpubkey_address: 'C' },
        { value: 0, scriptpubkey_type: 'op_return' }, // dropped (no address)
      ],
    };
    const { outputs, inputs, isCoinbase } = extractAddresses(tx);
    expect(isCoinbase).toBe(false);
    expect(outputs).toEqual([
      { address: 'B', sats: 600 },
      { address: 'C', sats: 400 },
    ]);
    expect(inputs).toEqual([{ address: 'A', sats: 1000 }]);
  });
  it('detects coinbase and yields no inputs', () => {
    const tx = { vin: [{ is_coinbase: true }], vout: [{ value: 50, scriptpubkey_address: 'M' }] };
    const { outputs, inputs, isCoinbase } = extractAddresses(tx);
    expect(isCoinbase).toBe(true);
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([{ address: 'M', sats: 50 }]);
  });
});
