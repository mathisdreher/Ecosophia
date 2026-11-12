// Loads the corpus from data/*.yaml and returns one indexed object.
// Plain ESM so that the Astro site and the Node scripts share the same reader.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = process.env.ECOSOPHIA_ROOT ?? process.cwd();
const DATA = path.join(ROOT, 'data');

export const LINK_TYPES = ['influenced', 'critiqued', 'dialogue'];
export const LAYERS = ['root', 'trunk', 'leaf'];
export const WORK_KINDS = ['book', 'article', 'chapter', 'report', 'talk', 'letter'];

function readYaml(file) {
  return YAML.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
}

function initialsOf(name) {
  const parts = name
    .replace(/\b(von|van|de|du|d'|III|II|Jr\.?|D\.)\b/gi, ' ')
    .replace(/[^\p{L}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

let cache = null;

/** @returns the whole corpus, read once per process. */
export function loadCorpus() {
  if (cache) return cache;

  const branches = readYaml('branches.yaml').map((b, order) => ({ graft: false, ...b, order }));
  const branchById = Object.fromEntries(branches.map((b) => [b.id, b]));

  const rootGroups = readYaml('roots.yaml').map((g, order) => ({ ...g, order }));
  const rootGroupById = Object.fromEntries(rootGroups.map((g) => [g.id, g]));

  const seedNames = readYaml('seeds.yaml');
  const seeds = Object.fromEntries(
    Object.entries(seedNames).map(([id, name]) => [id, { id, name, carriers: [] }]),
  );

  // Authors: every *.yaml under data/authors, in file order.
  const authorFiles = fs
    .readdirSync(path.join(DATA, 'authors'))
    .filter((f) => f.endsWith('.yaml'))
    .sort();
  const authors = [];
  for (const file of authorFiles) {
    const list = readYaml(path.join('authors', file)) ?? [];
    list.forEach((a, index) => authors.push({ ...a, file, fileIndex: index }));
  }

  const sources = new Map();
  for (const a of authors) {
    a.also ??= [];
    a.seeds ??= [];
    a.works ??= [];
    a.short ??= a.sort;
    a.initials = initialsOf(a.name);
    a.living = a.died == null && (a.born == null || a.born > 1900);
    a.token =
      a.layer === 'leaf' ? (branchById[a.branch]?.token ?? 'ink') : a.layer === 'root' ? 'humus' : 'ink';
    a.inLinks = [];
    a.outLinks = [];
    for (const w of a.works) {
      w.kind ??= 'book';
      w.authorId = a.id;
      w.short = a.short;
      sources.set(w.id, w);
    }
  }
  for (const s of readYaml('sources.yaml') ?? []) {
    s.kind ??= 'book';
    s.secondary = true;
    sources.set(s.id, s);
  }

  const authorById = Object.fromEntries(authors.map((a) => [a.id, a]));

  for (const a of authors) {
    for (const s of a.seeds) {
      seeds[s.seed]?.carriers.push({ author: a.id, text: s.text, source: s.source });
    }
  }

  const links = (readYaml('links.yaml') ?? []).map((l, index) => ({
    status: 'sourced',
    ...l,
    index,
  }));
  for (const l of links) {
    authorById[l.from]?.outLinks.push(l);
    authorById[l.to]?.inLinks.push(l);
  }

  const trunk = (readYaml('trunk.yaml') ?? []).map((t) => ({ ...t, source: sources.get(t.work) }));

  // Derived listings.
  const collator = new Intl.Collator('en', { sensitivity: 'base' });
  const byName = [...authors].sort((x, y) => collator.compare(x.sort, y.sort));
  for (const b of branches) {
    b.authors = authors.filter((a) => a.layer === 'leaf' && a.branch === b.id);
    b.guests = authors.filter((a) => a.also.includes(b.id));
  }
  for (const g of rootGroups) {
    g.authors = authors.filter((a) => a.layer === 'root' && a.root === g.id);
  }

  cache = {
    branches,
    branchById,
    treeBranches: branches.filter((b) => !b.graft),
    graftBranches: branches.filter((b) => b.graft),
    rootGroups,
    rootGroupById,
    seeds,
    authors,
    authorsByName: byName,
    authorById,
    sources,
    links,
    sourcedLinks: links.filter((l) => l.status !== 'to-verify'),
    trunk,
  };
  return cache;
}

/**
 * Clearing material: the hand-written specimen, and the runs written by
 * clearing/run.mjs under data/clearing/runs. A draft run has its own page but
 * is listed nowhere; only published runs appear on the Clearing.
 */
export function loadClearing() {
  const dir = path.join(DATA, 'clearing');
  const specimenFile = path.join(dir, 'specimen.yaml');
  const specimen = fs.existsSync(specimenFile) ? readYaml(path.join('clearing', 'specimen.yaml')) : null;
  const runsDir = path.join(dir, 'runs');
  const files = fs.existsSync(runsDir) ? fs.readdirSync(runsDir).filter((f) => f.endsWith('.yaml')).sort() : [];
  const runs = files
    .map((f) => ({ ...readYaml(path.join('clearing', 'runs', f)), file: f }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
  return { specimen, runs, published: runs.filter((r) => r.status === 'published') };
}

/**
 * Portraits (data/portraits.yaml): which authors have a drawn portrait in
 * public/portraits. Everyone else gets one of two placeholders.
 */
export function loadPortraits() {
  const file = path.join(DATA, 'portraits.yaml');
  const list = fs.existsSync(file) ? (readYaml('portraits.yaml') ?? []) : [];
  return new Map(list.map((p) => [p.id, p]));
}

/** The image to show for an author: {src, drawn, model} (src is site-relative). */
export function portraitOf(author, portraits = loadPortraits()) {
  const p = portraits.get(author.id);
  if (author.portrait !== false && p?.status === 'drawn') return { src: `/portraits/${author.id}.webp`, drawn: true, model: p.model };
  const n = [...author.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 2;
  const placeholder = `/portraits/_placeholder-${n + 1}.webp`;
  const exists = fs.existsSync(path.join(ROOT, 'public', placeholder));
  return { src: exists ? placeholder : null, drawn: false, model: null };
}

export const CANOPY_AXES = ['nature', 'change', 'power'];

/** Canopy placements (data/canopy.yaml), flattened: {author, axis, score, source, note}. */
export function loadCanopy() {
  const file = path.join(DATA, 'canopy.yaml');
  const list = fs.existsSync(file) ? (readYaml('canopy.yaml') ?? []) : [];
  const out = [];
  for (const entry of list) {
    for (const axis of CANOPY_AXES) {
      const v = entry[axis];
      if (!v) continue;
      const [score, source, note] = v;
      out.push({ author: entry.author, axis, score, source, note });
    }
  }
  return out;
}

/** Claims taken from party programmes (data/clearing/claims.yaml). */
export function loadClaims() {
  const file = path.join(DATA, 'clearing', 'claims.yaml');
  return fs.existsSync(file) ? (readYaml(path.join('clearing', 'claims.yaml')) ?? []) : [];
}

/**
 * Questions (data/clearing/questions.yaml): one claim each, with the party
 * measures that answer it and Ecosophia's reading of their stance.
 */
export function loadQuestions(claims = loadClaims()) {
  const file = path.join(DATA, 'clearing', 'questions.yaml');
  const byId = new Map(claims.map((k) => [k.id, k]));
  const list = fs.existsSync(file) ? (readYaml(path.join('clearing', 'questions.yaml')) ?? []) : [];
  return list.map((q) => ({ ...q, measures: (q.measures ?? []).map((m) => ({ ...m, claim: byId.get(m.id) ?? null })) }));
}

/**
 * The party measures to show next to a run. They are Ecosophia's sourced
 * data, not output of the run (the agents never see a party), so a run shows
 * the current reading of its question; the copy stored in the run is the
 * fallback when the question no longer exists.
 */
export function runMeasures(run, questions = loadQuestions()) {
  if (!run.question) return null;
  const q = questions.find((x) => x.id === run.question.id);
  if (!q) return run.question.measures ?? [];
  return q.measures
    .filter((m) => m.claim)
    .map((m) => ({ id: m.id, stance: m.stance, party: m.claim.party, programme: m.claim.programme, locator: m.claim.locator, quote: m.claim.quote }));
}

/** The prompts, the transcript and the closing interviews of one run, or null. */
export function loadTranscript(runId) {
  const file = path.join(DATA, 'clearing', 'runs', `${runId}.transcript.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** Sourced influence links received by an author (drives node size). */
export function influenceReceived(author) {
  return author.inLinks.filter((l) => l.type === 'influenced' && l.status !== 'to-verify').length;
}

/** "1912–2009", "b. 1947" (French: "n. 1947"), or '' when dates are not sourced yet. */
export function lifespan(author, lang = 'en') {
  if (author.born == null) return '';
  if (author.died != null) return `${author.born}–${author.died}`;
  if (!author.living) return `${author.born}–`;
  return lang === 'fr' ? `n. ${author.born}` : `b. ${author.born}`;
}

export function placeLabel(author, lang = 'en') {
  const p = author.place;
  if (!p) return '';
  const city = p.city?.[lang] ?? p.city?.en;
  const country = p.country?.[lang] ?? p.country?.en;
  if (city && country && !city.includes(country)) return `${city}, ${country}`;
  return city ?? country ?? '';
}
