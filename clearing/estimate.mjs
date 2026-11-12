// Estimates the tokens and the cost of a run before it starts, so that a
// budget can be enforced. The figures are an order of magnitude, from the
// way MiroFish builds each agent's context: a fixed prompt, then the whole
// thread every round, kept in the agent's memory and re-read later, most of
// it from the prompt cache.
import { estimateCost } from './config.mjs';

const SYSTEM = 1700; // persona, rules and tool definitions
const PER_COMMENT = 130; // one comment as the platform shows it
const COMMENTS_PER_TURN = 1; // observed in test runs
const OUTPUT_PER_CALL = 800; // thinking included, at medium effort
const READING = { input: 2500, perAgent: 160, output: 4000 }; // the closing reading

export function estimateRun({ agents, rounds, model, readerModel = model }) {
  const t = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  for (let a = 0; a < agents; a++) {
    let seen = SYSTEM; // what the agent has already read, cached
    t.cacheWrite += SYSTEM;
    for (let r = 1; r <= rounds; r++) {
      const feed = agents * (r - 1) * COMMENTS_PER_TURN * PER_COMMENT;
      if (r > 1) t.cacheRead += seen;
      t.cacheWrite += feed + OUTPUT_PER_CALL;
      seen += feed + OUTPUT_PER_CALL;
      t.output += OUTPUT_PER_CALL;
    }
    t.cacheRead += seen; // closing interview
    t.input += 300;
    t.output += 200;
  }
  const reading = { input: READING.input + READING.perAgent * agents, output: READING.output, cacheRead: 0, cacheWrite: 0 };
  const cost = (estimateCost(model, t) ?? NaN) + (estimateCost(readerModel, reading) ?? NaN);
  return { tokens: t, reading, costUsd: Number.isFinite(cost) ? cost : null, calls: agents * (rounds + 1) + 2 };
}

/**
 * Trims a plan to a budget: first fewer rounds (not below minRounds), then the
 * agents at the end of the ranked list, never the last agent of a branch.
 */
export function fitBudget({ ranked, rounds, minRounds = 1, budgetUsd, model, readerModel, branchOf, minAgents = 2 }) {
  let list = [...ranked];
  let r = rounds;
  const cost = () => estimateRun({ agents: list.length, rounds: r, model, readerModel }).costUsd;
  if (budgetUsd == null || cost() == null) return { agents: list, rounds: r, trimmed: false };
  let trimmed = false;
  while (cost() > budgetUsd && r > minRounds) {
    r--;
    trimmed = true;
  }
  while (cost() > budgetUsd && list.length > minAgents) {
    const counts = new Map();
    for (const id of list) counts.set(branchOf(id), (counts.get(branchOf(id)) ?? 0) + 1);
    let i = list.length - 1;
    while (i >= 0 && counts.get(branchOf(list[i])) <= 1) i--;
    if (i < 0) break;
    list.splice(i, 1);
    trimmed = true;
  }
  return { agents: list, rounds: r, trimmed, costUsd: cost(), overBudget: cost() > budgetUsd };
}
