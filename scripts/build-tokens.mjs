// One source for colour, type, space, radius and stroke: design/tokens.json,
// exported from the Ecosophia design system. This script turns it into CSS
// custom properties for the two themes (Day and Night forest).
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tokens = JSON.parse(fs.readFileSync(path.join(root, 'design/tokens.json'), 'utf8'));

const themes = tokens.color.themes.map((t) => t.id); // ['light', 'dark']
const first = themes[0];

function colourValue(token, theme, seen = new Set()) {
  let v = typeof token.value === 'string' ? token.value : (token.value[theme] ?? token.value[first]);
  const alias = /^\{(.+)\}$/.exec(v);
  if (alias) {
    if (seen.has(alias[1])) throw new Error(`Alias loop on ${token.name}`);
    seen.add(alias[1]);
    const target = tokens.color.tokens.find((t) => t.name === alias[1]);
    if (!target) throw new Error(`Alias of a missing token: ${token.name} -> ${alias[1]}`);
    return colourValue(target, theme, seen);
  }
  return v;
}

function block(theme) {
  return tokens.color.tokens.map((t) => `  --${t.name}: ${colourValue(t, theme)};`).join('\n');
}

const scalar = ['spacing', 'radius', 'stroke']
  .flatMap((family) => tokens[family]?.tokens ?? [])
  .map((t) => `  --${t.name}: ${t.value};`)
  .join('\n');

// The site self-hosts the three families (Fontsource) instead of calling
// Google Fonts, so the variable-font names come first in each stack.
const families = {
  display: `"Fraunces Variable", ${tokens.type.families.display}`,
  sans: `"Instrument Sans Variable", ${tokens.type.families.sans}`,
  mono: tokens.type.families.mono,
};
const fonts = Object.entries(families)
  .map(([k, v]) => `  --font-${k}: ${v};`)
  .join('\n');

const css = `/* ${tokens.name}: generated from design/tokens.json by scripts/build-tokens.mjs. Do not edit. */
:root {
  color-scheme: light;
${block('light')}
${scalar}
${fonts}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${block('dark').replace(/^/gm, '  ')}
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
${block('dark')}
}
`;

const out = path.join(root, 'src/styles/tokens.css');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, css);
console.log(`tokens: ${tokens.color.tokens.length} colours, 2 themes -> src/styles/tokens.css`);
