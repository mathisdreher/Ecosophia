#!/usr/bin/env node
// Draws a set of images with the Gemini image API from a job file, for a
// human to choose from. A job names a model, a seed, an optional reference
// image (sent with every prompt, to hold the style) and a list of prompts.
//
//   GEMINI_API_KEY=... node scripts/gemini-draw.mjs design/gemini-jobs/logo-v2.json
//
// Writes design/<out>/<n>-<slug>.png and an index.md with each prompt.
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const jobFile = process.argv[2];
if (!jobFile || !fs.existsSync(jobFile)) {
  console.error('gemini-draw: usage: node scripts/gemini-draw.mjs <job.json>');
  process.exit(2);
}
if (!process.env.GEMINI_API_KEY) {
  console.error('gemini-draw: set GEMINI_API_KEY.');
  process.exit(2);
}
const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const model = process.env.GEMINI_MODEL || job.model || 'gemini-nano-banana-2.1';
const seed = Number(process.env.GEMINI_SEED || job.seed || 1912);
const out = path.join(process.cwd(), 'design', job.out);
fs.mkdirSync(out, { recursive: true });
const refs = (job.references ?? []).map((p) => ({ inlineData: { mimeType: 'image/png', data: fs.readFileSync(p).toString('base64') } }));

const index = [`# ${job.title}`, '', `Model: ${model}, seed ${seed}. ${job.note ?? ''}`, '', `Brief common to all: ${job.brief}`, ''];
let made = 0;
for (const [i, item] of job.items.entries()) {
  const prompt = `${item.prompt}\n${job.brief}`;
  const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [...refs, { text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], seed: seed + (item.seedOffset ?? 0), imageConfig: { aspectRatio: item.aspect ?? job.aspect ?? '1:1', imageSize: job.size ?? '1K' } },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`${item.slug}: Gemini API ${res.status}: ${json.error?.message ?? res.statusText}`);
    continue;
  }
  const part = (json.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (!part) {
    console.error(`${item.slug}: no image (${json.candidates?.[0]?.finishReason ?? 'unknown'})`);
    continue;
  }
  const file = `${i + 1}-${item.slug}.png`;
  fs.writeFileSync(path.join(out, file), Buffer.from(part.inlineData.data, 'base64'));
  index.push(`## ${i + 1}. ${item.slug}`, '', `![${item.slug}](${file})`, '', item.prompt, '');
  made++;
  console.log(`drawn: ${file}`);
}
fs.writeFileSync(path.join(out, 'index.md'), `${index.join('\n')}\n`);
console.log(`gemini-draw: ${made} of ${job.items.length} drawn in design/${job.out}`);
if (made === 0) process.exit(1);
