// Checks the corpus before every build: references, bilingual fields and the
// editorial rules of the brand book (design/brand.md). Errors fail the build;
// warnings list what is still missing.
import { loadCorpus, loadClearing, LINK_TYPES, LAYERS, WORK_KINDS } from '../src/lib/corpus.mjs';
import { wordCount } from '../src/lib/text.mjs';

const c = loadCorpus();
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const bilingual = (v, where) => {
  if (!v || typeof v !== 'object' || !v.en || !v.fr) err(`${where}: needs both "en" and "fr"`);
};
const idRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Branches and root groups
for (const b of c.branches) {
  if (!idRe.test(b.id)) err(`branch ${b.id}: bad id`);
  bilingual(b.name, `branch ${b.id}.name`);
  bilingual(b.full, `branch ${b.id}.full`);
  bilingual(b.summary, `branch ${b.id}.summary`);
  if (b.authors.length < 3) err(`branch ${b.id}: the tree shows three leaves, found ${b.authors.length}`);
}
for (const g of c.rootGroups) {
  bilingual(g.name, `root group ${g.id}.name`);
  bilingual(g.summary, `root group ${g.id}.summary`);
  bilingual(g.marker?.text, `root group ${g.id}.marker.text`);
  if (g.authors.length === 0) err(`root group ${g.id}: no author`);
}

// Authors
const seenAuthors = new Set();
const seenWorks = new Set();
for (const a of c.authors) {
  const at = `author ${a.id} (${a.file})`;
  if (!idRe.test(a.id ?? '')) err(`${at}: bad id`);
  if (seenAuthors.has(a.id)) err(`${at}: duplicate id`);
  seenAuthors.add(a.id);
  if (!a.name || !a.sort) err(`${at}: name and sort are required`);
  if (!LAYERS.includes(a.layer)) err(`${at}: layer must be one of ${LAYERS.join(', ')}`);
  if (a.layer === 'leaf' && !c.branchById[a.branch]) err(`${at}: unknown branch "${a.branch}"`);
  if (a.layer === 'root' && !c.rootGroupById[a.root]) err(`${at}: unknown root group "${a.root}"`);
  for (const b of a.also) if (!c.branchById[b]) err(`${at}: unknown secondary branch "${b}"`);
  bilingual(a.lede, `${at}.lede`);
  if (a.born != null && a.died != null && a.died < a.born) err(`${at}: died before born`);
  if (a.wikidata && !/^Q\d+$/.test(a.wikidata)) err(`${at}: wikidata must look like Q123`);
  if (a.place) {
    bilingual(a.place.country, `${at}.place.country`);
    if (a.place.city) bilingual(a.place.city, `${at}.place.city`);
    const { lat, lon } = a.place;
    if ((lat == null) !== (lon == null)) err(`${at}: lat and lon go together`);
    if (lat != null && (Math.abs(lat) > 90 || Math.abs(lon) > 180)) err(`${at}: coordinates out of range`);
  }
  if (a.seeds.length > 3) err(`${at}: three seeds, never more (found ${a.seeds.length})`);
  for (const s of a.seeds) {
    if (!c.seeds[s.seed]) err(`${at}: seed "${s.seed}" is not in data/seeds.yaml`);
    bilingual(s.text, `${at}.seeds.${s.seed}.text`);
    if (!s.source) err(`${at}: seed "${s.seed}" has no source`);
  }
  for (const w of a.works) {
    const wt = `${at} work ${w.id}`;
    if (!idRe.test(w.id ?? '')) err(`${wt}: bad id`);
    if (seenWorks.has(w.id)) err(`${wt}: duplicate work id`);
    seenWorks.add(w.id);
    if (!Number.isInteger(w.year)) err(`${wt}: year must be a number`);
    if (!w.title) err(`${wt}: title is required`);
    if (!WORK_KINDS.includes(w.kind)) err(`${wt}: kind must be one of ${WORK_KINDS.join(', ')}`);
    if (w.note) bilingual(w.note, `${wt}.note`);
    if (w.by) bilingual(w.by, `${wt}.by`);
  }
  if (a.quote) {
    if (!a.quote.source) err(`${at}: a quote needs a citation (no citation, no quote)`);
    if (wordCount(a.quote.text) > 25) err(`${at}: quotes stay under 25 words (${wordCount(a.quote.text)})`);
    if (!['en', 'fr'].includes(a.quote.lang)) err(`${at}: quote.lang must be en or fr`);
  }
  if (!a.wikidata) warn(`${a.name}: no Wikidata QID yet`);
  if (a.born == null) warn(`${a.name}: no dates yet (left off the Rings view)`);
  if (a.place?.lat == null) warn(`${a.name}: no coordinates yet (left off the Terrain view)`);
}

// Every cited source must exist
const need = (id, where) => {
  if (id && !c.sources.has(id)) err(`${where}: unknown source "${id}"`);
};
for (const a of c.authors) {
  for (const s of a.seeds) need(s.source, `author ${a.id} seed ${s.seed}`);
  if (a.quote) need(a.quote.source, `author ${a.id} quote`);
}
for (const s of c.sources.values()) {
  if (s.secondary) {
    bilingual(s.by, `source ${s.id}.by`);
    if (!s.title || !s.year) err(`source ${s.id}: title and year are required`);
  }
}

// Seeds
for (const s of Object.values(c.seeds)) {
  bilingual(s.name, `seed ${s.id}.name`);
  if (s.carriers.length === 0) warn(`seed "${s.id}": carried by no author`);
}

// Links
const pairSeen = new Set();
for (const l of c.links) {
  const lt = `link ${l.from} -> ${l.to}`;
  if (!c.authorById[l.from]) err(`${lt}: unknown author "${l.from}"`);
  if (!c.authorById[l.to]) err(`${lt}: unknown author "${l.to}"`);
  if (l.from === l.to) err(`${lt}: an author cannot link to themselves`);
  if (!LINK_TYPES.includes(l.type)) err(`${lt}: type must be one of ${LINK_TYPES.join(', ')}`);
  bilingual(l.note, `${lt}.note`);
  if (l.label) bilingual(l.label, `${lt}.label`);
  if (l.status === 'to-verify') {
    warn(`${lt}: source to verify (kept off the Mycelium graph)`);
  } else {
    if (!l.source) err(`${lt}: no source, no link`);
    need(l.source, lt);
  }
  const key = `${l.from}>${l.to}>${l.type}`;
  if (pairSeen.has(key)) err(`${lt}: duplicate link of type ${l.type}`);
  pairSeen.add(key);
}

// Trunk
for (const t of c.trunk) {
  if (!t.source) err(`trunk: unknown work "${t.work}"`);
  bilingual(t.text, `trunk ${t.work}.text`);
}

// Clearing: the specimen and any published run must point to real branches, authors and works
const clearing = loadClearing();
for (const run of [clearing.specimen, ...clearing.runs].filter(Boolean)) {
  const rt = `clearing ${run.id}`;
  bilingual(run.claim, `${rt}.claim`);
  for (const p of run.positions ?? []) {
    if (!c.branchById[p.branch]) err(`${rt}: unknown branch "${p.branch}"`);
    if (!(p.score >= 0 && p.score <= 100)) err(`${rt}: score of ${p.branch} must be between 0 and 100`);
  }
  for (const al of run.alliances ?? []) {
    bilingual(al.title, `${rt}.alliance.title`);
    bilingual(al.text, `${rt}.alliance.text`);
    for (const b of al.branches) if (!c.branchById[b]) err(`${rt}: unknown branch "${b}" in an alliance`);
  }
  for (const v of run.voices ?? []) {
    if (!c.authorById[v.author]) err(`${rt}: unknown author "${v.author}"`);
    need(v.work, `${rt} voice ${v.author}`);
    bilingual(v.text, `${rt}.voice ${v.author}.text`);
    if (/["“”«»]/.test(v.text.en + v.text.fr)) err(`${rt}: a simulated voice is never set in quotation marks (${v.author})`);
  }
  if (run.status !== 'specimen' && !run.runId) err(`${rt}: a published run needs a runId and a date`);
}

const linked = new Set(c.sourcedLinks.flatMap((l) => [l.from, l.to]));
for (const a of c.authors) if (!linked.has(a.id)) warn(`${a.name}: no sourced link yet (stands alone in the Mycelium)`);

const summary = [
  `${c.authors.length} authors`,
  `${c.treeBranches.length} branches + ${c.graftBranches.length} graft`,
  `${c.rootGroups.length} root groups`,
  `${Object.keys(c.seeds).length} seeds`,
  `${c.sourcedLinks.length} sourced links`,
  `${c.links.length - c.sourcedLinks.length} to verify`,
  `${c.sources.size} sources`,
].join(' · ');

if (process.argv.includes('--quiet') === false && warnings.length) {
  console.log(`\nWarnings (${warnings.length})`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.error(`\nErrors (${errors.length})`);
  for (const e of errors) console.error(`  x ${e}`);
  console.error(`\nvalidate: FAILED · ${summary}`);
  process.exit(1);
}
console.log(`\nvalidate: ok · ${summary}`);
