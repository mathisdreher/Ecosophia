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

/** Clearing material: the hand-written specimen and, later, published runs. */
export function loadClearing() {
  const dir = path.join(DATA, 'clearing');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort() : [];
  const all = files.map((f) => readYaml(path.join('clearing', f)));
  return {
    specimen: all.find((r) => r.status === 'specimen') ?? null,
    runs: all.filter((r) => r.status !== 'specimen'),
  };
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
