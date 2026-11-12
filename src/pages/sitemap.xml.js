// Sitemap with hreflang alternates for every page in both languages.
import { loadCorpus } from '../lib/corpus.mjs';
import { allRoutes, pathFor, LANGS } from '../i18n/routes.mjs';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function GET({ site }) {
  const origin = site ?? new URL('http://localhost:4321');
  const abs = (p) => new URL(`${BASE}${p}`, origin).toString();
  const routes = allRoutes(loadCorpus());
  const urls = routes
    .map((r) => {
      const alternates = LANGS.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(pathFor(l, r.view, r.id))}"/>`,
      ).join('\n');
      return `  <url>\n    <loc>${abs(r.path)}</loc>\n${alternates}\n  </url>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
