// Tests of the Ecosophia side of the Clearing pipeline. They call no outside
// service: the model is the stand-in from clearing/mock.mjs and the engine is
// the double in clearing/test/engine-double.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { toAnthropic, toOpenAI, startBridge } from '../bridge.mjs';
import { parseStance, unquote } from '../reading.mjs';
import { selectAgents, persona } from '../seed.mjs';
import { loadCorpus } from '../../src/lib/corpus.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const corpus = loadCorpus();

test('the bridge turns an OpenAI request into a Claude request', () => {
  const out = toAnthropic({
    messages: [
      { role: 'system', content: 'Your name is x_agent.\nYour have profile: P.You are a n/a, n/a years old, with an MBTI personality type of n/a from n/a.\n\n# RESPONSE METHOD' },
      { role: 'system', content: 'Your name is x_agent.\nYour have profile: P.You are a n/a, n/a years old, with an MBTI personality type of n/a from n/a.\n\n# RESPONSE METHOD' },
      { role: 'user', content: 'feed 1' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'toolu_1', type: 'function', function: { name: 'create_comment', arguments: '{"post_id":1,"content":"hello"}' } }] },
      { role: 'tool', tool_call_id: 'toolu_1', content: '{"success": true}' },
      { role: 'user', content: 'feed 2' },
    ],
    tools: [{ type: 'function', function: { name: 'create_comment', description: 'd', parameters: { type: 'object', properties: { post_id: { type: 'integer' } } } } }],
  });
  assert.ok(!out.system.includes('MBTI'), 'the demographics sentence is removed');
  assert.equal(out.system.match(/Your name is/g).length, 1, 'a repeated system prompt is sent once');
  assert.deepEqual(out.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.deepEqual(out.messages[1].content, [{ type: 'tool_use', id: 'toolu_1', name: 'create_comment', input: { post_id: 1, content: 'hello' } }]);
  assert.deepEqual(out.messages[2].content.map((b) => b.type), ['tool_result', 'text']);
  assert.equal(out.tools[0].input_schema.type, 'object');
});

test('the bridge repairs a history the engine has trimmed', () => {
  const out = toAnthropic({
    messages: [
      { role: 'tool', tool_call_id: 'toolu_gone', content: 'orphan result' },
      { role: 'assistant', content: 'thinking aloud', tool_calls: [{ id: 'toolu_2', type: 'function', function: { name: 'like_comment', arguments: 'not json' } }] },
      { role: 'user', content: 'closing question' },
    ],
  });
  assert.deepEqual(out.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.ok(out.messages.every((m) => m.content.every((b) => b.type === 'text')), 'unpaired calls and results become notes');
  assert.equal(out.tools, undefined);
});

test('the bridge turns a Claude answer into an OpenAI answer', () => {
  const answer = toOpenAI({
    id: 'msg_1',
    model: 'claude-opus-5-5',
    stop_reason: 'tool_use',
    content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'ok' }, { type: 'tool_use', id: 'toolu_3', name: 'do_nothing', input: {} }],
    usage: { input_tokens: 10, cache_read_input_tokens: 90, output_tokens: 5 },
  });
  assert.equal(answer.choices[0].finish_reason, 'tool_calls');
  assert.equal(answer.choices[0].message.tool_calls[0].function.arguments, '{}');
  assert.deepEqual(answer.usage, { prompt_tokens: 100, completion_tokens: 5, total_tokens: 105 });
  const refused = toOpenAI({ stop_reason: 'refusal', content: [{ type: 'text', text: 'partial' }], usage: {} }, 'm');
  assert.equal(refused.choices[0].message.content, '');
  assert.equal(refused.choices[0].finish_reason, 'stop');
});

test('the bridge answers over HTTP in the OpenAI wire format', async () => {
  const bridge = await startBridge({ mock: true });
  try {
    const res = await fetch(`${bridge.url}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'any', messages: [{ role: 'system', content: 'Your name is test_agent.\nYour have profile: P {illich-1973}.' }, { role: 'user', content: 'Where do you stand?' }] }),
    });
    assert.equal(res.status, 200);
    const stance = JSON.parse((await res.json()).choices[0].message.content);
    assert.ok(Number.isInteger(stance.position));
    assert.equal(bridge.stats().interviews, 1);
    assert.equal((await fetch(`${bridge.url}/models`)).status, 404);
  } finally {
    await bridge.close();
  }
});

test('a closing answer is parsed and cleaned', () => {
  const illich = corpus.authorById['ivan-illich'];
  const s = parseStance('Here it is:\n{"position": 104.4, "reaction": "Ask \\"how much\\" before which — always.", "work": "illich-1974"}', illich);
  assert.deepEqual(s, { position: 100, reaction: 'Ask how much before which, always.', work: 'illich-1974' });
  assert.equal(parseStance('{"position": 20, "reaction": "x", "work": "gorz-1975"}', illich).work, null, 'a work of another author is dropped');
  assert.deepEqual(parseStance('no json here', illich), { position: null, reaction: null, work: null });
  assert.equal(unquote('« Oui », dit-il'), 'Oui, dit-il');
});

test('agents are chosen from the leaves, and withdrawn authors stay out', () => {
  const all = selectAgents(corpus, 'all');
  assert.equal(all.agents.length, corpus.authors.filter((a) => a.layer === 'leaf' && a.agent !== false).length);
  const some = selectAgents(corpus, 'technocritique, james-lovelock');
  assert.ok(some.agents.every((a) => a.branch === 'technocritique' || a.id === 'james-lovelock'));
  assert.throws(() => selectAgents(corpus, 'karl-marx-the-second'), /Unknown author or branch/);
  assert.throws(() => selectAgents(corpus, 'james-lovelock'), /at least/);
  const text = persona(corpus.authorById['ivan-illich'], corpus, ['1: Ivan Illich agent, Technocritique']);
  assert.ok(text.includes('You are not Ivan Illich'));
  assert.ok(text.includes('died in 2002'));
  assert.ok(!/["“”«»]/.test(text), 'a persona holds no quotation marks');
});

test('a dry run goes from claim to run files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clearing-test-'));
  try {
    execFileSync(
      process.execPath,
      [
        path.join(root, 'clearing', 'run.mjs'),
        '--dry-run',
        '--claim', 'Nuclear power should count as green investment in the European Union.',
        '--agents', 'technocritique,counterpoint',
        '--rounds', '2',
        '--engine', path.join(here, 'engine-double'),
        '--python', process.env.PYTHON ?? 'python3',
        '--work', path.join(tmp, 'work'),
        '--out', path.join(tmp, 'out'),
        '--timeout-minutes', '3',
      ],
      { cwd: root, stdio: 'pipe', env: { ...process.env, GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '' } },
    );
    const files = fs.readdirSync(path.join(tmp, 'out'));
    const yamlFile = files.find((f) => f.endsWith('.yaml'));
    const run = YAML.parse(fs.readFileSync(path.join(tmp, 'out', yamlFile), 'utf8'));
    const record = JSON.parse(fs.readFileSync(path.join(tmp, 'out', yamlFile.replace('.yaml', '.transcript.json')), 'utf8'));
    assert.equal(run.status, 'draft');
    assert.equal(run.dryRun, true);
    assert.equal(run.settings.agents, 8);
    assert.equal(run.voices.length, 8);
    assert.deepEqual(run.positions.map((p) => p.branch), ['technocritique', 'counterpoint']);
    assert.equal(run.counts.turns, 16);
    assert.ok(run.counts.comments >= 8);
    assert.equal(new Set(run.alliances.flatMap((al) => al.authors)).size, 8);
    assert.equal(record.transcript[0].type, 'post');
    assert.ok(record.transcript.some((e) => e.type === 'like' && e.to));
    const prompt = record.prompts.agents['ivan-illich'];
    assert.ok(prompt.includes('built from the Ecosophia record of Ivan Illich'));
    assert.ok(!prompt.includes('MBTI'), 'the demographics sentence never reaches the model');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
