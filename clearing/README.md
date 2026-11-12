# The Clearing pipeline

Turns a claim into a simulated debate between agents built from the corpus, and stores the result where the site reads it. The simulation engine is [MiroFish](https://github.com/666ghj/MiroFish), which drives [OASIS](https://github.com/camel-ai/oasis); the model is Claude, called through the official Anthropic SDK.

```text
claim ─► prepare (EN + FR)
corpus ─► seed.mjs ─► simulation folder: one agent per leaf author, one moderator
                          │
                          ▼
        MiroFish runner (pinned commit, threaded platform)
          rounds: every agent reads the thread, comments, approves, rejects
          closing interview: position 0 to 100 and one line, per agent
                          │  OpenAI wire format, localhost only
                          ▼
        bridge.mjs ─► Anthropic SDK ─► Claude
                          │
                          ▼
reading.mjs: alliances, summary, French ─► data/clearing/runs/<id>.yaml
                                           data/clearing/runs/<id>.transcript.json
```

## Files

| File | Role |
|---|---|
| `config.mjs` | The pinned MiroFish commit, the default model, the limits |
| `seed.mjs` | Chooses the agents and writes what MiroFish reads: `simulation_config.json`, `reddit_profiles.json` |
| `bridge.mjs` | Serves the OpenAI chat-completions format on localhost and answers through `@anthropic-ai/sdk` |
| `run.mjs` | Runs everything in order and writes the run |
| `reading.mjs` | Prepares the claim in both languages; after the run, groups agents into alliances and writes the French |
| `mock.mjs` | A stand-in model for dry runs and tests |
| `status.mjs`, `withdraw.mjs` | Publish, unpublish or delete a run; remove an author's agent from stored runs |
| `test/` | Tests, and a double of the MiroFish runner that follows the same file protocol |

## Choices worth knowing

**MiroFish is not copied here.** It is AGPL-3.0. The workflow fetches it at the commit pinned in `config.mjs` and installs its dependencies from its own lockfile. To move to a newer MiroFish, change the commit, run a dry run, and read a real run before publishing anything.

**Only the simulation stage of MiroFish is used.** MiroFish also builds a knowledge graph from documents and writes a report, and both need other services. Ecosophia already has its graph: the corpus. So the agents come straight from `data/`, and the report is replaced by the short reading in `reading.mjs`.

**The threaded platform.** MiroFish simulates two platforms. The Clearing uses the threaded one: every agent sees the claim and all comments, and can comment, approve or reject. The other one shows each agent two recommended posts per round and downloads a recommender model at run time.

**Every agent gets a turn in every round.** MiroFish normally draws a random subset of agents per simulated hour. The configuration written by `seed.mjs` offers every agent a turn each round, so a run does not depend on who happened to be drawn.

**No invented traits.** The engine's profile format asks for an age, a gender, a country and a personality type, and builds a sentence from them. Ecosophia assigns none of these to an author: the fields hold `n/a` and the bridge removes the sentence before the prompt reaches the model. The prompts published with a run are the prompts as sent.

**The bridge.** MiroFish talks to its model in the OpenAI wire format. The bridge translates each request (system prompt, turns, tool calls and results) to the Claude Messages API and back. It sets `fallbacks: "default"`, so a request declined by the model's safety classifiers is retried by the API on the model's default substitute; the run records which model served. It caches each agent's growing context, limits how many calls run at once, and keeps the log a published run needs.

**The key stays out of reach of third-party code.** In the workflow, MiroFish and its dependencies run under a separate system account with a clean environment. They can reach the bridge on localhost and nothing else of the job. The job that runs them has read-only access to the repository; another job stores the result.

**A run is refused rather than patched.** If more than one call in ten fails, if fewer than half of the agents give a position, or if nobody comments, nothing is stored.

## On your own machine

Node 22.23 or newer, Python 3.11, and [uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/666ghj/MiroFish ../MiroFish
```

```bash
git -C ../MiroFish checkout 7657031ac01184afe2cb220f5ee3545573b5e843
```

```bash
uv sync --frozen --no-dev --no-install-project --project ../MiroFish/backend --python 3.11
```

A dry run, with the stand-in model:

```bash
npm run clearing -- --dry-run --claim "Nuclear power should count as green investment in the European Union." --agents technocritique,counterpoint --rounds 2 --engine ../MiroFish --python ../MiroFish/backend/.venv/bin/python
```

A real run needs `ANTHROPIC_API_KEY` in the environment and no `--dry-run`. It writes `data/clearing/runs/clr-NNNN.yaml` as a draft; `npm run dev` then shows it at `/en/clearing/clr-NNNN/`.

Options of `run.mjs`: `--claim`, `--agents` (default `all`), `--rounds` (default 3), `--model` (default `claude-opus-5-5`), `--effort` (default `medium`), `--status draft|published`, `--dry-run`, `--engine`, `--python`, `--concurrency` (default 6), `--run-as <system account>`, `--work`, `--out`, `--timeout-minutes`.

Tests, which need neither MiroFish nor a key:

```bash
npm run test:clearing
```

## What a run file holds

`<id>.yaml`: the claim in both languages, the summary, the engine and its commit, the model asked for and the model that served, the settings, the counts (turns, comments, tokens, declined and failed calls), the median position of each branch with its range, the alliances as lists of agents, and every closing line in both languages.

`<id>.transcript.json`: the prompt of every agent as sent, the opening post, the closing question, every comment and reaction in order, and the raw closing answers.

`npm run validate` checks both, and refuses a run that names an author marked `agent: false`, a line set in quotation marks, or a dry run.
