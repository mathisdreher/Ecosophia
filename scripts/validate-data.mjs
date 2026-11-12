// Checks the corpus before every build: references, bilingual fields and the
// editorial rules of the brand book (design/brand.md). Errors fail the build;
// warnings list what is still missing.
import fs from 'node:fs';
import path from 'node:path';
import { loadCorpus, loadClearing, loadClaims, loadQuestions, loadPortraits, loadCanopy, CANOPY_AXES, loadTranscript, LINK_TYPES, LAYERS, WORK_KINDS } from '../src/lib/corpus.mjs';
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
  if (a.agent != null && typeof a.agent !== 'boolean') err(`${at}: agent must be true or false (false withdraws the author from the Clearing)`);
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

// Canopy placements
const placed = new Set();
for (const p of loadCanopy()) {
  const pt = `canopy ${p.author} ${p.axis}`;
  const a = c.authorById[p.author];
  if (!a) {
    err(`${pt}: unknown author`);
    continue;
  }
  if (placed.has(`${p.author}|${p.axis}`)) err(`${pt}: placed twice`);
  placed.add(`${p.author}|${p.axis}`);
  if (!Number.isInteger(p.score) || p.score < 0 || p.score > 100) err(`${pt}: score must be a whole number from 0 to 100`);
  const w = c.sources.get(p.source);
  if (!w) err(`${pt}: unknown work "${p.source}"`);
  else if (w.authorId !== p.author) err(`${pt}: "${p.source}" is not a work of ${a.name}`);
  bilingual(p.note, `${pt}.note`);
}

// Portraits
for (const [id, p] of loadPortraits()) {
  if (!c.authorById[id]) err(`portrait ${id}: no such author`);
  if (!['drawn', 'refused'].includes(p.status)) err(`portrait ${id}: status must be drawn or refused`);
  if (p.status === 'drawn' && !fs.existsSync(path.join(process.cwd(), 'public', 'portraits', `${id}.webp`))) err(`portrait ${id}: public/portraits/${id}.webp is missing`);
}
for (const a of c.authors) if (a.portrait != null && typeof a.portrait !== 'boolean') err(`${a.name}: portrait must be true or false`);

// Clearing: the hand-written specimen
const clearing = loadClearing();
const QUOTES = /["“”«»]/;
if (clearing.specimen) {
  const run = clearing.specimen;
  const rt = 'clearing specimen';
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
    if (QUOTES.test(v.text.en + v.text.fr)) err(`${rt}: a simulated voice is never set in quotation marks (${v.author})`);
  }
}

// Clearing: claims taken from party programmes
const claims = loadClaims();
const claimIds = new Set();
for (const k of claims) {
  const kt = `claim ${k.id}`;
  if (!/^[a-z0-9-]+$/.test(String(k.id))) err(`${kt}: an id is lowercase ascii with dashes`);
  if (claimIds.has(k.id)) err(`${kt}: duplicate id`);
  claimIds.add(k.id);
  if (!k.party?.short || !k.party?.name) err(`${kt}: party.short and party.name are required`);
  if (!k.programme?.title || !Number.isInteger(k.programme?.year) || !/^https:\/\//.test(k.programme?.url ?? '')) err(`${kt}: programme needs a title, a year and an https address`);
  if (!k.locator) err(`${kt}: locator (section or page) is required`);
  if (!k.quote || k.quote.split(/\s+/).length > 60) err(`${kt}: a verbatim quotation of 60 words at most is required`);
  bilingual(k.claim, `${kt}.claim`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(k.checked))) err(`${kt}: checked must be the date the quotation was read (YYYY-MM-DD)`);
}

// Clearing: questions that gather the measures
const questions = loadQuestions(claims);
const questionIds = new Set();
for (const q of questions) {
  const qt = `question ${q.id}`;
  if (!/^[a-z0-9-]+$/.test(String(q.id))) err(`${qt}: an id is lowercase ascii with dashes`);
  if (questionIds.has(q.id) || claimIds.has(q.id)) err(`${qt}: the id is already used by a question or a claim`);
  questionIds.add(q.id);
  bilingual(q.claim, `${qt}.claim`);
  if (q.kind != null && q.kind !== 'axiom') err(`${qt}: kind must be axiom or absent`);
  if (q.kind === 'axiom') {
    if (q.measures?.length) err(`${qt}: an axiom carries no party measure`);
    if (q.note) bilingual(q.note, `${qt}.note`);
  } else if (!(q.measures?.length > 0)) err(`${qt}: no measure`);
  for (const m of q.measures ?? []) {
    if (!m.claim) err(`${qt}: unknown measure "${m.id}" (not in claims.yaml)`);
    if (!['for', 'against', 'partly'].includes(m.stance)) err(`${qt}: stance of ${m.id} must be for, against or partly`);
  }
}

// Clearing: runs written by clearing/run.mjs
const inRange = (n) => Number.isInteger(n) && n >= 0 && n <= 100;
for (const run of clearing.runs) {
  const rt = `clearing run ${run.id}`;
  if (!/^clr-\d{4}$/.test(String(run.id))) err(`${rt}: a run id looks like clr-0001`);
  if (run.file !== `${run.id}.yaml`) err(`${rt}: the file must be named ${run.id}.yaml (found ${run.file})`);
  if (run.runId !== run.id) err(`${rt}: runId must repeat the id`);
  if (!['draft', 'published'].includes(run.status)) err(`${rt}: status must be draft or published`);
  if (run.dryRun) err(`${rt}: a dry run is filler made by a stand-in model and is never stored in data/`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(run.date))) err(`${rt}: date must be YYYY-MM-DD`);
  bilingual(run.claim, `${rt}.claim`);
  bilingual(run.summary, `${rt}.summary`);
  if (!run.engine?.name || !run.engine?.commit) err(`${rt}: the engine and its commit are required`);
  if (!run.model?.requested) err(`${rt}: the model is required`);
  if (!(run.settings?.rounds > 0) || !(run.settings?.agents > 0)) err(`${rt}: settings.rounds and settings.agents are required`);
  for (const k of ['turns', 'comments', 'tokensIn', 'tokensOut', 'declined', 'failed']) {
    if (!Number.isInteger(run.counts?.[k])) err(`${rt}: counts.${k} is required`);
  }
  if (!(run.positions?.length > 0)) err(`${rt}: no branch position`);
  for (const p of run.positions ?? []) {
    if (!c.branchById[p.branch]) err(`${rt}: unknown branch "${p.branch}"`);
    for (const k of ['score', 'min', 'max']) if (!inRange(p[k])) err(`${rt}: ${k} of ${p.branch} must be a whole number between 0 and 100`);
  }
  const agentOk = (id, where) => {
    const a = c.authorById[id];
    if (!a) return err(`${rt}: unknown author "${id}" in ${where}`);
    if (a.layer !== 'leaf') err(`${rt}: ${id} is not a leaf and cannot be an agent (${where})`);
    if (a.agent === false) err(`${rt}: ${a.name} is marked agent: false. Remove this agent from the run with: node clearing/withdraw.mjs ${id}`);
  };
  const placed = new Set();
  if (!(run.alliances?.length > 0)) err(`${rt}: no alliance`);
  for (const al of run.alliances ?? []) {
    bilingual(al.title, `${rt}.alliance.title`);
    bilingual(al.text, `${rt}.alliance.text`);
    for (const id of al.authors ?? []) {
      agentOk(id, 'an alliance');
      if (placed.has(id)) err(`${rt}: ${id} appears in two alliances`);
      placed.add(id);
    }
  }
  if (!(run.voices?.length > 0)) err(`${rt}: no voice`);
  for (const v of run.voices ?? []) {
    agentOk(v.author, 'a voice');
    if (!inRange(v.position)) err(`${rt}: position of ${v.author} must be a whole number between 0 and 100`);
    bilingual(v.text, `${rt}.voice ${v.author}.text`);
    if (QUOTES.test(`${v.text?.en}${v.text?.fr}`)) err(`${rt}: a simulated voice is never set in quotation marks (${v.author})`);
    if (v.work && c.sources.get(v.work)?.authorId !== v.author) err(`${rt}: work "${v.work}" is not a work of ${v.author}`);
  }
  for (const id of run.silent ?? []) agentOk(id, 'the silent list');
  if (run.claimSource && !claimIds.has(run.claimSource.id)) warn(`${rt}: claim ${run.claimSource.id} is no longer in data/clearing/claims.yaml`);
  const record = loadTranscript(run.id);
  if (!record) err(`${rt}: ${run.id}.transcript.json is missing next to the run`);
  else {
    if (record.runId !== run.id) err(`${rt}: the transcript belongs to another run (${record.runId})`);
    if (!(record.transcript?.length > 0)) err(`${rt}: the transcript is empty`);
    for (const e of record.transcript ?? []) if (e.author) agentOk(e.author, 'the transcript');
    for (const id of Object.keys(record.prompts?.agents ?? {})) agentOk(id, 'the prompts');
  }
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
  `${clearing.runs.length} Clearing runs (${clearing.published.length} published)`,
  `${claims.length} programme measures in ${questions.length} questions`,
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
