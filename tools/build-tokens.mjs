#!/usr/bin/env node
/**
 * Generates the CSS custom-property block in chu-theme.css from tokens/tokens.json,
 * and asserts every pair in the contrast contract.
 *
 *   node tools/build-tokens.mjs          build + verify
 *   node tools/build-tokens.mjs --check  verify only, fail if the CSS is stale
 *
 * A failing contrast assertion exits non-zero. That is the point: a colour regression
 * should stop a release rather than reach a ward.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = join(root, 'tokens', 'tokens.json');
const CSS = join(
  root, 'chublidatheme', 'omod', 'src', 'main', 'webapp', 'resources', 'styles', 'chu-theme.css',
);
const BEGIN = '/* === GENERATED TOKENS — do not edit by hand; run tools/build-tokens.mjs === */';
const END = '/* === END GENERATED TOKENS === */';

const checkOnly = process.argv.includes('--check');
const tokens = JSON.parse(readFileSync(TOKENS, 'utf8'));

/* ---------- colour maths (WCAG 2.2 relative luminance) ---------- */

const toRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/* ---------- resolve token references ---------- */

const dig = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), tokens);

/** Resolves "teal.800" / "brand.logoBlue" / "semantic.action" to a literal hex. */
const resolve = (ref, seen = new Set()) => {
  if (typeof ref === 'string' && ref.startsWith('#')) return ref;
  if (seen.has(ref)) throw new Error(`Circular token reference at ${ref}`);
  seen.add(ref);

  let node = dig(ref);
  if (node === undefined) node = dig(`primitive.${ref}`);
  if (node === undefined) throw new Error(`Unknown token: ${ref}`);
  if (typeof node === 'object' && node.value !== undefined) return resolve(node.value, seen);
  if (typeof node === 'string') return node.startsWith('#') ? node : resolve(node, seen);
  throw new Error(`Token ${ref} does not resolve to a colour`);
};

/* ---------- emit ---------- */

const lines = [];
const section = (title) => lines.push('', `  /* ${title} */`);

section('primitives');
for (const [family, steps] of Object.entries(tokens.primitive)) {
  for (const [step, hex] of Object.entries(steps)) {
    lines.push(`  --chu-${family}-${step}: ${hex};`);
  }
}

section('semantic');
for (const [name, def] of Object.entries(tokens.semantic)) {
  const hex = resolve(def.value);
  const comment = def.comment ? `  /* ${def.comment} */` : '';
  lines.push(`  --chu-${name}: ${hex};${comment}`);
}

section('spacing');
for (const [k, v] of Object.entries(tokens.scale.space)) lines.push(`  --chu-space-${k}: ${v};`);
section('radii');
for (const [k, v] of Object.entries(tokens.scale.radius)) lines.push(`  --chu-radius-${k}: ${v};`);
section('elevation');
for (const [k, v] of Object.entries(tokens.scale.shadow)) lines.push(`  --chu-shadow-${k}: ${v};`);
section('type');
for (const [k, v] of Object.entries(tokens.scale.font)) lines.push(`  --chu-font-${k}: ${v};`);
for (const [k, v] of Object.entries(tokens.scale.size)) lines.push(`  --chu-text-${k}: ${v};`);
section('motion');
for (const [k, v] of Object.entries(tokens.scale.duration)) lines.push(`  --chu-dur-${k}: ${v};`);
for (const [k, v] of Object.entries(tokens.scale.ease)) lines.push(`  --chu-ease-${k}: ${v};`);
section('layout');
for (const [k, v] of Object.entries(tokens.scale.layout)) lines.push(`  --chu-${k}: ${v};`);

const block = `${BEGIN}\n:root {${lines.join('\n')}\n}\n${END}`;

/* ---------- contrast contract ---------- */

let failures = 0;
console.log('\nContrast contract\n' + '─'.repeat(72));
for (const pair of tokens.contrastContract) {
  const fg = resolve(pair.fg);
  const bg = resolve(pair.bg);
  const ratio = contrast(fg, bg);
  const ok = ratio >= pair.min;
  if (!ok) failures++;
  const label = `${pair.fg.replace('semantic.', '')} on ${pair.bg.replace('semantic.', '')}`;
  console.log(
    `${ok ? '  PASS' : '  FAIL'}  ${label.padEnd(38)} ${ratio.toFixed(2).padStart(6)}:1` +
    ` (min ${pair.min})  ${pair.why}`,
  );
}

console.log('─'.repeat(72));
if (failures) {
  console.error(`\n${failures} contrast assertion(s) failed. Build stopped.\n`);
  process.exit(1);
}
console.log(`All ${tokens.contrastContract.length} contrast assertions passed.\n`);

/* ---------- write ---------- */

const css = readFileSync(CSS, 'utf8');
const start = css.indexOf(BEGIN);
const stop = css.indexOf(END);
if (start === -1 || stop === -1) {
  console.error(`Could not find the generated-token markers in ${CSS}`);
  process.exit(1);
}
const next = css.slice(0, start) + block + css.slice(stop + END.length);

if (checkOnly) {
  if (next !== css) {
    console.error('chu-theme.css is out of date. Run: node tools/build-tokens.mjs');
    process.exit(1);
  }
  console.log('chu-theme.css token block is up to date.\n');
} else if (next !== css) {
  writeFileSync(CSS, next);
  console.log(`Wrote token block to ${CSS}\n`);
} else {
  console.log('Token block already current; nothing to write.\n');
}
