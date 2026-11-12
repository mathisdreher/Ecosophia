// Build-time layout of the Mycelium graph. The positions are computed once,
// with a seeded random source, so every build draws the same picture and the
// browser receives plain SVG.
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';
import { influenceReceived } from './corpus.mjs';

export const GRAPH_W = 900;
export const GRAPH_H = 1080;

// Labels are wider than they are tall. The simulation runs in a space squeezed
// horizontally by KX, so that its circular collisions become wide ellipses on
// the page and names do not sit on top of one another.
const KX = 2.5;

function lcg(seed = 7) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

/** Which filter group a node belongs to: its branch, or "roots" / "trunk". */
export function groupOf(author) {
  return author.layer === 'leaf' ? author.branch : author.layer === 'root' ? 'roots' : 'trunk';
}

/** Node radius: area proportional to the influence received (design/brand.md, "Graph grammar"). */
export function radiusOf(author) {
  return Math.round(6.5 * Math.sqrt(1 + influenceReceived(author)) * 10) / 10;
}

// Where each school gathers. Neighbours on this grid are schools that answer
// each other most; precursors gather lower down, under the leaves.
const BRANCH_ANCHORS = {
  technocritique: [150, 120],
  degrowth: [400, 110],
  'political-ecology': [650, 180],
  decolonial: [780, 360],
  'social-ecology': [130, 420],
  ecosocialism: [400, 330],
  anthropocene: [640, 470],
  counterpoint: [790, 620],
  'deep-ecology': [200, 640],
  ecosophy: [430, 600],
  ecofeminism: [600, 700],
  'queer-ecology': [780, 800],
};
const ROOT_ANCHORS = {
  'anarchist-geographers': [120, 800],
  unity: [400, 800],
  energetics: [130, 980],
  'political-economy': [380, 960],
  physiocrats: [560, 1010],
  romantics: [600, 880],
  naturalists: [780, 980],
};
const TRUNK_ANCHOR = [280, 240];

export function layoutGraph(corpus) {
  const { authors, sourcedLinks } = corpus;

  const random = lcg(11);
  const nodes = authors.map((a) => {
    const at =
      a.layer === 'leaf'
        ? (BRANCH_ANCHORS[a.branch] ?? [GRAPH_W / 2, GRAPH_H / 2])
        : a.layer === 'root'
          ? (ROOT_ANCHORS[a.root] ?? [GRAPH_W / 2, GRAPH_H - 120])
          : TRUNK_ANCHOR;
    return {
      id: a.id,
      ax: at[0] / KX,
      ay: at[1],
      x: at[0] / KX + (random() - 0.5) * 30,
      y: at[1] + (random() - 0.5) * 60,
      r: radiusOf(a),
    };
  });
  const links = sourcedLinks.map((l) => ({ source: l.from, target: l.to, type: l.type }));

  const sim = forceSimulation(nodes)
    .randomSource(lcg(23))
    .force('link', forceLink(links).id((d) => d.id).distance(70).strength(0.06))
    .force('charge', forceManyBody().strength(-60).distanceMax(220))
    .force('collide', forceCollide().radius((d) => 25 + d.r * 0.5).strength(1).iterations(4))
    .force('x', forceX((d) => d.ax).strength(0.16))
    .force('y', forceY((d) => d.ay).strength(0.16))
    .stop();

  const minX = 74 / KX;
  const maxX = (GRAPH_W - 74) / KX;
  for (let i = 0; i < 700; i += 1) {
    sim.tick();
    for (const n of nodes) {
      n.x = Math.max(minX, Math.min(maxX, n.x));
      n.y = Math.max(34, Math.min(GRAPH_H - 40, n.y));
    }
  }

  const round = (v) => Math.round(v * 10) / 10;
  const pos = new Map(nodes.map((n) => [n.id, { x: round(n.x * KX), y: round(n.y), r: n.r }]));

  const edges = sourcedLinks.map((l) => {
    const a = pos.get(l.from);
    const b = pos.get(l.to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const startGap = a.r + 3;
    const endGap = b.r + (l.type === 'dialogue' ? 3 : 9);
    return {
      link: l,
      x1: round(a.x + ux * startGap),
      y1: round(a.y + uy * startGap),
      x2: round(b.x - ux * endGap),
      y2: round(b.y - uy * endGap),
    };
  });

  return { pos, edges };
}
