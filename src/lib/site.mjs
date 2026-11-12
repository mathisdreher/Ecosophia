// Helpers that need the Astro build environment (base path, site URL).
import { pathFor } from '../i18n/routes.mjs';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefixes a site-relative path with the deployment base (/Ecosophia on GitHub Pages). */
export function withBase(p) {
  return `${BASE}${p.startsWith('/') ? p : `/${p}`}`;
}

/** Link to a view in a language: href('fr', 'author', 'arne-naess'). */
export function href(lang, view = 'home', id, hash) {
  return withBase(pathFor(lang, view, id)) + (hash ? `#${hash}` : '');
}

/** Absolute URL, for canonical and hreflang links. */
export function absolute(site, p) {
  return new URL(withBase(p), site).toString();
}
