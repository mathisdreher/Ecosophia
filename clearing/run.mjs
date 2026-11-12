#!/usr/bin/env node
// Runs one Clearing simulation from start to finish:
//
//   corpus -> agents -> MiroFish (OASIS) rounds -> closing interviews
//          -> reading -> data/clearing/runs/<id>.yaml + <id>.transcript.json
//
//   node clearing/run.mjs --claim "..." --engine <MiroFish checkout> --python <python>
//
// See clearing/README.md for every option.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import YAML from 'yaml';
import { loadCorpus, loadClaims } from '../src/lib/corpus.mjs';
import { ENGINE, DEFAULTS, LIMITS, EFFORTS, estimateCost } from './config.mjs';
import { selectAgents, buildSimulation } from './seed.mjs';
import { startBridge } from './bridge.mjs';
import { prepareClaim, readRun, parseStance, interviewPrompt } from './reading.mjs';

const ROOT = process.env.ECOSOPHIA_ROOT ?? process.cwd();
const RUNS = path.join(ROOT, 'data', 'clearing', 'runs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (msg) => console.log(`[clearing] ${msg}`);

function options() {
  const { values } = parseArgs({
    options: {
      claim: { type: 'string' },
      agents: { type: 'string', default: 'all' },
      rounds: { type: 'string', default: String(DEFAULTS.rounds) },
      model: { type: 'string', default: DEFAULTS.model },
      'reader-model': { type: 'string', default: '' },
      effort: { type: 'string', default: DEFAULTS.effort },
      status: { type: 'string', default: 'draft' },
      'dry-run': { type: 'boolean', default: false },
      engine: { type: 'string', default: process.env.MIROFISH_DIR ?? '' },
      python: { type: 'string', default: process.env.MIROFISH_PYTHON ?? 'python3' },
      out: { type: 'string' },
      work: { type: 'string' },
      'run-as': { type: 'string', default: process.env.MIROFISH_USER ?? '' },
      concurrency: { type: 'string', default: String(DEFAULTS.concurrency) },
      'timeout-minutes': { type: 'string', default: '90' },
    },
  });
  const fail = (msg) => {
    console.error(`clearing: ${msg}`);
    process.exit(2);
  };
  const rounds = Number(values.rounds);
  if (!values.claim?.trim()) fail('give the claim to discuss with --claim "..."');
  if (!Number.isInteger(rounds) || rounds < LIMITS.rounds.min || rounds > LIMITS.rounds.max) fail(`--rounds must be a whole number from ${LIMITS.rounds.min} to ${LIMITS.rounds.max}`);
  if (!EFFORTS.includes(values.effort)) fail(`--effort must be one of ${EFFORTS.join(', ')}`);
  if (!['draft', 'published'].includes(values.status)) fail('--status must be draft or published');
  if (!values.engine) fail('give the path of a MiroFish checkout with --engine (or MIROFISH_DIR)');
  const runner = path.resolve(values.engine, ENGINE.runner);
  if (!fs.existsSync(runner)) fail(`no MiroFish runner at ${runner}`);
  const dry = values['dry-run'];
  if (!dry && !process.env.ANTHROPIC_API_KEY) fail('ANTHROPIC_API_KEY is not set. Add it, or use --dry-run to test the pipeline with a stand-in model.');
  return {
    claim: values.claim,
    agents: values.agents,
    rounds,
    model: values.model.trim(),
    readerModel: values['reader-model'].trim() || values.model.trim(),
    effort: values.effort,
    status: dry ? 'draft' : values.status,
    dry,
    runner,
    python: values.python,
    out: values.out ? path.resolve(values.out) : dry ? path.join(ROOT, '.cache', 'clearing', 'dry-runs') : RUNS,
    work: values.work ? path.resolve(values.work) : null,
    runAs: values['run-as'].trim(),
    concurrency: Math.max(1, Number(values.concurrency) || DEFAULTS.concurrency),
    timeoutMs: Math.max(1, Number(values['timeout-minutes']) || 90) * 60_000,
  };
}

function nextRunId(dry) {
  if (dry) return `dry-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
  const taken = fs.existsSync(RUNS)
    ? fs.readdirSync(RUNS).map((f) => Number(f.match(/^clr-(\d{4})\.yaml$/)?.[1])).filter(Number.isFinite)
    : [];
  return `clr-${String(Math.max(0, ...taken) + 1).padStart(4, '0')}`;
}

const tail = (file, lines = 25) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trimEnd().split('\n').slice(-lines).join('\n') : '(no log)');

async function waitFor(check, { until, child, what, logFile }) {
  for (;;) {
    const got = check();
    if (got) return got;
    if (child.spawnError) throw new Error(`MiroFish could not be started: ${child.spawnError.message}`);
    if (child.exitCode != null) throw new Error(`MiroFish stopped (exit ${child.exitCode}) before ${what}.\n${tail(logFile)}`);
    if (Date.now() > until) throw new Error(`Timed out waiting for ${what}.\n${tail(logFile)}`);
    await sleep(500);
  }
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/** Sends one command to the running simulation through MiroFish's file-based IPC. */
async function command(sim, id, type, args, wait) {
  fs.mkdirSync(path.join(sim, 'ipc_commands'), { recursive: true });
  fs.writeFileSync(path.join(sim, 'ipc_commands', `${id}.json`), JSON.stringify({ command_id: id, command_type: type, args }));
  return waitFor(() => readJson(path.join(sim, 'ipc_responses', `${id}.json`)), { ...wait, what: `the answer to ${type}` });
}

/** MiroFish's action log -> the transcript published with the run. */
function transcriptOf(sim, map) {
  const byAgent = new Map(map.agents.map((a) => [a.agent_id, a.author]));
  const byName = new Map(map.agents.map((a) => [`${a.name} agent`, a.author]));
  const file = path.join(sim, 'reddit', 'actions.jsonl');
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  const KIND = {
    CREATE_POST: 'post',
    CREATE_COMMENT: 'comment',
    LIKE_COMMENT: 'like',
    DISLIKE_COMMENT: 'dislike',
    LIKE_POST: 'like-post',
    DISLIKE_POST: 'dislike-post',
    FOLLOW: 'follow',
    MUTE: 'mute',
  };
  const out = [];
  for (const line of lines) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const type = KIND[e.action_type];
    if (!type) continue;
    const a = e.action_args ?? {};
    const entry = { round: e.round ?? 0, author: byAgent.get(e.agent_id) ?? null, type };
    if (type === 'post' || type === 'comment') entry.text = String(a.content ?? '').trim();
    const target = a.comment_author_name ?? a.target_user_name ?? (type === 'like-post' || type === 'dislike-post' ? a.post_author_name : null);
    if (target && byName.has(target)) entry.to = byName.get(target);
    if (a.comment_content) entry.about = String(a.comment_content).trim();
    out.push(entry);
  }
  return out;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

async function main() {
  const opt = options();
  const corpus = loadCorpus();
  const { agents, withdrawn } = selectAgents(corpus, opt.agents);
  const runId = nextRunId(opt.dry);
  const work = opt.work ?? path.join(ROOT, '.cache', 'clearing', runId);
  const sim = path.join(work, 'sim');
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(sim, { recursive: true });

  // Tokens of the two calls made around the simulation (claim, reading), by the reader model.
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const count = (u) => {
    tokens.input += u?.input_tokens ?? 0;
    tokens.cacheRead += u?.cache_read_input_tokens ?? 0;
    tokens.cacheWrite += u?.cache_creation_input_tokens ?? 0;
    tokens.output += u?.output_tokens ?? 0;
  };

  say(`${runId}: ${agents.length} agents, ${opt.rounds} rounds, ${opt.dry ? 'stand-in model (dry run)' : `${opt.model}, effort ${opt.effort}`}`);
  if (withdrawn.length) say(`withdrawn agents left out: ${withdrawn.map((a) => a.name).join(', ')}`);

  // A claim id from data/clearing/claims.yaml brings its own wording in both
  // languages and its source; anything else is a claim typed by hand.
  const fromProgramme = loadClaims().find((k) => k.id === opt.claim.trim()) ?? null;
  const claim = fromProgramme ? { en: fromProgramme.claim.en, fr: fromProgramme.claim.fr } : await prepareClaim({ raw: opt.claim, model: opt.readerModel, effort: opt.effort, mock: opt.dry, usage: count });
  say(`claim: ${claim.en}`);

  const { map } = buildSimulation({ corpus, claim: claim.en, agents, rounds: opt.rounds, dir: sim, runId, model: opt.model });
  const bridge = await startBridge({ model: opt.model, effort: opt.effort, concurrency: opt.concurrency, mock: opt.dry, logFile: path.join(work, 'bridge.jsonl') });
  const logFile = path.join(work, 'mirofish.log');
  const logStream = fs.createWriteStream(logFile);

  // MiroFish reads its model settings from these three variables. The key is a
  // placeholder: the real one stays in this process, with the SDK, and the
  // engine only ever sees the local bridge.
  const engineEnv = {
    LLM_API_KEY: 'clearing-bridge',
    LLM_BASE_URL: bridge.url,
    LLM_MODEL_NAME: opt.model,
    // The bridge queues calls above its concurrency limit: give a queued call
    // time to be served instead of letting the engine time out and send it again.
    MODEL_TIMEOUT: '1800',
    // Where OASIS looks up follower counts. Without it the library creates a
    // data folder inside its own installation.
    OASIS_DB_PATH: path.join(sim, 'reddit_simulation.db'),
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    NO_PROXY: '127.0.0.1,localhost',
    no_proxy: '127.0.0.1,localhost',
  };
  const engineArgs = [opt.runner, '--config', path.join(sim, 'simulation_config.json'), '--reddit-only', '--max-rounds', String(opt.rounds)];
  let child;
  if (opt.runAs) {
    // The engine and its dependencies are third-party code. Under another
    // system account, with a clean environment, they cannot read this
    // process, where the API key lives.
    for (const d of [work, sim]) fs.chmodSync(d, 0o755);
    fs.chmodSync(sim, 0o777);
    fs.mkdirSync(path.join(sim, 'ipc_commands'), { recursive: true });
    fs.chmodSync(path.join(sim, 'ipc_commands'), 0o777);
    const assignments = Object.entries(engineEnv).map(([k, v]) => `${k}=${v}`);
    child = spawn('sudo', ['-n', '-H', '-u', opt.runAs, 'env', ...assignments, opt.python, ...engineArgs], { cwd: sim, stdio: ['ignore', 'pipe', 'pipe'] });
  } else {
    const env = { ...process.env, ...engineEnv };
    for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENAI_API_BASE_URL', 'LLM_BOOST_API_KEY', 'LLM_BOOST_BASE_URL', 'LLM_BOOST_MODEL_NAME']) delete env[k];
    child = spawn(opt.python, engineArgs, { cwd: sim, env, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });
  const exited = new Promise((resolve) => child.once('close', resolve));
  child.once('error', (e) => {
    child.spawnError = e;
  });

  const wait = { until: Date.now() + opt.timeoutMs, child, logFile };
  let interviews = {};
  try {
    say('rounds running…');
    await waitFor(() => readJson(path.join(sim, 'env_status.json'))?.status === 'alive', { ...wait, what: 'the end of the rounds' });
    say(`rounds done (${bridge.stats().actions} agent turns). Closing interviews…`);
    const answer = await command(
      sim,
      `${runId}-interviews`,
      'batch_interview',
      { platform: 'reddit', interviews: map.agents.map((a) => ({ agent_id: a.agent_id, prompt: interviewPrompt(claim.en), platform: 'reddit' })) },
      wait,
    );
    if (answer.status !== 'completed') throw new Error(`The closing interviews failed: ${answer.error ?? 'no detail'}`);
    interviews = answer.result?.results ?? {};
    await command(sim, `${runId}-close`, 'close_env', {}, wait).catch(() => null);
  } finally {
    let timer;
    const done = await Promise.race([exited, new Promise((r) => { timer = setTimeout(() => r('timeout'), 60_000); })]);
    clearTimeout(timer);
    if (done === 'timeout') {
      if (opt.runAs) spawn('sudo', ['-n', 'pkill', '-KILL', '-u', opt.runAs], { stdio: 'ignore' });
      else child.kill('SIGKILL');
    }
    logStream.end();
    await bridge.close();
  }

  const stats = bridge.stats();
  const sentPrompts = bridge.prompts();
  const stances = map.agents.map((a) => {
    const raw = interviews[`reddit_${a.agent_id}`]?.response;
    return { author: a.author, ...parseStance(typeof raw === 'string' ? raw : null, corpus.authorById[a.author]) };
  });
  const answered = stances.filter((s) => s.position != null);
  const transcript = transcriptOf(sim, map);
  const comments = transcript.filter((e) => e.type === 'comment').length;
  say(`${answered.length}/${stances.length} agents gave a position, ${comments} comments, ${stats.errors} failed calls, ${stats.refusals} declined`);

  if (stats.calls === 0 || stats.errors > stats.calls * 0.1) throw new Error(`Too many calls to the model failed (${stats.errors} of ${stats.calls + stats.errors}). See ${path.join(work, 'bridge.jsonl')}.`);
  if (answered.length < Math.max(LIMITS.agents.min, Math.ceil(stances.length / 2))) throw new Error('Fewer than half of the agents gave a position: the run is not kept.');
  if (comments === 0) throw new Error('No agent commented on the claim: the run is not kept.');

  const reading = await readRun({ claim, stances, transcript, corpus, model: opt.readerModel, effort: opt.effort, mock: opt.dry, usage: count });

  const positions = corpus.branches
    .map((b) => {
      const ps = answered.filter((s) => corpus.authorById[s.author].branch === b.id).map((s) => s.position);
      return ps.length ? { branch: b.id, score: median(ps), min: Math.min(...ps), max: Math.max(...ps), agents: ps.length } : null;
    })
    .filter(Boolean);

  const agentCost = estimateCost(opt.model, stats.tokens);
  const readerCost = estimateCost(opt.readerModel, tokens);
  const cost = opt.dry || agentCost == null || readerCost == null ? null : agentCost + readerCost;

  const run = {
    id: runId,
    runId,
    status: opt.status,
    ...(opt.dry ? { dryRun: true } : {}),
    date: new Date().toISOString().slice(0, 10),
    claim,
    ...(fromProgramme
      ? {
          claimSource: {
            id: fromProgramme.id,
            party: fromProgramme.party,
            programme: fromProgramme.programme,
            locator: fromProgramme.locator,
            quote: fromProgramme.quote,
          },
        }
      : {}),
    summary: reading.summary,
    engine: { name: ENGINE.name, commit: ENGINE.commit, platform: ENGINE.platform, packages: ENGINE.packages.slice(0, 2) },
    model: {
      requested: opt.model,
      ...(opt.readerModel !== opt.model ? { reader: opt.readerModel } : {}),
      served: Object.keys(stats.servedBy),
      effort: opt.dry ? null : opt.effort,
    },
    settings: { rounds: opt.rounds, agents: agents.length, selection: opt.agents },
    counts: {
      turns: stats.actions,
      comments,
      reactions: transcript.filter((e) => e.type === 'like' || e.type === 'dislike').length,
      interviews: stats.interviews,
      declined: stats.refusals,
      failed: stats.errors,
      tokensIn: stats.tokens.input + stats.tokens.cacheRead + stats.tokens.cacheWrite + tokens.input + tokens.cacheRead + tokens.cacheWrite,
      tokensOut: stats.tokens.output + tokens.output,
      ...(cost != null ? { costUsd: Math.round(cost * 100) / 100 } : {}),
    },
    positions,
    alliances: reading.alliances,
    voices: stances
      .filter((s) => s.position != null && s.reaction)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        author: s.author,
        position: s.position,
        ...(s.work ? { work: s.work } : {}),
        text: { en: s.reaction, fr: reading.reactionsFr[s.author] ?? s.reaction },
      })),
    silent: stances.filter((s) => s.position == null || !s.reaction).map((s) => s.author),
  };

  const record = {
    runId,
    note: 'Simulated debate. Nothing here is a statement by any author named.',
    claim,
    prompts: {
      note: 'What each agent was told, exactly as sent to the model.',
      agents: Object.fromEntries(map.agents.map((a) => [a.author, sentPrompts[a.username] ?? null])),
      opening: JSON.parse(fs.readFileSync(path.join(sim, 'simulation_config.json'), 'utf8')).event_config.initial_posts[0].content,
      interview: interviewPrompt(claim.en),
    },
    transcript,
    interviews: stances,
  };

  fs.mkdirSync(opt.out, { recursive: true });
  const header = [
    `# Clearing run ${runId}. Simulated: nothing below is a statement by any author named.`,
    '# Written by clearing/run.mjs. The transcript and the prompts are in the file next to this one.',
  ].join('\n');
  const yamlFile = path.join(opt.out, `${runId}.yaml`);
  fs.writeFileSync(yamlFile, `${header}\n${YAML.stringify(run, { lineWidth: 0 })}`);
  fs.writeFileSync(path.join(opt.out, `${runId}.transcript.json`), `${JSON.stringify(record, null, 2)}\n`);
  say(`written: ${path.relative(ROOT, yamlFile)}`);

  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `run_id=${runId}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const name = (id) => corpus.authorById[id].name;
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        `## Clearing run ${runId}${opt.dry ? ' (dry run, stand-in model)' : ''}`,
        '',
        `**Claim.** ${claim.en}`,
        '',
        `${run.summary.en}`,
        '',
        `| | |`,
        `|---|---|`,
        `| Agents | ${agents.length} |`,
        `| Rounds | ${opt.rounds} |`,
        `| Model | ${opt.dry ? 'stand-in' : `${run.model.served.join(', ')} (effort ${opt.effort})${opt.readerModel !== opt.model ? `, reading by ${opt.readerModel}` : ''}`} |`,
        `| Agent turns | ${run.counts.turns} |`,
        `| Comments | ${run.counts.comments} |`,
        `| Tokens | ${run.counts.tokensIn.toLocaleString('en')} in (${stats.tokens.cacheRead.toLocaleString('en')} read from cache), ${run.counts.tokensOut.toLocaleString('en')} out |`,
        `| Estimated cost | ${cost == null ? 'n/a' : `${cost.toFixed(2)} USD at list prices`} |`,
        `| Declined or failed calls | ${run.counts.declined} declined, ${run.counts.failed} failed |`,
        `| Status | ${run.status} |`,
        '',
        '| Branch | Median position | Range |',
        '|---|---|---|',
        ...positions.map((p) => `| ${corpus.branchById[p.branch].name.en} | ${p.score} | ${p.min} to ${p.max} |`),
        '',
        ...run.alliances.map((al) => `- **${al.title.en}** (${al.authors.map(name).join(', ')}): ${al.text.en}`),
        '',
      ].join('\n'),
    );
  }
}

main().catch((e) => {
  console.error(`clearing: ${e.message}`);
  process.exit(1);
});
