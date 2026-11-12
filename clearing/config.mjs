// Settings of the Clearing pipeline. The simulation engine is MiroFish, run
// from its own repository at a pinned commit: it is never copied into this
// repository (MiroFish is AGPL-3.0, Ecosophia keeps its own files only).

export const ENGINE = {
  name: 'MiroFish',
  repo: 'https://github.com/666ghj/MiroFish',
  commit: '7657031ac01184afe2cb220f5ee3545573b5e843',
  runner: 'backend/scripts/run_parallel_simulation.py',
  // MiroFish drives OASIS on two platforms. The Clearing uses the threaded one:
  // agents comment on the claim and on each other, and every agent sees the
  // whole discussion. The other platform shows two recommended posts per round
  // and downloads a recommender model at run time.
  platform: 'reddit',
  python: '3.11',
  packages: ['camel-oasis==0.2.5', 'camel-ai==0.2.78', 'python-dotenv==1.2.4'],
};

export const DEFAULTS = {
  model: 'claude-opus-5-5',
  // The planner chooses agents and rounds when agents is 'auto': one call.
  plannerModel: 'claude-opus-5-5',
  // Spending limit of a run, in USD at list prices. The plan is cut to fit it
  // before the run starts, and the bridge stops calling the model beyond 1.5 times it.
  budgetUsd: 3,
  maxAutoAgents: 30,
  effort: 'medium',
  rounds: 3,
  // Calls to the model that may run at the same time. MiroFish itself allows
  // 30; the bridge queues above this number to stay within rate limits.
  concurrency: 6,
  maxTokens: 16000,
};

export const LIMITS = {
  rounds: { min: 1, max: 8 },
  agents: { min: 2, max: 120 },
  claimChars: { min: 12, max: 400 },
  commentWords: 60,
  reactionWords: 45,
};

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

/** Position scale used everywhere: 0 opposes the claim, 100 endorses it. */
export const SCALE = { min: 0, neutral: 50, max: 100 };

/**
 * List prices in USD per million tokens, used only to estimate the cost of a
 * run in its summary. Check the current price list before relying on them.
 * Cache writes are the 5-minute writes (1.25 times the input price).
 */
export const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

/** Estimated cost in USD of a token count {input, output, cacheRead, cacheWrite}, or null. */
export function estimateCost(model, t) {
  const p = PRICES[model];
  if (!p) return null;
  return ((t.input ?? 0) * p.input + (t.output ?? 0) * p.output + (t.cacheRead ?? 0) * p.cacheRead + (t.cacheWrite ?? 0) * p.cacheWrite) / 1e6;
}
