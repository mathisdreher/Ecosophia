#!/usr/bin/env node
// Logo concepts drawn with the Gemini image API, for a human to choose from.
// The chosen concept is then redrawn by hand as SVG (public/brand/*.svg):
// a logo must stay sharp at every size and follow the brand book, which a
// raster image cannot do.
//
//   GEMINI_API_KEY=... node scripts/logo-concepts.mjs --count 6
//
// Writes design/logo-concepts/<date>/<n>-<slug>.png and an index.md with the
// prompt of each image.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

const BRIEF = [
  'A logo for Ecosophia, a bilingual website that maps the thinkers of political ecology as one tree:',
  'precursors in the roots, founding texts in the trunk, schools of thought as branches, authors as leaves,',
  'and underground a mycelium of threads showing who influenced whom.',
  'Flat vector style, two colours at most: dark bark brown #2a2219 and moss green #3d5a2a on warm off-white paper #f3eee3.',
  'Simple, geometric, readable at 32 pixels, no gradient, no shadow, no 3D, no photo, no mockup, centred on a plain background.',
].join(' ');

const IDEAS = [
  { slug: 'tree-ground-roots', idea: 'A symbol only: a small tree whose crown is a T shape, standing on one horizontal ground line, with roots below that end in three dots joined by thin threads.' },
  { slug: 'leaf-mycelium', idea: 'A symbol only: a single leaf above a horizontal line, and below the line a fine network of threads that mirrors the veins of the leaf.' },
  { slug: 'monogram-e', idea: 'A symbol only: a lowercase letter e drawn so that its curve becomes a leaf and its tail becomes a root under a ground line.' },
  { slug: 'rooted-wordmark', idea: 'A wordmark: the word Ecosophia in a classic serif, the letters standing on a ground line, with the descender of the p turning into roots below the line.' },
  { slug: 'canopy-circle', idea: 'A symbol only: a circle cut by a horizontal line, the upper half filled with a stylised canopy of branches, the lower half with roots, both halves mirroring each other.' },
  { slug: 'seed-sprout', idea: 'A symbol only: a seed on a ground line opening into two leaves above and three roots below, in very few strokes.' },
];

const { values } = parseArgs({
  options: {
    count: { type: 'string', default: String(IDEAS.length) },
    model: { type: 'string', default: process.env.LOGO_MODEL || 'gemini-nano-banana-2.1' },
    seed: { type: 'string', default: '1912' },
  },
});
if (!process.env.GEMINI_API_KEY) {
  console.error('logo-concepts: set GEMINI_API_KEY.');
  process.exit(2);
}

const date = new Date().toISOString().slice(0, 10);
const dir = path.join(process.cwd(), 'design', 'logo-concepts', date);
fs.mkdirSync(dir, { recursive: true });
const index = [`# Logo concepts, ${date}`, '', `Model: ${values.model}, seed ${values.seed}. Concepts to choose from, not logos: the chosen one is redrawn as SVG.`, '', `Brief common to all: ${BRIEF}`, ''];

let made = 0;
for (const [i, c] of IDEAS.slice(0, Number(values.count) || IDEAS.length).entries()) {
  const prompt = `${c.idea}\n${BRIEF}`;
  const res = await fetch(`${API}/${encodeURIComponent(values.model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], seed: Number(values.seed), imageConfig: { aspectRatio: '1:1', imageSize: '1K' } },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`${c.slug}: Gemini API ${res.status}: ${json.error?.message ?? res.statusText}`);
    continue;
  }
  const part = (json.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!part) {
    console.error(`${c.slug}: no image (${json.candidates?.[0]?.finishReason ?? 'unknown'})`);
    continue;
  }
  const file = `${i + 1}-${c.slug}.png`;
  fs.writeFileSync(path.join(dir, file), Buffer.from(part.inlineData.data, 'base64'));
  index.push(`## ${i + 1}. ${c.slug}`, '', `![${c.slug}](${file})`, '', c.idea, '');
  made++;
  console.log(`drawn: ${file}`);
}
fs.writeFileSync(path.join(dir, 'index.md'), `${index.join('\n')}\n`);
console.log(`logo concepts: ${made} drawn in ${path.relative(process.cwd(), dir)}`);
if (made === 0) process.exit(1);
