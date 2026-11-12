#!/usr/bin/env node
// Puts a run written by clearing/run.mjs into data/clearing/runs.
//
//   node clearing/store.mjs <folder holding clr-NNNN.yaml and clr-NNNN.transcript.json>
//
// The simulation numbers its run from the commit it started on. Two runs
// started from the same commit therefore get the same number, and the second
// one to be stored would overwrite nothing but be refused. Here it takes the
// next free number instead: the header line, `id`, `runId` and the
// transcript's `runId` are rewritten, nothing else. Prints the stored id and,
// in Actions, writes run_id to GITHUB_OUTPUT.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RUNS = path.join(ROOT, 'data', 'clearing', 'runs');
const ID = /^clr-\d{4}$/;

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir)) {
  console.error('store: usage: node clearing/store.mjs <folder with the run>');
  process.exit(2);
}
const found = fs.readdirSync(dir).filter((f) => /^clr-\d{4}\.yaml$/.test(f));
if (found.length !== 1) {
  console.error(`store: expected one clr-NNNN.yaml in ${dir}, found ${found.length}`);
  process.exit(1);
}
const from = found[0].replace(/\.yaml$/, '');
const transcriptFile = path.join(dir, `${from}.transcript.json`);
if (!fs.existsSync(transcriptFile)) {
  console.error(`store: ${from}.transcript.json is missing`);
  process.exit(1);
}

fs.mkdirSync(RUNS, { recursive: true });
const taken = new Set(fs.readdirSync(RUNS).map((f) => f.match(/^(clr-\d{4})\.yaml$/)?.[1]).filter(Boolean));
let to = from;
if (taken.has(from)) {
  const last = Math.max(...[...taken].map((id) => Number(id.slice(4))));
  to = `clr-${String(last + 1).padStart(4, '0')}`;
}
if (!ID.test(to)) {
  console.error(`store: unexpected run id ${to}`);
  process.exit(1);
}

let yaml = fs.readFileSync(path.join(dir, found[0]), 'utf8');
const transcript = JSON.parse(fs.readFileSync(transcriptFile, 'utf8'));
if (to !== from) {
  const before = yaml;
  yaml = yaml
    .replace(new RegExp(`^# Clearing run ${from}\\.`, 'm'), `# Clearing run ${to}.`)
    .replace(new RegExp(`^id: ${from}$`, 'm'), `id: ${to}`)
    .replace(new RegExp(`^runId: ${from}$`, 'm'), `runId: ${to}`);
  if (yaml === before || !new RegExp(`^id: ${to}$`, 'm').test(yaml)) {
    console.error(`store: could not renumber ${from}`);
    process.exit(1);
  }
  if (transcript.runId !== from) {
    console.error(`store: the transcript belongs to ${transcript.runId}, not ${from}`);
    process.exit(1);
  }
  transcript.runId = to;
  const left = (yaml.match(new RegExp(from, 'g')) ?? []).length + (JSON.stringify(transcript).match(new RegExp(from, 'g')) ?? []).length;
  if (left) console.warn(`store: ${left} other mention(s) of ${from} left as they are`);
  console.log(`store: ${from} is taken, stored as ${to}`);
}

fs.writeFileSync(path.join(RUNS, `${to}.yaml`), yaml);
fs.writeFileSync(path.join(RUNS, `${to}.transcript.json`), `${JSON.stringify(transcript, null, 2)}\n`);
console.log(to);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `run_id=${to}\n`);
