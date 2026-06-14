#!/usr/bin/env node
// chain-tools/vault/validate.mjs
//
// Vault link validator. Walks a vault directory tree, parses YAML
// frontmatter on every .md file, validates required schema fields,
// scans body for [[wikilink]] / [[wikilink|alias]] references, and
// asserts every target resolves to an existing path or entity inside
// the vault.
//
// Exits 0 on a clean validation; exits 1 with a specific path and
// reason on the first failure. Designed to run after the regenerate
// step in CI:
//
//     node chain-tools/vault/generate-grid.mjs
//     node chain-tools/vault/validate.mjs vault-grid
//
// Or for the brain (sister's) vault:
//
//     node chain-tools/vault/generate.mjs
//     node chain-tools/vault/validate.mjs vault-graph    # post-rename
//     node chain-tools/vault/validate.mjs vault          # pre-rename
//
// Schema is inferred from the directory layout: wallets/<role>/
// <address>.md uses wallet schema; coins/<bucket>/<coinId>.md uses
// coin schema; blocks/<bucket>/<height>.md uses block schema. Other
// markdown files (README, INDEX, SUMMARY, CONCEPTS, …) are validated
// for frontmatter shape only and their wikilinks are still resolved.
//
// Wikilink resolution accepts:
//   - Basename match:   [[B0I0]] resolves to coins/genesis/B0I0.md
//   - Path match:       [[blocks/genesis]] resolves to blocks/genesis.md
//   - Frontmatter id:   [[1A1z…]] resolves to any wallet whose
//                       frontmatter.address equals that string
//
// Placeholder examples in docs (e.g. [[<address>]] in a README's
// "wikilink shape" explanation) are skipped — any target containing
// '<' or '>' or whitespace is treated as documentation, not a link.

import * as fs from 'node:fs';
import * as path from 'node:path';

// --- minimal YAML frontmatter parser ----------------------------------------

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let raw = line.slice(colonIdx + 1).trim();
    const hashIdx = raw.indexOf('#');
    if (hashIdx > 0 && raw[hashIdx - 1] === ' ') raw = raw.slice(0, hashIdx).trim();
    let value;
    if (raw.startsWith('[') && raw.endsWith(']')) {
      value = raw.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (raw === 'true') {
      value = true;
    } else if (raw === 'false') {
      value = false;
    } else if (/^-?\d+$/.test(raw)) {
      value = parseInt(raw, 10);
    } else if (/^-?\d+\.\d+$/.test(raw)) {
      value = parseFloat(raw);
    } else {
      value = raw;
    }
    fm[key] = value;
  }
  return fm;
}

// --- schema definitions ------------------------------------------------------

const WALLET_REQUIRED = [
  'address',
  'role',
  'firstSeen',
  'lastActive',
  'lifetimeReceivedSats',
  'txCount',
  'isMiner',
  'centrality',
  'tags',
];

const COIN_REQUIRED = [
  'coinId',
  'mintedAtBlock',
  'mintedIndex',
  'minterAddress',
  'ownerAddress',
  'spiralIndex',
  'gridX',
  'gridY',
  'isHalving',
  'tags',
];

const BLOCK_REQUIRED = ['block', 'tags'];

function classifyMarkdown(rel) {
  if (rel.startsWith('wallets/')) return 'wallet';
  if (rel.startsWith('coins/')) return 'coin';
  if (rel.startsWith('blocks/')) return 'block';
  return 'free-form';
}

function requiredFor(kind) {
  switch (kind) {
    case 'wallet':  return WALLET_REQUIRED;
    case 'coin':    return COIN_REQUIRED;
    case 'block':   return BLOCK_REQUIRED;
    default:        return [];
  }
}

// --- file walking ------------------------------------------------------------

function* walkMarkdown(rootDir, relPrefix) {
  const dirAbs = relPrefix ? path.join(rootDir, relPrefix) : rootDir;
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      yield* walkMarkdown(rootDir, rel);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield rel;
    }
  }
}

// --- wikilink scanning + resolution -----------------------------------------

function buildResolutionIndex(rootDir) {
  const fileBaseNames = new Set();
  const fullPaths = new Set();   // path-style targets (no .md ext)
  const addresses = new Set();
  const coinIds = new Set();
  const blockHeights = new Set();
  for (const rel of walkMarkdown(rootDir, '')) {
    const base = path.basename(rel, '.md');
    fileBaseNames.add(base);
    const relNoExt = rel.replace(/\.md$/, '');
    fullPaths.add(relNoExt);
    const content = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    const fm = parseFrontmatter(content);
    if (!fm) continue;
    if (typeof fm.address === 'string') addresses.add(fm.address);
    if (typeof fm.coinId === 'string') coinIds.add(fm.coinId);
    if (typeof fm.block === 'number') blockHeights.add(String(fm.block));
  }
  return { fileBaseNames, fullPaths, addresses, coinIds, blockHeights };
}

function isPlaceholder(target) {
  // Documentation example syntax — typically appears in README /
  // SUMMARY / INDEX bodies that describe the wikilink format itself.
  return (
    target.includes('<') ||
    target.includes('>') ||
    target.includes('…') ||
    target.includes('...') ||
    /\s/.test(target)
  );
}

function resolves(target, index) {
  return (
    index.fileBaseNames.has(target) ||
    index.fullPaths.has(target) ||
    index.addresses.has(target) ||
    index.coinIds.has(target) ||
    index.blockHeights.has(target)
  );
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function scanWikilinks(content) {
  const out = [];
  let m;
  while ((m = WIKILINK_RE.exec(content)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

// --- validation --------------------------------------------------------------

function fail(rel, reason) {
  console.error(`✗ ${rel}: ${reason}`);
  process.exit(1);
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: validate.mjs <vault-root>');
    console.error('  e.g. node chain-tools/vault/validate.mjs vault-grid');
    process.exit(2);
  }

  const rootDir = path.resolve(arg);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`validate.mjs: not a directory: ${rootDir}`);
    process.exit(2);
  }

  const index = buildResolutionIndex(rootDir);
  let walked = 0;
  let wikilinkCount = 0;
  let placeholdersSkipped = 0;

  for (const rel of walkMarkdown(rootDir, '')) {
    walked += 1;
    const content = fs.readFileSync(path.join(rootDir, rel), 'utf8');

    const fm = parseFrontmatter(content);
    const kind = classifyMarkdown(rel);

    if (fm) {
      for (const required of requiredFor(kind)) {
        if (!(required in fm)) {
          fail(rel, `missing required frontmatter field: ${required}`);
        }
      }
      if (kind === 'coin') {
        if (typeof fm.mintedAtBlock !== 'number') {
          fail(rel, 'mintedAtBlock must be an integer');
        }
        if (typeof fm.spiralIndex !== 'number') {
          fail(rel, 'spiralIndex must be an integer');
        }
      }
      if (kind === 'wallet') {
        if (typeof fm.lifetimeReceivedSats !== 'number' && typeof fm.lifetimeReceivedSats !== 'string') {
          fail(rel, 'lifetimeReceivedSats must be a number or sats-string');
        }
        const validRoles = ['satoshi', 'miner', 'whale', 'significant', 'dust'];
        if (!validRoles.includes(fm.role)) {
          fail(rel, `role must be one of ${validRoles.join('|')}`);
        }
      }
    }

    for (const target of scanWikilinks(content)) {
      if (isPlaceholder(target)) {
        placeholdersSkipped += 1;
        continue;
      }
      wikilinkCount += 1;
      if (!resolves(target, index)) {
        fail(rel, `wikilink to unknown target [[${target}]]`);
      }
    }
  }

  console.log(
    `✓ vault validated: ${walked} markdown files, ${wikilinkCount} wikilinks, all resolvable.`,
  );
  if (placeholdersSkipped > 0) {
    console.log(`  ${placeholdersSkipped} placeholder examples skipped (containing <, >, …, or whitespace)`);
  }
  console.log(
    `  index: ${index.fileBaseNames.size} filenames, ${index.fullPaths.size} paths, ${index.addresses.size} addresses, ${index.coinIds.size} coinIds, ${index.blockHeights.size} blocks`,
  );
}

main();
