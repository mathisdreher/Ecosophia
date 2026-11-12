#!/usr/bin/env node
// Withdraws an author's agent from every stored run: its closing line, its
// place in the alliances, its lines in the transcript, its prompt, and its
// weight in the branch positions.
//
//   node clearing/withdraw.mjs <author-id>
//
// Run it after adding `agent: false` to the author in data/authors/*.yaml, so
// that the agent also stays out of future runs. A run left with fewer than two
// agents is deleted.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { loadCorpus } from '../src/lib/corpus.mjs';

const ROOT = process.env.ECOSOPHIA_ROOT ?? process.cwd();
const RUNS = path.join(ROOT, 'data', 'clearing', 'runs');
const id = process.argv[2];
const corpus = loadCorpus();
if (!id || !corpus.authorById[id]) {
  console.error('withdraw: give the id of an author, as in data/authors (for example: node clearing/withdraw.mjs ivan-illich)');
  process.exit(2);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

let touched = 0;
for (const file of fs.existsSync(RUNS) ? fs.readdirSync(RUNS).filter((f) => f.endsWith('.yaml')) : []) {
  const yamlFile = path.join(RUNS, file);
  const jsonFile = yamlFile.replace(/\.yaml$/, '.transcript.json');
  const source = fs.readFileSync(yamlFile, 'utf8');
  const header = source.split('\n').filter((l) => l.startsWith('#')).join('\n');
  const run = YAML.parse(source);
  const record = fs.existsSync(jsonFile) ? JSON.parse(fs.readFileSync(jsonFile, 'utf8')) : null;
  const inRun = run.voices?.some((v) => v.author === id) || run.silent?.includes(id) || run.alliances?.some((al) => al.authors?.includes(id)) || record?.transcript?.some((e) => e.author === id || e.to === id);
  if (!inRun) continue;
  touched++;

  run.voices = (run.voices ?? []).filter((v) => v.author !== id);
  run.silent = (run.silent ?? []).filter((a) => a !== id);
  run.alliances = (run.alliances ?? []).map((al) => ({ ...al, authors: al.authors.filter((a) => a !== id) })).filter((al) => al.authors.length > 0);
  if (run.voices.length < 2) {
    fs.rmSync(yamlFile);
    fs.rmSync(jsonFile, { force: true });
    console.log(`${run.id}: fewer than two agents left, run deleted`);
    continue;
  }
  run.positions = corpus.branches
    .map((b) => {
      const ps = run.voices.filter((v) => corpus.authorById[v.author].branch === b.id).map((v) => v.position);
      return ps.length ? { branch: b.id, score: median(ps), min: Math.min(...ps), max: Math.max(...ps), agents: ps.length } : null;
    })
    .filter(Boolean);
  run.settings.agents = run.voices.length + run.silent.length;
  run.withdrawn = (run.withdrawn ?? 0) + 1;
  fs.writeFileSync(yamlFile, `${header ? `${header}\n` : ''}${YAML.stringify(run, { lineWidth: 0 })}`);

  if (record) {
    record.transcript = (record.transcript ?? []).filter((e) => e.author !== id && e.to !== id);
    record.interviews = (record.interviews ?? []).filter((s) => s.author !== id);
    if (record.prompts?.agents) delete record.prompts.agents[id];
    fs.writeFileSync(jsonFile, `${JSON.stringify(record, null, 2)}\n`);
  }
  console.log(`${run.id}: ${corpus.authorById[id].name} agent withdrawn`);
}
console.log(touched ? `Done: ${touched} run(s) changed. The summary and the alliance texts were written with this agent present: reread them.` : 'No stored run contains this agent.');
