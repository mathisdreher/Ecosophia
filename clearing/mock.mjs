// A stand-in for the model, used by dry runs and tests. It answers in the
// shape of a Claude API message, with fixed rules and no call to any service,
// so the whole pipeline can be exercised for free. Its output is filler and a
// dry run is never published.
import crypto from 'node:crypto';

const hash = (s) => crypto.createHash('sha256').update(s).digest().readUInt32BE(0);

const lastUserText = (request) => {
  const turn = [...request.messages].reverse().find((m) => m.role === 'user');
  return (turn?.content ?? []).map((b) => (b.type === 'text' ? b.text : '')).join('\n');
};

const message = (model, content, stop) => ({
  id: `msg_mock_${crypto.randomUUID().slice(0, 8)}`,
  type: 'message',
  role: 'assistant',
  model: `mock:${model}`,
  content,
  stop_reason: stop,
  usage: { input_tokens: 0, output_tokens: 0 },
});

const toolUse = (name, input) => ({ type: 'tool_use', id: `toolu_mock_${crypto.randomUUID().slice(0, 12)}`, name, input });

/** One agent turn or one closing interview. */
export function mockAnswer(request, { agent, model, kind }) {
  const seen = lastUserText(request);
  const h = hash(agent);

  if (kind === 'interview') {
    const position = h % 101;
    const side = position < 40 ? 'opposes' : position > 60 ? 'endorses' : 'neither endorses nor opposes';
    const work = request.system.match(/\{([a-z0-9-]+-\d{4}[a-z]?)\}/)?.[1] ?? null;
    return message(model, [{ type: 'text', text: JSON.stringify({ position, reaction: `Dry run filler: the ${agent} ${side} the claim.`, work }) }], 'end_turn');
  }

  const has = (name) => request.tools.some((t) => t.name === name);
  const turn = request.messages.filter((m) => m.role === 'assistant').length;
  const postIds = [...seen.matchAll(/"post_id":\s*(\d+)/g)].map((m) => Number(m[1]));
  const commentIds = [...new Set([...seen.matchAll(/"comment_id":\s*(\d+)/g)].map((m) => Number(m[1])))];

  if (turn === 0 && postIds.length && has('create_comment')) {
    return message(model, [toolUse('create_comment', { post_id: postIds[0], content: `Dry run filler: first comment of the ${agent}.` })], 'tool_use');
  }
  if (commentIds.length && has('like_comment') && has('dislike_comment') && has('create_comment')) {
    const target = commentIds[(h + turn) % commentIds.length];
    const calls = [toolUse((h + target) % 3 === 0 ? 'dislike_comment' : 'like_comment', { comment_id: target })];
    if ((h + turn) % 2 === 0) calls.push(toolUse('create_comment', { post_id: postIds[0] ?? 1, content: `Dry run filler: the ${agent} answers comment ${target}.` }));
    return message(model, calls, 'tool_use');
  }
  return message(model, [toolUse('do_nothing', {})], 'tool_use');
}

/** The closing reading of a dry run: groups by position, filler text. */
export function mockReading({ claim, stances }) {
  const bands = [
    { key: 'against', test: (p) => p < 40, title: { en: 'Against (dry run)', fr: 'Contre (essai à blanc)' } },
    { key: 'between', test: (p) => p >= 40 && p <= 60, title: { en: 'Undecided (dry run)', fr: 'Indécis (essai à blanc)' } },
    { key: 'for', test: (p) => p > 60, title: { en: 'For (dry run)', fr: 'Pour (essai à blanc)' } },
  ];
  const withPosition = stances.filter((s) => s.position != null);
  return {
    claim: { en: claim, fr: claim },
    summary: {
      en: 'Dry run with a stand-in model: the positions and the lines below are filler.',
      fr: "Essai à blanc avec un modèle factice : les positions et les lignes ci-dessous sont du remplissage.",
    },
    alliances: bands
      .map((b) => ({
        title: b.title,
        text: { en: 'Filler text of a dry run.', fr: "Texte de remplissage d'un essai à blanc." },
        authors: withPosition.filter((s) => b.test(s.position)).map((s) => s.author),
      }))
      .filter((a) => a.authors.length > 0),
    reactionsFr: Object.fromEntries(stances.filter((s) => s.reaction).map((s) => [s.author, s.reaction.replace('Dry run filler', 'Remplissage d’essai à blanc')])),
  };
}
