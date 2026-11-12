import { defineConfig } from 'astro/config';

// In CI the deploy workflow passes the GitHub Pages origin and base path
// (SITE_URL, BASE_PATH). Locally the site runs at the root of localhost.
const site = process.env.SITE_URL || 'http://localhost:4321';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
