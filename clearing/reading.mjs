// The two tasks around a simulation that are not the simulation itself:
// putting the claim in both languages before the run, and reading the run
// afterwards (who stood with whom, in English and in French).
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULTS, LIMITS } from './config.mjs';
import { mockReading } from './mock.mjs';

/** A simulated line never carries quotation marks: remove any the model left. */
export const unquote = (s) => String(s ?? '').replace(/["“”«»„‟]/g, '').replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').trim();

const noDash = (s) => String(s ?? '').replace(/\s*—\s*/g, ', ');

export function firstJson(text) {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('no JSON object in the answer');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('the JSON object in the answer is not closed');
}

/** Parses the closing answer of an agent: {position, reaction, work}. */
export function parseStance(raw, author) {
  const empty = { position: null, reaction: null, work: null };
  if (!raw || typeof raw !== 'string') return empty;
  let data;
  try {
    data = firstJson(raw);
  } catch {
    return empty;
  }
  const p = Number(data.position);
  const position = Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : null;
  const reaction = typeof data.reaction === 'string' && data.reaction.trim() ? noDash(unquote(data.reaction)) : null;
  const work = author.works.some((w) => w.id === data.work) ? data.work : null;
  return { position, reaction, work };
}

export const interviewPrompt = (claim) =>
  [
    'The discussion is closed. State where you now stand on the claim:',
    claim,
    '',
    'Do not call any tool. Answer in text, with one JSON object and nothing else, no code fence:',
    '{"position": <integer from 0 to 100: 0 opposes the claim outright, 50 is neutral or undecided, 100 endorses it outright>,',
    ` "reaction": "<your position in one or two plain sentences, at most ${LIMITS.reactionWords} words, in English, stated directly as the argument this body of work makes, with no quotation marks and no mention of being an agent>",`,
    ' "work": "<the id, as given between braces in your record, of the one work that best grounds this position, or null>"}',
  ].join('\n');

async function ask(client, { model, effort, system, user }) {
  const message = await client.beta.messages.create({
    model,
    max_tokens: DEFAULTS.maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort },
    system,
    messages: [{ role: 'user', content: user }],
  });
  if (message.stop_reason === 'refusal') {
    throw new Error(`The model declined this request${message.stop_details?.category ? ` (${message.stop_details.category})` : ''}. Reword the claim and run again.`);
  }
  if (message.stop_reason === 'max_tokens') throw new Error('The answer was cut off before the end.');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, usage: message.usage, model: message.model };
}

const HOUSE = [
  'House rules for every text you write:',
  '- Plain, exact sentences. No quotation marks of any kind, no em dashes, no exclamation marks.',
  '- A simulated agent is never the author. Write the Illich agent, the agents of the Degrowth branch; in French, l\'agent Illich, les agents de la branche Décroissance. Never write that an author said, thinks or believes something.',
  '- French follows French typography and reads as French, not as translated English.',
].join('\n');

/** The claim as one neutral sentence in English and in French. */
export async function prepareClaim({ raw, model, effort = DEFAULTS.effort, mock = false, usage }) {
  const claim = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (claim.length < LIMITS.claimChars.min) throw new Error(`The claim is too short (${claim.length} characters).`);
  if (claim.length > LIMITS.claimChars.max) throw new Error(`The claim is too long (${claim.length} characters, at most ${LIMITS.claimChars.max}).`);
  if (mock) return { en: claim, fr: claim };

  const client = new Anthropic({ maxRetries: 6 });
  const { text, usage: u } = await ask(client, {
    model,
    effort,
    system: `You prepare a claim for a public debate between simulated agents on a site about political ecology.\n${HOUSE}`,
    user: [
      'Give the claim below in English and in French. Each version is one declarative sentence that can be endorsed or opposed. Keep the meaning and the level of detail exactly; do not soften, strengthen or comment. If the claim is already in one of the two languages, keep that version as written apart from fixing typography.',
      '',
      `Claim: ${claim}`,
      '',
      'Answer with one JSON object and nothing else: {"en": "...", "fr": "..."}',
    ].join('\n'),
  });
  usage?.(u);
  const out = firstJson(text);
  if (typeof out.en !== 'string' || typeof out.fr !== 'string' || !out.en.trim() || !out.fr.trim()) throw new Error('The claim could not be prepared in both languages.');
  return { en: noDash(unquote(out.en)), fr: noDash(unquote(out.fr)) };
}

function checkReading(out, stances) {
  const known = new Set(stances.map((s) => s.author));
  const placed = new Set();
  const problems = [];
  const both = (v, what) => {
    if (!v || typeof v.en !== 'string' || typeof v.fr !== 'string' || !v.en.trim() || !v.fr.trim()) problems.push(`${what} needs an "en" and a "fr" text`);
  };
  both(out.summary, 'summary');
  if (!Array.isArray(out.alliances) || out.alliances.length < 1 || out.alliances.length > 6) problems.push('alliances must hold between 1 and 6 groups');
  for (const [i, al] of (out.alliances ?? []).entries()) {
    both(al.title, `alliance ${i + 1} title`);
    both(al.text, `alliance ${i + 1} text`);
    for (const id of al.authors ?? []) {
      if (!known.has(id)) problems.push(`alliance ${i + 1} names an unknown agent id "${id}"`);
      if (placed.has(id)) problems.push(`agent "${id}" appears in more than one alliance`);
      placed.add(id);
    }
  }
  for (const s of stances.filter((x) => x.position != null)) if (!placed.has(s.author)) problems.push(`agent "${s.author}" is in no alliance`);
  for (const s of stances.filter((x) => x.reaction)) {
    if (typeof out.reactions_fr?.[s.author] !== 'string' || !out.reactions_fr[s.author].trim()) problems.push(`reactions_fr lacks "${s.author}"`);
  }
  return problems;
}

/**
 * Reads a finished run: a two-sentence summary, the alliances (groups of
 * agents that stood together and why), and the French of every closing line.
 */
export async function readRun({ claim, stances, transcript, corpus, model, effort = DEFAULTS.effort, mock = false, usage }) {
  if (mock) {
    const r = mockReading({ claim: claim.en, stances });
    return { summary: r.summary, alliances: r.alliances, reactionsFr: r.reactionsFr };
  }
  const client = new Anthropic({ maxRetries: 6 });
  const nameOf = (id) => corpus.authorById[id]?.name ?? id;
  const agentLines = stances.map((s) => {
    const a = corpus.authorById[s.author];
    return `- ${s.author} | ${a.name} agent | ${corpus.branchById[a.branch].name.en} | position ${s.position ?? 'none'} | ${s.reaction ?? '(no closing line)'}`;
  });
  const said = transcript
    .filter((e) => e.type === 'comment' || e.type === 'like' || e.type === 'dislike')
    .map((e) => {
      const who = e.author ? `${nameOf(e.author)} agent` : 'moderator';
      const to = e.to ? ` -> ${nameOf(e.to)} agent` : '';
      return e.type === 'comment' ? `[round ${e.round}] ${who}: ${e.text}` : `[round ${e.round}] ${who} ${e.type}s a comment${to}`;
    });

  const system = `You read a finished debate between simulated agents on Ecosophia, a public map of the thinkers of political ecology, and you write the short account published with it. Each agent was built from the site's record of one author. You report what the agents did in this run, nothing more.\n${HOUSE}`;
  const task = [
    `Claim (English): ${claim.en}`,
    `Claim (French): ${claim.fr}`,
    '',
    'Agents (id | name | branch | closing position, 0 opposes and 100 endorses | closing line):',
    ...agentLines,
    '',
    'What happened, in order:',
    ...(said.length ? said : ['(no comment was posted)']),
    '',
    'Write one JSON object and nothing else, no code fence, with exactly these keys:',
    '{',
    ' "summary": {"en": "...", "fr": "..."},',
    ' "alliances": [{"title": {"en": "...", "fr": "..."}, "text": {"en": "...", "fr": "..."}, "authors": ["agent id", "..."]}],',
    ' "reactions_fr": {"agent id": "French version of that agent\'s closing line", "...": "..."}',
    '}',
    '',
    'summary: two sentences, at most 55 words per language. Where the line of division ran in this run, and the one thing a reader would not have guessed from the branch names.',
    'alliances: between two and five groups. Group agents by the grounds of their position, not only by its side: two groups can both oppose the claim for different reasons. Every agent that has a closing position is in exactly one group, and an agent without one is in none. title: at most six words, for example Against, on grounds of scale. text: one or two sentences, at most 35 words per language, stating the shared ground, and naming an agent when it breaks from its own branch.',
    'reactions_fr: for every agent with a closing line, a faithful French version of that line, same length, same register.',
  ].join('\n');

  let lastProblems = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = attempt === 0 ? task : `${task}\n\nYour previous answer had these faults, correct them:\n- ${lastProblems.join('\n- ')}`;
    const { text, usage: u } = await ask(client, { model, effort, system, user });
    usage?.(u);
    let out;
    try {
      out = firstJson(text);
    } catch (e) {
      lastProblems = [e.message];
      continue;
    }
    lastProblems = checkReading(out, stances);
    if (lastProblems.length === 0) {
      const clean = (v) => ({ en: noDash(unquote(v.en)), fr: noDash(unquote(v.fr)) });
      return {
        summary: clean(out.summary),
        alliances: out.alliances.filter((al) => (al.authors ?? []).length > 0).map((al) => ({ title: clean(al.title), text: clean(al.text), authors: al.authors })),
        reactionsFr: Object.fromEntries(Object.entries(out.reactions_fr).map(([k, v]) => [k, noDash(unquote(v))])),
      };
    }
  }
  throw new Error(`The reading of the run was not usable after two attempts:\n- ${lastProblems.join('\n- ')}`);
}
