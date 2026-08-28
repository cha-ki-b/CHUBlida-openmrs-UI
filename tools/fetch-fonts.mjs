#!/usr/bin/env node
/**
 * Downloads Inter and Cairo from Google Fonts into the omod and writes the
 * matching @font-face block into chu-theme.css.
 *
 *   node tools/fetch-fonts.mjs
 *
 * Fonts are self-hosted because a hospital intranet may have no route to
 * fonts.googleapis.com. Every subset Google publishes is kept along with its
 * unicode-range, so a browser only downloads the ranges a page actually uses:
 * a French screen never fetches the Arabic file, and vice versa.
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = join(root, 'chublidatheme', 'omod', 'src', 'main', 'webapp', 'resources', 'fonts');
const CSS = join(root, 'chublidatheme', 'omod', 'src', 'main', 'webapp', 'resources', 'styles', 'chu-theme.css');

const BEGIN = '/* === GENERATED FONT FACES — run tools/fetch-fonts.mjs === */';
const END = '/* === END GENERATED FONT FACES === */';

// A modern UA is required, or Google serves legacy TTF instead of woff2.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FAMILIES = [
  // Inter carries the interface. latin covers French accents (U+00C0–00FF).
  { family: 'Inter', weights: [400, 500, 600], keep: ['latin', 'latin-ext'] },
  // Cairo carries headings and all Arabic.
  { family: 'Cairo', weights: [600, 700], keep: ['latin', 'latin-ext', 'arabic'] },
];

const slug = (family, weight, subset) =>
  `${family.toLowerCase()}-${weight}-${subset}.woff2`;

async function css2(family, weight) {
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${family} ${weight}: HTTP ${res.status}`);
  return res.text();
}

/** Google emits one @font-face per subset, each preceded by a `/* subset *\/` comment. */
function parseFaces(text) {
  const faces = [];
  const re = /\/\*\s*([\w\[\]-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, subset, body] = m;
    const src = body.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
    const range = body.match(/unicode-range:\s*([^;]+);/);
    if (src && range) faces.push({ subset, url: src[1], range: range[1].trim() });
  }
  return faces;
}

mkdirSync(FONT_DIR, { recursive: true });

const blocks = [];
let downloaded = 0;
let bytes = 0;

for (const { family, weights, keep } of FAMILIES) {
  for (const weight of weights) {
    const faces = parseFaces(await css2(family, weight));
    if (!faces.length) throw new Error(`No woff2 faces parsed for ${family} ${weight}`);

    for (const face of faces) {
      if (!keep.includes(face.subset)) continue;
      const filename = slug(family, weight, face.subset);
      const res = await fetch(face.url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`${filename}: HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(join(FONT_DIR, filename), buf);
      downloaded++;
      bytes += buf.length;
      console.log(`  ${filename.padEnd(30)} ${String(buf.length).padStart(7)} bytes  [${face.subset}]`);

      blocks.push(
        `@font-face {\n` +
        `  font-family: "${family}";\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${weight};\n` +
        `  font-display: swap;\n` +
        `  src: url("../fonts/${filename}") format("woff2");\n` +
        `  unicode-range: ${face.range};\n` +
        `}`,
      );
    }
  }
}

const block = `${BEGIN}\n${blocks.join('\n')}\n${END}`;
const css = readFileSync(CSS, 'utf8');
const start = css.indexOf(BEGIN);
const stop = css.indexOf(END);
if (start === -1 || stop === -1) {
  console.error(`Could not find the generated font markers in ${CSS}`);
  process.exit(1);
}
writeFileSync(CSS, css.slice(0, start) + block + css.slice(stop + END.length));

console.log(
  `\n${downloaded} font files, ${(bytes / 1024).toFixed(0)} KB total.` +
  `\nWrote ${blocks.length} @font-face rules into chu-theme.css\n`,
);
