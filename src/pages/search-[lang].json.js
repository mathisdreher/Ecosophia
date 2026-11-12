// The search index, one small JSON file per language, built with the site.
import { loadCorpus, lifespan } from '../lib/corpus.mjs';
import { L, fold, typo, yearLabel } from '../lib/text.mjs';
import { LANGS, pathFor } from '../i18n/routes.mjs';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function getStaticPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

export function GET({ params }) {
  const { lang } = params;
  const c = loadCorpus();
  const url = (view, id, hash) => `${BASE}${pathFor(lang, view, id)}${hash ? `#${hash}` : ''}`;
  const entries = [];

  for (const a of c.authorsByName) {
    const group =
      a.layer === 'leaf' ? L(c.branchById[a.branch].name, lang) : a.layer === 'root' ? L(c.rootGroupById[a.root].name, lang) : lang === 'fr' ? 'Tronc' : 'Trunk';
    entries.push({ k: 'author', l: a.name, s: [lifespan(a, lang), group].filter(Boolean).join(' · '), u: url('author', a.id), f: fold(`${a.name} ${group}`) });
    for (const w of a.works) {
      const title = typo(typeof w.title === 'string' ? w.title : w.title.en, lang);
      const tr = w.tr ? ` ${w.tr[lang] ?? w.tr.en ?? ''}` : '';
      entries.push({ k: 'work', l: title, s: `${a.name}, ${yearLabel(w)}`, u: url('author', a.id), f: fold(`${title}${tr} ${a.name}`) });
    }
  }
  for (const b of c.branches) {
    entries.push({ k: 'branch', l: L(b.name, lang), s: L(b.full, lang), u: url('branch', b.id), f: fold(`${L(b.name, lang)} ${L(b.full, lang)} ${b.name.en}`) });
  }
  for (const s of Object.values(c.seeds)) {
    if (s.carriers.length === 0) continue;
    const who = s.carriers.map((k) => c.authorById[k.author].short).join(', ');
    entries.push({ k: 'seed', l: L(s.name, lang), s: who, u: url('seeds', undefined, s.id), f: fold(`${L(s.name, lang)} ${s.name.en} ${who}`) });
  }

  return new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
