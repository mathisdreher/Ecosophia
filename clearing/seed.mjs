// Builds a MiroFish simulation folder from the Ecosophia corpus: one agent per
// author, each given the Ecosophia record of that author and nothing else,
// plus a moderator account that posts the claim and never speaks again.
import fs from 'node:fs';
import path from 'node:path';
import { ENGINE, LIMITS } from './config.mjs';

const MODERATOR = { name: 'The Clearing', username: 'the_clearing' };

/** The account name of an agent on the simulated platform. */
export const usernameOf = (author) => `${author.id.replace(/[^a-z0-9]+/g, '_')}_agent`;

const plain = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const titleOf = (w) => plain(typeof w.title === 'string' ? w.title : (w.title.en ?? Object.values(w.title)[0]));
const workLabel = (w) => `${titleOf(w)} (${w.to ? `${w.year}–${w.to}` : w.year})`;

/**
 * Picks the authors who take part. `spec` is "all" or a comma-separated list
 * of author ids and branch ids. Only leaves take part: the stance chart is
 * drawn per branch. Authors marked `agent: false` in the corpus never do.
 */
export function selectAgents(corpus, spec = 'all') {
  const leaves = corpus.authors.filter((a) => a.layer === 'leaf');
  const wanted = String(spec || 'all')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let picked;
  if (wanted.length === 0 || wanted.includes('all')) {
    picked = leaves;
  } else {
    const unknown = wanted.filter((w) => !corpus.branchById[w] && !leaves.some((a) => a.id === w));
    if (unknown.length) {
      throw new Error(`Unknown author or branch: ${unknown.join(', ')}. Use ids from data/authors and data/branches.yaml (leaves only).`);
    }
    picked = leaves.filter((a) => wanted.includes(a.id) || wanted.includes(a.branch));
  }
  const withdrawn = picked.filter((a) => a.agent === false);
  // Branch by branch, in the order of the tree.
  const agents = picked
    .filter((a) => a.agent !== false)
    .sort((x, y) => corpus.branchById[x.branch].order - corpus.branchById[y.branch].order || x.fileIndex - y.fileIndex);
  if (agents.length < LIMITS.agents.min) throw new Error(`A run needs at least ${LIMITS.agents.min} agents, got ${agents.length}.`);
  if (agents.length > LIMITS.agents.max) throw new Error(`A run takes at most ${LIMITS.agents.max} agents, got ${agents.length}.`);
  return { agents, withdrawn };
}

function threads(author, corpus) {
  const name = (id) => corpus.authorById[id]?.name ?? id;
  const rows = [];
  for (const l of author.inLinks) {
    if (l.status === 'to-verify') continue;
    if (l.type === 'influenced') rows.push(`read ${name(l.from)}: ${plain(l.note?.en)}`);
    if (l.type === 'critiqued') rows.push(`criticised by ${name(l.from)}: ${plain(l.note?.en)}`);
    if (l.type === 'dialogue') rows.push(`in dialogue with ${name(l.from)}: ${plain(l.note?.en)}`);
  }
  for (const l of author.outLinks) {
    if (l.status === 'to-verify') continue;
    if (l.type === 'influenced') rows.push(`read by ${name(l.to)}: ${plain(l.note?.en)}`);
    if (l.type === 'critiqued') rows.push(`criticised ${name(l.to)}: ${plain(l.note?.en)}`);
    if (l.type === 'dialogue') rows.push(`in dialogue with ${name(l.to)}: ${plain(l.note?.en)}`);
  }
  return rows.slice(0, 8);
}

/** The whole of what an agent is told about its author. Published with every run. */
export function persona(author, corpus, roster) {
  const branch = corpus.branchById[author.branch];
  const also = author.also.map((b) => corpus.branchById[b]?.name.en).filter(Boolean);
  const dates = author.born == null ? '' : author.died != null ? ` (${author.born}–${author.died})` : ` (born ${author.born})`;
  const works = author.works.filter((w) => w.key !== false);
  const seedLines = author.seeds.map((s) => {
    const w = corpus.sources.get(s.source);
    return `- ${corpus.seeds[s.seed]?.name.en ?? s.seed}: ${plain(s.text.en)}${w ? ` [${workLabel(w)}]` : ''}`;
  });
  const threadLines = threads(author, corpus).map((t) => `- ${t}`);
  const time = author.died != null
    ? `The author died in ${author.died} and never saw later events. Reason from the work; never pretend that the author commented on anything after ${author.died}.`
    : 'The author is alive and may hold views that this record does not contain. Stay within the published work summarised here.';

  return [
    `You are an agent in the Clearing of Ecosophia, a public map of the thinkers of political ecology. You are built from the Ecosophia record of ${author.name}${dates}, on the ${branch.name.en} branch${also.length ? ` (also close to ${also.join(' and ')})` : ''}. You are not ${author.name}. You carry the argument that this body of work makes, in its vocabulary and with its priorities.`,
    '',
    'RECORD',
    `Summary: ${plain(author.lede.en)}`,
    ...(seedLines.length ? ['Seeds, the ideas this work carries:', ...seedLines] : []),
    ...(works.length ? [`Works: ${works.map((w) => `${workLabel(w)} {${w.id}}`).join('; ')}.`] : []),
    ...(threadLines.length ? ['Threads to other authors:', ...threadLines] : []),
    '',
    'RULES',
    `- Argue from this record and from what is reliably known of the published work. ${time}`,
    '- Where the work is silent on the question, say so, or reason by analogy and say that you do. Do not invent facts, events, numbers or biography.',
    '- Never use quotation marks and never attribute words to a real person. State the argument directly: do not announce that you are an agent, and do not write what the author would say.',
    `- Write in English, in plain sentences, at most ${LIMITS.commentWords} words per post or comment, one idea at a time.`,
    '- First answer the claim with a comment on its post. Later, answer the comments of other participants where you agree or disagree, and say why. Like a comment you would endorse, dislike one you oppose.',
    '- Do not repeat what you already wrote. If you have nothing to add, do nothing. Do not create new posts: the discussion stays under the claim.',
    '',
    'PARTICIPANTS (user id: agent, branch)',
    ...roster,
  ].join('\n');
}

/**
 * Writes the simulation folder MiroFish reads: simulation_config.json,
 * reddit_profiles.json, and agents.json (which agent stands for which author).
 */
export function buildSimulation({ corpus, claim, agents, rounds, dir, runId, model }) {
  fs.mkdirSync(dir, { recursive: true });
  const n = agents.length;
  // MiroFish numbers agents by their row in the profile file, and the platform
  // shows that same number as the user id. Row 0 is the moderator.
  const roster = [
    `0: ${MODERATOR.name}, moderator, posted the claim`,
    ...agents.map((a, i) => `${i + 1}: ${a.name} agent, ${corpus.branchById[a.branch].name.en}`),
  ];

  // The engine's profile format asks for an age, a gender, a country and a
  // personality type. Ecosophia does not assign any of these to an author: the
  // fields are filled with "n/a" and the sentence built from them is removed
  // before a prompt reaches the model (see clearing/bridge.mjs).
  const blank = { age: 'n/a', gender: 'n/a', mbti: 'n/a', country: 'n/a' };
  const profiles = [
    {
      user_id: 0,
      username: MODERATOR.username,
      realname: MODERATOR.name,
      name: MODERATOR.name,
      bio: 'Moderator account. Posts the claim under discussion.',
      persona: 'You are the moderator of the Clearing. You posted the claim and you take no part in the discussion.',
      ...blank,
    },
    ...agents.map((a, i) => ({
      user_id: i + 1,
      username: usernameOf(a),
      realname: `${a.name} agent`,
      name: `${a.name} agent`,
      bio: `Agent built from the Ecosophia record of ${a.name}. Not a statement by the author.`,
      persona: persona(a, corpus, roster),
      ...blank,
    })),
  ];

  const everyHour = Array.from({ length: 24 }, (_, h) => h);
  const config = {
    simulation_id: runId,
    llm_model: model,
    // One round per simulated hour, and every agent is offered a turn in every round.
    time_config: {
      total_simulation_hours: rounds,
      minutes_per_round: 60,
      agents_per_hour_min: n + 1,
      agents_per_hour_max: n + 1,
      peak_hours: [],
      off_peak_hours: [],
      peak_activity_multiplier: 1,
      off_peak_activity_multiplier: 1,
    },
    agent_configs: [
      { agent_id: 0, entity_name: MODERATOR.name, active_hours: [], activity_level: 0 },
      ...agents.map((a, i) => ({ agent_id: i + 1, entity_name: `${a.name} agent`, active_hours: everyHour, activity_level: 1 })),
    ],
    event_config: {
      initial_posts: [
        {
          poster_agent_id: 0,
          content: `CLAIM UNDER DISCUSSION: ${claim}\n\nComment on this post. Say whether you endorse or oppose the claim, and on what grounds. Then answer the other comments.`,
        },
      ],
    },
  };

  const map = {
    runId,
    engine: { name: ENGINE.name, commit: ENGINE.commit, platform: ENGINE.platform },
    moderator: { agent_id: 0, name: MODERATOR.name },
    agents: agents.map((a, i) => ({ agent_id: i + 1, username: usernameOf(a), author: a.id, name: a.name, branch: a.branch, living: a.living })),
  };

  fs.writeFileSync(path.join(dir, 'simulation_config.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(dir, 'reddit_profiles.json'), JSON.stringify(profiles, null, 2));
  fs.writeFileSync(path.join(dir, 'agents.json'), JSON.stringify(map, null, 2));
  return { config, profiles, map };
}
