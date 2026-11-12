// Helpers shared by the Clearing page and the run pages. The specimen names
// branches in its alliances; a run names agents, and the branches are derived.

/** Branches of an alliance, in tree order, each flagged when only part of it is there. */
export function allianceBranches(al, run, corpus) {
  if (al.branches) return al.branches.map((b) => ({ branch: corpus.branchById[b], partial: al.partial?.includes(b) ?? false }));
  const placed = new Map();
  for (const other of run.alliances) {
    for (const id of other.authors) {
      const b = corpus.authorById[id].branch;
      placed.set(b, (placed.get(b) ?? 0) + 1);
    }
  }
  const here = new Map();
  for (const id of al.authors) {
    const b = corpus.authorById[id].branch;
    here.set(b, (here.get(b) ?? 0) + 1);
  }
  return corpus.branches.filter((b) => here.has(b.id)).map((b) => ({ branch: b, partial: here.get(b.id) < placed.get(b.id) }));
}

/** Up to `n` voices spread over the whole range of positions, extremes included. */
export function spreadVoices(voices, n = 6) {
  const sorted = [...voices].sort((a, b) => a.position - b.position);
  if (sorted.length <= n) return sorted;
  const picked = new Set();
  for (let i = 0; i < n; i++) picked.add(Math.round((i * (sorted.length - 1)) / (n - 1)));
  return [...picked].sort((a, b) => a - b).map((i) => sorted[i]);
}

/** 12 November 2026 / 12 novembre 2026 */
export function runDate(run, lang) {
  const d = new Date(`${run.date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(run.date) : new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
