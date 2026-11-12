// After a build: every internal link and every #anchor in dist/ must resolve.
// Catches a mistyped id in the data or a route missing in one language.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.join(process.cwd(), 'dist');
const base = (process.env.BASE_PATH || '/').replace(/\/$/, '');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const files = walk(dist);
const pages = files.filter((f) => f.endsWith('.html'));
const idsOf = new Map();
const htmlOf = new Map();
for (const f of pages) {
  const html = fs.readFileSync(f, 'utf8');
  htmlOf.set(f, html);
  idsOf.set(f, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}

function resolve(urlPath) {
  let p = decodeURIComponent(urlPath);
  if (base && p.startsWith(base)) p = p.slice(base.length) || '/';
  const target = path.join(dist, p);
  if (p.endsWith('/')) return path.join(target, 'index.html');
  return target;
}

const problems = [];
let checked = 0;
for (const [file, html] of htmlOf) {
  const from = path.relative(dist, file);
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const raw = m[1].replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|data:|#$)/.test(raw)) continue;
    let [urlPath, hash] = raw.split('#');
    urlPath = urlPath.split('?')[0];
    let target = file;
    if (urlPath) {
      if (!urlPath.startsWith('/')) {
        problems.push(`${from}: relative link "${raw}" (links must start with the base path)`);
        continue;
      }
      if (base && !urlPath.startsWith(`${base}/`) && urlPath !== base) {
        problems.push(`${from}: link "${raw}" ignores the base path "${base}"`);
        continue;
      }
      target = resolve(urlPath);
      if (!fs.existsSync(target)) {
        problems.push(`${from}: broken link "${raw}"`);
        continue;
      }
    }
    checked += 1;
    if (hash && target.endsWith('.html') && !idsOf.get(target)?.has(decodeURIComponent(hash))) {
      problems.push(`${from}: no element with id "${hash}" in ${path.relative(dist, target)}`);
    }
  }
}

if (problems.length) {
  console.error(`links: ${problems.length} problem(s)`);
  for (const p of [...new Set(problems)].slice(0, 60)) console.error(`  x ${p}`);
  process.exit(1);
}
console.log(`links: ok · ${pages.length} pages · ${checked} internal links checked`);
