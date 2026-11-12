#!/usr/bin/env node
// Pencil portraits of the authors, drawn by an image model through the Gemini
// API, then made uniform here: same crop, same grey, same paper.
//
//   GEMINI_API_KEY=... node scripts/portraits.mjs --authors missing
//
// Options
//   --authors missing | all | ids and branch ids, comma-separated  (default: missing)
//   --placeholders    draw the two "no portrait" images first (needed once)
//   --model           image model (default: gemini-3.1-flash-image)
//   --limit N         stop after N portraits (to try the style on a few)
//   --dry-run         no call to the API: grey test images, to check the pipeline
//
// Homogeneity comes from three things: one fixed style prompt, the first
// placeholder passed to the model as a style reference for every portrait,
// and the same post-processing for every image (crop, greyscale, levels,
// paper tint). Faces are drawn by the model from what it knows of public
// photographs: they are illustrations, labelled as such on the site, and an
// author marked `portrait: false` always gets a placeholder.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import YAML from 'yaml';
import { loadCorpus } from '../src/lib/corpus.mjs';

const ROOT = process.env.ECOSOPHIA_ROOT ?? process.cwd();
const OUT = path.join(ROOT, 'public', 'portraits');
const RAW = path.join(ROOT, '.cache', 'portraits');
const RECORD = path.join(ROOT, 'data', 'portraits.yaml');
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const SIZE = { width: 1200, height: 800 };
const PAPER = '#f3eee3';
const STYLE_VERSION = 1;

const STYLE = [
  'A graphite pencil drawing on warm off-white paper, in the manner of a careful portrait study for a book of essays.',
  'Fine hatching and soft shading, visible pencil strokes, no colour, no ink wash, no text, no signature, no frame, no border.',
  'The background is plain paper, left empty.',
  'Landscape format. Head and shoulders, centred, the face in the middle third of the width, the top of the head a little below the top edge, the shoulders reaching the bottom edge.',
  'Leave the top right and bottom left corners empty paper.',
].join(' ');

const PLACEHOLDERS = [
  { file: '_placeholder-1.webp', subject: 'A single oak leaf seen from above, with its veins, lying on the paper. No person.' },
  { file: '_placeholder-2.webp', subject: 'A small sprig of young beech leaves on a short twig, lying on the paper. No person.' },
];

function options() {
  const { values } = parseArgs({
    options: {
      authors: { type: 'string', default: 'missing' },
      placeholders: { type: 'boolean', default: false },
      model: { type: 'string', default: process.env.PORTRAIT_MODEL || 'gemini-3.1-flash-image' },
      limit: { type: 'string', default: '0' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values['dry-run'] && !process.env.GEMINI_API_KEY) {
    console.error('portraits: set GEMINI_API_KEY (a Gemini API key from Google AI Studio), or use --dry-run.');
    process.exit(2);
  }
  return { ...values, limit: Number(values.limit) || 0, dry: values['dry-run'] };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One image from the Gemini API, or {refused} with the reason. */
async function draw({ prompt, model, reference }) {
  const parts = [{ text: prompt }];
  if (reference) parts.unshift({ inlineData: { mimeType: 'image/png', data: reference.toString('base64') } });
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:2' } },
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${json.error?.message ?? res.statusText}`);
    const cand = json.candidates?.[0];
    const img = (cand?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
    if (!img) return { refused: cand?.finishReason ?? json.promptFeedback?.blockReason ?? 'no image returned' };
    return { image: Buffer.from((img.inlineData ?? img.inline_data).data, 'base64') };
  }
  throw new Error('Gemini API: too many retries');
}

/** The same treatment for every image: crop, greyscale, levels, paper tint. */
async function finish(buffer, file) {
  const grey = await sharp(buffer)
    .resize(SIZE.width, SIZE.height, { fit: 'cover', position: 'attention' })
    .grayscale()
    .normalise({ lower: 1, upper: 99 })
    .toColourspace('srgb')
    .png()
    .toBuffer();
  await sharp(grey)
    .composite([{ input: { create: { ...SIZE, channels: 3, background: PAPER } }, blend: 'multiply' }])
    .webp({ quality: 78 })
    .toFile(path.join(OUT, file));
}

async function testImage(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><rect width="100%" height="100%" fill="#fff"/><circle cx="768" cy="430" r="200" fill="none" stroke="#555" stroke-width="6"/><text x="768" y="900" font-size="48" text-anchor="middle" fill="#555">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function portraitPrompt(a, corpus) {
  const dates = a.born ? (a.died ? `${a.born}–${a.died}` : `born ${a.born}`) : '';
  const firstWork = a.works.find((w) => w.key !== false);
  const age = firstWork && a.born ? ` as they looked around ${Math.min(firstWork.year + 10, a.died ?? 2026)}` : '';
  const who = a.lede.en.split(/(?<=\.)\s/)[0];
  return [
    'Use the attached drawing only as a reference for the style: the paper, the line weight, the hatching and the grey tones. Do not copy its subject.',
    `Draw a head-and-shoulders portrait of ${a.name}${dates ? ` (${dates})` : ''}${age}. ${who}`,
    'Draw the real person faithfully from well-known public photographs. If you cannot draw a faithful likeness of this person, return no image.',
    STYLE,
  ].join('\n');
}

const readRecord = () => (fs.existsSync(RECORD) ? (YAML.parse(fs.readFileSync(RECORD, 'utf8')) ?? []) : []);

function writeRecord(entries) {
  const sorted = [...entries].sort((x, y) => x.id.localeCompare(y.id));
  const header = [
    '# Portraits of the authors: pencil drawings generated by an image model,',
    '# written by scripts/portraits.mjs. status: drawn (public/portraits/<id>.webp)',
    '# or refused (the model returned no image; the site shows a placeholder).',
    '# To redraw one, delete its line and run the Portraits workflow again.',
  ].join('\n');
  fs.writeFileSync(RECORD, `${header}\n${YAML.stringify(sorted, { lineWidth: 0 })}`);
}

async function main() {
  const opt = options();
  const corpus = loadCorpus();
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(RAW, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);

  if (opt.placeholders || !fs.existsSync(path.join(OUT, PLACEHOLDERS[0].file))) {
    for (const p of PLACEHOLDERS) {
      const res = opt.dry ? { image: await testImage('placeholder') } : await draw({ prompt: `${p.subject}\n${STYLE}`, model: opt.model });
      if (!res.image) throw new Error(`The placeholder ${p.file} was refused (${res.refused}).`);
      fs.writeFileSync(path.join(RAW, p.file.replace('.webp', '.png')), res.image);
      await finish(res.image, p.file);
      console.log(`placeholder: ${p.file}`);
    }
  }
  // The first placeholder, as the model drew it, is the style reference.
  const reference = await sharp(path.join(OUT, PLACEHOLDERS[0].file)).png().toBuffer();

  const record = readRecord();
  const done = new Map(record.map((r) => [r.id, r]));
  const spec = String(opt.authors).split(/[\s,]+/).filter(Boolean);
  const pick = (a) =>
    spec.includes('all') ||
    (spec.includes('missing') && !done.has(a.id)) ||
    spec.includes(a.id) ||
    spec.includes(a.branch ?? '') ||
    (a.layer !== 'leaf' && spec.includes(a.layer));
  const todo = corpus.authors.filter((a) => a.portrait !== false && pick(a));
  const batch = opt.limit ? todo.slice(0, opt.limit) : todo;
  console.log(`${batch.length} portrait(s) to draw with ${opt.dry ? 'no model (dry run)' : opt.model}`);

  let drawn = 0;
  let refused = 0;
  for (const a of batch) {
    try {
      const res = opt.dry ? { image: await testImage(a.name) } : await draw({ prompt: portraitPrompt(a, corpus), model: opt.model, reference });
      if (res.image) {
        fs.writeFileSync(path.join(RAW, `${a.id}.png`), res.image);
        await finish(res.image, `${a.id}.webp`);
        done.set(a.id, { id: a.id, status: 'drawn', model: opt.dry ? 'dry-run' : opt.model, style: STYLE_VERSION, date: today });
        drawn++;
        console.log(`drawn: ${a.name}`);
      } else {
        fs.rmSync(path.join(OUT, `${a.id}.webp`), { force: true });
        done.set(a.id, { id: a.id, status: 'refused', model: opt.model, reason: String(res.refused), date: today });
        refused++;
        console.log(`refused: ${a.name} (${res.refused})`);
      }
    } catch (e) {
      console.error(`failed: ${a.name}: ${e.message}`);
    }
    writeRecord([...done.values()]);
    if (!opt.dry) await sleep(800);
  }
  const line = `portraits: ${drawn} drawn, ${refused} refused, ${batch.length - drawn - refused} failed`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Portraits\n\n${line}\n`);
  if (drawn + refused === 0 && batch.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`portraits: ${e.message}`);
  process.exit(1);
});
