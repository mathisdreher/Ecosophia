const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function GET({ site }) {
  const origin = site ?? new URL('http://localhost:4321');
  const sitemap = new URL(`${BASE}/sitemap.xml`, origin).toString();
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
