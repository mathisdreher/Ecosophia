#!/usr/bin/env node
// Publishes a draft run, takes a published run back to draft, or deletes a run.
//
//   node clearing/status.mjs clr-0001 published
//   node clearing/status.mjs clr-0001 draft
//   node clearing/status.mjs clr-0001 delete
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.ECOSOPHIA_ROOT ?? process.cwd();
const [id, action] = process.argv.slice(2);
if (!/^clr-\d{4}$/.test(id ?? '') || !['published', 'draft', 'delete'].includes(action)) {
  console.error('status: usage: node clearing/status.mjs clr-0001 published|draft|delete');
  process.exit(2);
}
const yamlFile = path.join(ROOT, 'data', 'clearing', 'runs', `${id}.yaml`);
if (!fs.existsSync(yamlFile)) {
  console.error(`status: no run ${id} in data/clearing/runs`);
  process.exit(1);
}
if (action === 'delete') {
  fs.rmSync(yamlFile);
  fs.rmSync(yamlFile.replace(/\.yaml$/, '.transcript.json'), { force: true });
  console.log(`${id}: deleted`);
} else {
  const source = fs.readFileSync(yamlFile, 'utf8');
  if (!/^status: .*$/m.test(source)) {
    console.error(`status: ${id}.yaml has no status line`);
    process.exit(1);
  }
  fs.writeFileSync(yamlFile, source.replace(/^status: .*$/m, `status: ${action}`));
  console.log(`${id}: ${action}`);
}
