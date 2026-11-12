// One route table for both languages. Every page of the site is a "view"
// (optionally with an id) and has a localised path:
//   /en/authors/arne-naess/   <->   /fr/auteurs/arne-naess/
import { SITE } from '../site.config.mjs';

export const LANGS = SITE.languages;

const SEGMENTS = {
  home: { en: '', fr: '' },
  mycelium: { en: 'mycelium', fr: 'mycelium' },
  rings: { en: 'rings', fr: 'cernes' },
  canopy: { en: 'canopy', fr: 'canopee' },
  terrain: { en: 'terrain', fr: 'terrain' },
  clearing: { en: 'clearing', fr: 'clairiere' },
  run: { en: 'clearing', fr: 'clairiere' },
  authors: { en: 'authors', fr: 'auteurs' },
  author: { en: 'authors', fr: 'auteurs' },
  branches: { en: 'branches', fr: 'branches' },
  branch: { en: 'branches', fr: 'branches' },
  roots: { en: 'roots', fr: 'racines' },
  trunk: { en: 'trunk', fr: 'tronc' },
  seeds: { en: 'seeds', fr: 'graines' },
  method: { en: 'method', fr: 'methode' },
  data: { en: 'data', fr: 'donnees' },
  brand: { en: 'brand', fr: 'marque' },
};

export const VIEWS = Object.keys(SEGMENTS);

/** The six tabs of the main navigation, in their fixed order. */
export const TABS = ['tree', 'mycelium', 'rings', 'canopy', 'terrain', 'clearing'];
export const TAB_VIEW = { tree: 'home', mycelium: 'mycelium', rings: 'rings', canopy: 'canopy', terrain: 'terrain', clearing: 'clearing' };

/** Which tab is lit for a given view: everything that hangs from the tree lights "Tree". */
export function tabOf(view) {
  if (view === 'run') return 'clearing';
  if (['mycelium', 'rings', 'canopy', 'terrain', 'clearing'].includes(view)) return view;
  if (['method', 'data', 'brand'].includes(view)) return null;
  return 'tree';
}

/** Path below the language prefix, without slashes at the ends ('' for home). */
export function slugFor(lang, view, id) {
  const seg = SEGMENTS[view]?.[lang];
  if (seg == null) throw new Error(`Unknown view "${view}"`);
  return [seg, id].filter(Boolean).join('/');
}

/** Site-relative path: /en/authors/arne-naess/ */
export function pathFor(lang, view = 'home', id) {
  const slug = slugFor(lang, view, id);
  return `/${lang}/${slug ? `${slug}/` : ''}`;
}

/**
 * Every page of the site, for getStaticPaths and the sitemap. Each Clearing
 * run has a page; a draft run is flagged `unlisted` and stays out of the sitemap.
 */
export function allRoutes(corpus, clearing = { runs: [] }) {
  const routes = [];
  for (const lang of LANGS) {
    for (const view of ['home', 'mycelium', 'rings', 'canopy', 'terrain', 'clearing', 'authors', 'branches', 'roots', 'trunk', 'seeds', 'method', 'data', 'brand']) {
      routes.push({ lang, view, id: undefined });
    }
    for (const a of corpus.authors) routes.push({ lang, view: 'author', id: a.id });
    for (const b of corpus.branches) routes.push({ lang, view: 'branch', id: b.id });
    for (const r of clearing.runs) routes.push({ lang, view: 'run', id: r.id, unlisted: r.status !== 'published' });
  }
  return routes.map((r) => ({ ...r, slug: slugFor(r.lang, r.view, r.id), path: pathFor(r.lang, r.view, r.id) }));
}
