// The planner: one call to a strong model, before the run, that chooses which
// agents take part and how many rounds the question deserves. It ranks the
// agents; clearing/estimate.mjs then trims the plan to the budget. The plan
// and its reasons are published with the run, so the choice can be judged.
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULTS } from './config.mjs';
import { firstJson } from './reading.mjs';

const plain = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function roster(corpus, candidates) {
  return candidates
    .map((a) => {
      const seeds = a.seeds.map((s) => corpus.seeds[s.seed]?.name.en ?? s.seed).join(', ');
      const dates = a.born ? `${a.born}${a.died ? `–${a.died}` : ''}` : '';
      return `- ${a.id} | ${a.name}${dates ? ` (${dates})` : ''} | ${corpus.branchById[a.branch].name.en} | seeds: ${seeds} | ${plain(a.lede.en).slice(0, 160)}`;
    })
    .join('\n');
}

/**
 * @returns {{ranked: string[], rounds: number, reasons: Record<string,string>, note: string, model: string}}
 */
export async function planRun({ claim, corpus, candidates, maxAgents, maxRounds, budgetUsd, model = DEFAULTS.plannerModel, effort = DEFAULTS.effort, mock = false, usage }) {
  const branches = [...new Set(candidates.map((a) => a.branch))];
  if (mock) {
    // Dry run: one agent per branch, in tree order, two rounds.
    const ranked = branches.map((b) => candidates.find((a) => a.branch === b).id);
    return { ranked, rounds: Math.min(2, maxRounds), reasons: Object.fromEntries(ranked.map((id) => [id, 'Dry run: first agent of its branch.'])), note: 'Dry run with a stand-in planner.', model: `mock:${model}` };
  }

  const client = new Anthropic({ maxRetries: 6 });
  const system = [
    'You plan a simulated debate on Ecosophia, a public map of the thinkers of political ecology. Agents built from the records of authors will discuss one claim for a few rounds and then each state a position.',
    'Your task is to choose who takes part and how many rounds, so that the debate is informative and its cost stays low.',
    'Rules for the choice:',
    '- Choose for the range of arguments, never for an expected outcome. Include the agents most likely to disagree with each other and with the claim.',
    '- Every branch present in the list must keep at least one agent. Prefer, within a branch, the authors whose work bears most directly on the claim.',
    '- Rank your choice: the agents that matter most first. If the budget is tight, the list is cut from the end, never below one agent per branch.',
    '- Rounds: 1 when positions are likely to be set by the work alone, 2 when the agents need to answer each other, 3 only for a question with several distinct lines of argument. Fewer is cheaper.',
    '- Give one short, factual reason per agent, in English, with no quotation marks.',
  ].join('\n');
  const user = [
    `Claim: ${claim.en}`,
    '',
    `Choose between ${branches.length} and ${maxAgents} agents, and 1 to ${maxRounds} rounds. Budget for the whole run: ${budgetUsd == null ? 'no fixed limit, keep it modest' : `about ${budgetUsd} USD`}. As a guide, 24 agents for 2 rounds cost about 1.8 USD on the default model, and the cost grows faster than the number of agents.`,
    '',
    'Available agents (id | name | branch | seeds | summary):',
    roster(corpus, candidates),
    '',
    'Answer with one JSON object and nothing else, no code fence:',
    '{"agents": ["id", "..."], "rounds": 2, "reasons": {"id": "why this agent", "...": "..."}, "note": "one or two sentences on the plan as a whole"}',
  ].join('\n');

  const known = new Set(candidates.map((a) => a.id));
  let problems = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await client.beta.messages.create({
      model,
      max_tokens: DEFAULTS.maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort },
      system,
      messages: [{ role: 'user', content: attempt === 0 ? user : `${user}\n\nYour previous answer had these faults, correct them:\n- ${problems.join('\n- ')}` }],
    });
    usage?.(message.usage);
    if (message.stop_reason === 'refusal') throw new Error('The planner declined this claim. Reword it, or choose the agents by hand.');
    let out;
    try {
      out = firstJson(message.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
    } catch (e) {
      problems = [e.message];
      continue;
    }
    const ranked = [...new Set((out.agents ?? []).filter((id) => known.has(id)))];
    problems = [];
    const unknown = (out.agents ?? []).filter((id) => !known.has(id));
    if (unknown.length) problems.push(`unknown agent ids: ${unknown.join(', ')}`);
    const missing = branches.filter((b) => !ranked.some((id) => corpus.authorById[id].branch === b));
    if (missing.length) problems.push(`no agent for these branches: ${missing.join(', ')}`);
    if (ranked.length > maxAgents) problems.push(`more than ${maxAgents} agents`);
    if (!Number.isInteger(out.rounds) || out.rounds < 1 || out.rounds > maxRounds) problems.push(`rounds must be a whole number from 1 to ${maxRounds}`);
    if (problems.length === 0) {
      const reasons = Object.fromEntries(ranked.map((id) => [id, plain(out.reasons?.[id] ?? '').replace(/["“”«»]/g, '')]));
      return { ranked, rounds: out.rounds, reasons, note: plain(out.note).replace(/["“”«»]/g, ''), model: message.model };
    }
  }
  throw new Error(`The planner's answer was not usable after two attempts:\n- ${problems.join('\n- ')}`);
}
