// Build-time layout of the Mycelium graph, as a ring. Precursors sit at the
// bottom, under the ground; then the trunk, the branches in the order of the
// tree, and the grafted counterpoints. Each group holds an arc of the circle,
// its authors in order of birth. Threads are curves that dive towards the
// centre, more deeply the further apart their ends are: the mycelium runs
// underneath everything. Everything is computed here; the browser gets SVG.
import { influenceReceived } from './corpus.mjs';

export const GRAPH_SIZE = 980;
const C = GRAPH_SIZE / 2;
const R = 318;
const GAP = 3; // empty slots between two groups

/** Which filter group a node belongs to: its branch, or "roots" / "trunk". */
export function groupOf(author) {
  return author.layer === 'leaf' ? author.branch : author.layer === 'root' ? 'roots' : 'trunk';
}

/** Node radius: area grows with the influence received (design/brand.md, "Graph grammar"). */
export function radiusOf(author) {
  return Math.round(Math.min(11, 3.5 + 2 * Math.sqrt(influenceReceived(author))) * 10) / 10;
}

const round = (v) => Math.round(v * 10) / 10;
const at = (angle, r) => [C + r * Math.cos(angle), C + r * Math.sin(angle)];

function arcPath(a0, a1, r, reverse = false) {
  const [x0, y0] = at(reverse ? a1 : a0, r);
  const [x1, y1] = at(reverse ? a0 : a1, r);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M${round(x0)} ${round(y0)}A${r} ${r} 0 ${large} ${reverse ? 0 : 1} ${round(x1)} ${round(y1)}`;
}

export function layoutRing(corpus) {
  const { authors, branches, sourcedLinks } = corpus;
  const order = ['roots', 'trunk', ...branches.filter((b) => !b.graft).map((b) => b.id), ...branches.filter((b) => b.graft).map((b) => b.id)];
  const byGroup = new Map(order.map((g) => [g, []]));
  for (const a of authors) byGroup.get(groupOf(a))?.push(a);
  for (const list of byGroup.values()) list.sort((x, y) => (x.born ?? 3000) - (y.born ?? 3000) || x.sort.localeCompare(y.sort));
  const groups = order.filter((g) => byGroup.get(g).length > 0);

  const slots = authors.length + GAP * groups.length;
  const step = (2 * Math.PI) / slots;
  // Centre the precursors on the bottom of the ring (angle pi/2, y downwards).
  const rootsSpan = byGroup.get('roots').length;
  let angle = Math.PI / 2 - ((rootsSpan - 1) / 2) * step;

  const pos = new Map();
  const arcs = [];
  for (const [gi, g] of groups.entries()) {
    const list = byGroup.get(g);
    const a0 = angle;
    for (const a of list) {
      const r = radiusOf(a);
      const [x, y] = at(angle, R);
      const deg = (angle * 180) / Math.PI;
      const left = Math.cos(angle) < 0;
      const [lx, ly] = at(angle, R + r + 6);
      pos.set(a.id, {
        x: round(x),
        y: round(y),
        r,
        angle,
        label: { x: round(lx), y: round(ly), rotate: round(left ? deg + 180 : deg), anchor: left ? 'end' : 'start' },
      });
      angle += step;
    }
    const a1 = angle - step;
    const mid = (a0 + a1) / 2;
    const bottom = Math.sin(mid) > 0.15;
    arcs.push({
      id: g,
      band: arcPath(a0 - step * 0.4, a1 + step * 0.4, R - 16),
      // The label needs room even for a group of two or three leaves.
      // The group name sits outside the ring, beyond the names of its leaves;
      // neighbouring names alternate between two radii so they never overlap.
      text: arcPath(mid - Math.max((a1 - a0) / 2, 0.26), mid + Math.max((a1 - a0) / 2, 0.26), (bottom ? R + 134 : R + 122) + (gi % 2) * 20, bottom),
    });
    angle += GAP * step;
  }

  const edges = sourcedLinks.map((l) => {
    const a = pos.get(l.from);
    const b = pos.get(l.to);
    let d = Math.abs(a.angle - b.angle) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    const k = 0.86 - 0.76 * (d / Math.PI); // near ends: shallow; opposite ends: through the centre
    const c1 = [C + (a.x - C) * k, C + (a.y - C) * k];
    const c2 = [C + (b.x - C) * k, C + (b.y - C) * k];
    // Threads stop inside the coloured arc of each school, so the arrowheads
    // sit in the open, just before the arc, never under it or under a leaf.
    const inner = R - 36; // the arrowhead stops a few units short of the arc
    const start = at(a.angle, inner);
    const end = at(b.angle, inner);
    const curve = `M${round(start[0])} ${round(start[1])}C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(end[0])} ${round(end[1])}`;
    if (l.type !== 'critiqued') return { link: l, d: curve };
    // A critique is drawn as a row of small crosses along the same curve.
    const bez = (t) => {
      const u = 1 - t;
      return [0, 1].map((i) => u * u * u * start[i] + 3 * u * u * t * c1[i] + 3 * u * t * t * c2[i] + t * t * t * end[i]);
    };
    let length = 0;
    let prev = start;
    for (let i = 1; i <= 40; i += 1) {
      const p = bez(i / 40);
      length += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    const n = Math.max(3, Math.round(length / 9));
    const h = 2.2;
    const crosses = [];
    for (let i = 0; i < n; i += 1) {
      const [x, y] = bez(i / n);
      crosses.push(`M${round(x - h)} ${round(y - h)}L${round(x + h)} ${round(y + h)}M${round(x - h)} ${round(y + h)}L${round(x + h)} ${round(y - h)}`);
    }
    // A short last stroke carries the arrowhead: a critique has a direction.
    const tip = bez(0.96);
    crosses.push(`M${round(tip[0])} ${round(tip[1])}L${round(end[0])} ${round(end[1])}`);
    return { link: l, d: crosses.join('') };
  });

  return { pos, edges, arcs, size: GRAPH_SIZE };
}
