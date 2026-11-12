#!/usr/bin/env node
// Renumbers the stored runs from clr-0001 upwards, in their current order,
// after deleting the runs named with --drop. Rewrites the header line, `id`,
// `runId` and the transcript's `runId`, nothing else.
//   node clearing/renumber.mjs --drop clr-0001
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const RUNS = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'clearing', 'runs');
const { values } = parseArgs({ options: { drop: { type: 'string', multiple: true, default: [] } } });
for (const id of values.drop) {
  if (!/^clr-\d{4}$/.test(id)) throw new Error(`bad id ${id}`);
  for (const ext of ['.yaml', '.transcript.json']) fs.rmSync(path.join(RUNS, id + ext), { force: true });
  console.log(`deleted ${id}`);
}
const ids = fs.readdirSync(RUNS).map((f) => f.match(/^(clr-\d{4})\.yaml$/)?.[1]).filter(Boolean).sort();
const move = (from, to) => {
  if (from === to) return;
  let yaml = fs.readFileSync(path.join(RUNS, `${from}.yaml`), 'utf8');
  yaml = yaml
    .replace(new RegExp(`^# Clearing run ${from}\\.`, 'm'), `# Clearing run ${to}.`)
    .replace(new RegExp(`^id: ${from}$`, 'm'), `id: ${to}`)
    .replace(new RegExp(`^runId: ${from}$`, 'm'), `runId: ${to}`);
  const tr = JSON.parse(fs.readFileSync(path.join(RUNS, `${from}.transcript.json`), 'utf8'));
  tr.runId = to;
  fs.writeFileSync(path.join(RUNS, `${to}.yaml`), yaml);
  fs.writeFileSync(path.join(RUNS, `${to}.transcript.json`), `${JSON.stringify(tr, null, 2)}\n`);
  fs.rmSync(path.join(RUNS, `${from}.yaml`));
  fs.rmSync(path.join(RUNS, `${from}.transcript.json`));
};
// Two passes through temporary names, so that no rename overwrites a run.
const tmp = ids.map((id, i) => [id, `clr-${String(9000 + i)}`]);
for (const [from, t] of tmp) move(from, t);
tmp.forEach(([from, t], i) => {
  const to = `clr-${String(i + 1).padStart(4, '0')}`;
  move(t, to);
  console.log(`${from} -> ${to}`);
});
