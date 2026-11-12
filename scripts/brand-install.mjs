#!/usr/bin/env node
// Installs the brand drawn with Gemini and vectorised in two inks (bark and
// moss), from design/proposals/traced, into public/: the logo family, the E
// mark, app icons, favicon, branch emblems (detailed and small) and glyphs.
//   node scripts/brand-install.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'design/proposals/traced');
const PUB = path.join(ROOT, 'public');
const INK = '#2a2219', MOSS = '#3d5a2a', CREAM = '#ece6d8', MOSS_NIGHT = '#8fae6a', PAPER = '#f3eee3', NIGHT = '#16201a';

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const recolor = (svg, ink, moss) => svg.replaceAll(`fill="${INK}"`, `fill="${ink}"`).replaceAll(`fill="${MOSS}"`, `fill="${moss}"`);
const titled = (svg, title) => svg.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
const sized = (svg, w) => {
  const [, vw, vh] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  return svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}" height="${Math.round((w * vh) / vw)}"`);
};
const write = (rel, svg) => {
  fs.mkdirSync(path.dirname(path.join(PUB, rel)), { recursive: true });
  fs.writeFileSync(path.join(PUB, rel), svg);
};

// Logo A (refined) and the E mark.
const logo = sized(titled(read('1-refined.svg'), 'Ecosophia'), 200);
const mark = sized(titled(read('5-mark.svg'), 'Ecosophia mark'), 64);
const B = 'brand/';
write(`${B}ecosophia-logo.svg`, logo);
write(`${B}ecosophia-logo-night.svg`, recolor(logo, CREAM, MOSS_NIGHT));
write(`${B}ecosophia-logo-mono-bark.svg`, recolor(logo, INK, INK));
write(`${B}ecosophia-logo-mono-cream.svg`, recolor(logo, CREAM, CREAM));
write(`${B}ecosophia-logo-mono-moss.svg`, recolor(logo, MOSS, MOSS));
write(`${B}ecosophia-e-mark.svg`, mark);
write(`${B}ecosophia-e-mark-night.svg`, recolor(mark, CREAM, MOSS_NIGHT));
write(`${B}ecosophia-e-mark-mono.svg`, recolor(mark, INK, INK));

// App icons: the mark centred on a rounded tile.
const [, mw, mh] = mark.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
const inner = (svg) => svg.replace(/^.*?<title>.*?<\/title>/s, '').replace(/<\/svg>\s*$/, '');
const tile = (bg, ink, moss) => {
  const s = Math.max(mw, mh) * 1.36;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="512" height="512"><title>Ecosophia</title><rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${bg}"/><g transform="translate(${(s - mw) / 2} ${(s - mh) / 2})">${inner(recolor(mark, ink, moss))}</g></svg>`;
};
write(`${B}ecosophia-app-icon.svg`, tile(PAPER, INK, MOSS));
write(`${B}ecosophia-app-icon-moss.svg`, tile(MOSS, PAPER, '#cfe0b4'));
write(`${B}ecosophia-app-icon-night.svg`, tile(NIGHT, CREAM, MOSS_NIGHT));
await sharp(Buffer.from(tile(PAPER, INK, MOSS)), { density: 200 }).resize(512, 512).png().toFile(path.join(PUB, `${B}ecosophia-app-icon-512.png`));
await sharp(Buffer.from(tile(PAPER, INK, MOSS)), { density: 200 }).resize(180, 180).png().toFile(path.join(PUB, 'apple-touch-icon.png'));
write('favicon.svg', tile(PAPER, INK, MOSS).replace('width="512" height="512"', 'width="32" height="32"'));

// Branch emblems: detailed (second-round sheet 1) and small (sheet 3); glyphs (sheet 2).
const EMBLEMS = ['ecosophy', 'deep-ecology', 'social-ecology', 'ecosocialism', 'degrowth', 'ecofeminism', 'political-ecology', 'decolonial', 'anthropocene', 'technocritique', 'queer-ecology', 'counterpoint'];
const GLYPHS = [
  ['leaf', 'Leaf: author'], ['branch', 'Branch: school'], ['trunk', 'Trunk: founding text'], ['root', 'Root: precursor'],
  ['seed', 'Seed: concept'], ['hypha', 'Hypha: influence'], ['ring', 'Ring: time'], ['canopy', 'Canopy: positions on three axes'],
  ['terrain', 'Terrain: birthplaces'], ['clearing', 'Clearing: simulated debate'], ['work', 'Work: a book'], ['simulated', 'Simulated: said by an agent'],
];
const V3 = [
  ['market', 'emblem'], ['conservative', 'emblem'], ['sourced', 'Sourced: from a published text'], ['programme', 'Programme: a party measure'],
  ['axiom', 'Axiom: a claim that splits the schools'], ['portrait', 'Portrait: a generated drawing'], ['search', 'Search'], ['download', 'Download'],
  ['quote', 'Quotation'], ['day', 'Day theme'], ['night', 'Night theme'], ['language', 'Language'],
];
const cell = (prefix, n) => sized(read(`icons/${prefix}-${n}.svg`), 48);
EMBLEMS.forEach((id, i) => {
  write(`glyphs/branches/${id}.svg`, titled(cell('em', i + 1), id));
  write(`glyphs/branches/small/${id}.svg`, titled(cell('alt', i + 1), id));
});
GLYPHS.forEach(([id, title], i) => write(`glyphs/${id}.svg`, titled(cell('gl', i + 1), title)));
if (fs.existsSync(path.join(SRC, 'icons/v3d-1.svg'))) {
  V3.forEach(([id, title], i) => {
    if (title === 'emblem') {
      write(`glyphs/branches/${id}.svg`, titled(cell('v3d', i + 1), id));
      write(`glyphs/branches/small/${id}.svg`, titled(cell('v3b', i + 1), id));
    } else {
      write(`glyphs/${id}.svg`, titled(cell('v3d', i + 1), title));
      write(`glyphs/small/${id}.svg`, titled(cell('v3b', i + 1), title));
    }
  });
}
// Fourth round: the emblems of ecological democracy (the agora) and collapse
// (the Seneca cliff); row 1 detailed, row 2 small.
if (fs.existsSync(path.join(SRC, 'icons/v4-1.svg'))) {
  for (const [id, detailed, small] of [['democracy', 1, 5], ['collapse', 2, 6]]) {
    write(`glyphs/branches/${id}.svg`, titled(cell('v4', detailed), id));
    write(`glyphs/branches/small/${id}.svg`, titled(cell('v4', small), id));
  }
}
// Fifth round: better emblems for the weaker schools, and animal ethics.
// [branch, detailed cell or null to keep, small cell]
if (fs.existsSync(path.join(SRC, 'icons/v5-1.svg'))) {
  for (const [id, detailed, small] of [['counterpoint', 1, 5], ['political-ecology', 2, 6], ['decolonial', 3, 7], ['social-ecology', null, 8], ['ecosocialism', 9, 11], ['animal', 10, 12]]) {
    if (detailed) write(`glyphs/branches/${id}.svg`, titled(cell('v5', detailed), id));
    write(`glyphs/branches/small/${id}.svg`, titled(cell('v5', small), id));
  }
}
console.log('brand installed');
