// The bridge between MiroFish and Claude.
//
// MiroFish speaks to its model through the OpenAI chat-completions wire
// format. This file serves that format on localhost and answers every request
// through the official Anthropic SDK. Nothing leaves the machine except the
// calls the SDK makes to the Claude API.
//
// It also keeps the record a published run needs: the exact prompt each agent
// received, every answer, and the token count.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULTS } from './config.mjs';
import { mockAnswer } from './mock.mjs';

// The engine's profile template ends every persona with a sentence built from
// an age, a gender, a country and a personality type. Ecosophia assigns none
// of these to an author, fills them with "n/a", and removes the sentence here.
const DEMOGRAPHICS = /\s*You are a n\/a, n\/a years old, with an MBTI personality type of n\/a from n\/a\./g;

const textOf = (content) => {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p === 'string' ? p : (p?.text ?? ''))).join('');
  return String(content);
};

const parseArgs = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

/**
 * OpenAI chat-completions request -> Anthropic Messages request.
 *
 * Earlier thinking blocks are not replayed: the OpenAI format has no place to
 * carry them, the engine trims old turns from an agent's memory, and a history
 * sent with none of them is always valid. Each agent turn is a fresh decision
 * on what the agent sees now, so nothing is lost that the run depends on.
 */
export function toAnthropic(body) {
  const system = [];
  const turns = [];
  const push = (role, blocks) => {
    const kept = blocks.filter((b) => b.type !== 'text' || b.text.trim() !== '');
    if (kept.length === 0) return;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content.push(...kept);
    else turns.push({ role, content: kept });
  };

  for (const m of body.messages ?? []) {
    if (m.role === 'system' || m.role === 'developer') {
      const s = textOf(m.content).replace(DEMOGRAPHICS, '').trim();
      if (s && !system.includes(s)) system.push(s);
    } else if (m.role === 'user') {
      push('user', [{ type: 'text', text: textOf(m.content) }]);
    } else if (m.role === 'assistant') {
      const blocks = [{ type: 'text', text: textOf(m.content) }];
      for (const tc of m.tool_calls ?? []) {
        blocks.push({ type: 'tool_use', id: String(tc.id), name: tc.function?.name ?? 'unknown', input: parseArgs(tc.function?.arguments) });
      }
      push('assistant', blocks);
    } else if (m.role === 'tool') {
      push('user', [{ type: 'tool_result', tool_use_id: String(m.tool_call_id), content: textOf(m.content) || '(no output)' }]);
    }
  }

  // A tool call must be answered in the very next turn, and a result must
  // answer a call. When the engine has trimmed one half of a pair out of an
  // agent's memory, the half that is left becomes a plain note.
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.role === 'assistant') {
      const next = turns[i + 1];
      const answered = new Set((next?.role === 'user' ? next.content : []).filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id));
      t.content = t.content.map((b) =>
        b.type === 'tool_use' && !answered.has(b.id) ? { type: 'text', text: `[earlier action: ${b.name} ${JSON.stringify(b.input)}]` } : b,
      );
    } else {
      const prev = turns[i - 1];
      const asked = new Set((prev?.role === 'assistant' ? prev.content : []).filter((b) => b.type === 'tool_use').map((b) => b.id));
      t.content = t.content.map((b) =>
        b.type === 'tool_result' && !asked.has(b.tool_use_id) ? { type: 'text', text: `[earlier result: ${textOf(b.content)}]` } : b,
      );
      // Results come first in a user turn, text after them.
      t.content.sort((a, b) => (a.type === 'tool_result' ? 0 : 1) - (b.type === 'tool_result' ? 0 : 1));
    }
  }
  if (turns.length === 0 || turns[0].role !== 'user') turns.unshift({ role: 'user', content: [{ type: 'text', text: '(earlier turns are not shown)' }] });
  if (turns[turns.length - 1].role !== 'user') turns.push({ role: 'user', content: [{ type: 'text', text: 'Continue.' }] });

  const tools = (body.tools ?? [])
    .filter((t) => t?.type === 'function' && t.function?.name)
    .map((t) => ({
      name: t.function.name,
      description: t.function.description ?? '',
      input_schema: t.function.parameters?.type === 'object' ? t.function.parameters : { type: 'object', properties: {} },
    }));

  const request = { system: system.join('\n\n'), messages: turns };
  if (tools.length && body.tool_choice !== 'none') request.tools = tools;
  return request;
}

const FINISH = { tool_use: 'tool_calls', max_tokens: 'length', model_context_window_exceeded: 'length' };

/** Anthropic message -> OpenAI chat-completions response. */
export function toOpenAI(message, requestedModel) {
  const refused = message.stop_reason === 'refusal';
  const blocks = refused ? [] : (message.content ?? []);
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const toolCalls = blocks
    .filter((b) => b.type === 'tool_use' && b.input && typeof b.input === 'object')
    .map((b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input) } }));
  const u = message.usage ?? {};
  const prompt = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const completion = u.output_tokens ?? 0;
  return {
    id: `chatcmpl-${message.id ?? crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: message.model ?? requestedModel,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
        finish_reason: toolCalls.length ? 'tool_calls' : (FINISH[message.stop_reason] ?? 'stop'),
      },
    ],
    usage: { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion },
  };
}

function limiter(max) {
  let active = 0;
  const waiting = [];
  const next = () => {
    if (active >= max || waiting.length === 0) return;
    active++;
    waiting.shift()();
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      waiting.push(() => fn().then(resolve, reject).finally(() => { active--; next(); }));
      next();
    });
}

const agentNameOf = (system) => system.match(/Your name is ([^\n]+?)\.\s/)?.[1] ?? 'unknown';

/**
 * Starts the bridge on a free local port.
 * @returns {{url: string, stats: () => object, prompts: () => object, close: () => Promise<void>}}
 */
export async function startBridge({
  model = DEFAULTS.model,
  effort = DEFAULTS.effort,
  concurrency = DEFAULTS.concurrency,
  maxTokens = DEFAULTS.maxTokens,
  mock = false,
  logFile = null,
} = {}) {
  // The SDK reads ANTHROPIC_API_KEY from the environment and retries rate
  // limits and overloads with backoff.
  const client = mock ? null : new Anthropic({ maxRetries: 6 });
  const run = limiter(concurrency);
  const prompts = new Map();
  const stats = {
    mock,
    model,
    effort: mock ? null : effort,
    calls: 0,
    actions: 0,
    interviews: 0,
    refusals: 0,
    errors: 0,
    servedBy: {},
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  const log = (entry) => {
    if (logFile) fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`);
  };

  async function complete(body) {
    const request = toAnthropic(body);
    const kind = request.tools ? 'action' : 'interview';
    const agent = agentNameOf(request.system);
    if (request.system && !prompts.has(agent)) prompts.set(agent, request.system);
    const started = Date.now();

    let message;
    if (mock) {
      message = mockAnswer(request, { agent, model });
    } else {
      // On a decline, `fallbacks: "default"` lets the API retry the request on
      // the model's default substitute inside the same call. Models without
      // one simply run alone.
      message = await client.beta.messages.create({
        model,
        max_tokens: maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort },
        // An agent's context grows by one round at a time: what it already
        // read is cached, so later rounds and the closing interview reread
        // it at a fraction of the price.
        cache_control: { type: 'ephemeral' },
        ...(request.system ? { system: request.system } : {}),
        messages: request.messages,
        ...(request.tools ? { tools: request.tools } : {}),
      });
    }

    const u = message.usage ?? {};
    stats.calls++;
    stats[kind === 'action' ? 'actions' : 'interviews']++;
    stats.tokens.input += u.input_tokens ?? 0;
    stats.tokens.output += u.output_tokens ?? 0;
    stats.tokens.cacheRead += u.cache_read_input_tokens ?? 0;
    stats.tokens.cacheWrite += u.cache_creation_input_tokens ?? 0;
    stats.servedBy[message.model] = (stats.servedBy[message.model] ?? 0) + 1;
    if (message.stop_reason === 'refusal') stats.refusals++;

    const out = toOpenAI(message, model);
    log({
      at: new Date().toISOString(),
      kind,
      agent,
      model: message.model,
      stop: message.stop_reason,
      ms: Date.now() - started,
      usage: { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0 },
      text: out.choices[0].message.content,
      calls: (out.choices[0].message.tool_calls ?? []).map((c) => ({ name: c.function.name, args: JSON.parse(c.function.arguments) })),
    });
    return out;
  }

  const server = http.createServer((req, res) => {
    const send = (status, payload) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true });
    if (req.method !== 'POST' || !req.url.endsWith('/chat/completions')) {
      return send(404, { error: { message: `The Clearing bridge only serves POST /v1/chat/completions (got ${req.method} ${req.url}).`, type: 'invalid_request_error' } });
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return send(400, { error: { message: 'The request body is not JSON.', type: 'invalid_request_error' } });
      }
      if (body.stream) return send(400, { error: { message: 'The Clearing bridge does not stream.', type: 'invalid_request_error' } });
      run(() => complete(body)).then(
        (out) => send(200, out),
        (err) => {
          stats.errors++;
          const status = Number.isInteger(err?.status) ? err.status : 500;
          const message = err?.message ?? String(err);
          log({ at: new Date().toISOString(), kind: 'error', status, message });
          console.error(`[bridge] ${status} ${message}`);
          send(status, { error: { message, type: status === 429 ? 'rate_limit_error' : status >= 500 ? 'server_error' : 'invalid_request_error' } });
        },
      );
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}/v1`,
    stats: () => structuredClone(stats),
    prompts: () => Object.fromEntries(prompts),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
