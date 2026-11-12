#!/usr/bin/env node
// Voice-over with the Gemini text-to-speech API, from a job file: one clip per
// line and language, converted to MP3 with ffmpeg, plus durations.json.
//   GEMINI_API_KEY=... node scripts/gemini-tts.mjs design/gemini-jobs/film-voice.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!process.env.GEMINI_API_KEY) {
  console.error('gemini-tts: set GEMINI_API_KEY.');
  process.exit(2);
}
const out = path.join(process.cwd(), 'design', job.out);
fs.mkdirSync(out, { recursive: true });
const durations = {};
let failed = 0;
for (const [lang, lines] of Object.entries(job.lines)) {
  durations[lang] = [];
  for (const [i, line] of lines.entries()) {
    const name = `${lang}-${String(i + 1).padStart(2, '0')}`;
    const res = await fetch(`${API}/${encodeURIComponent(job.model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${job.style[lang]}: ${line}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: job.voice } } } },
      }),
    });
    const json = await res.json().catch(() => ({}));
    const part = (json.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
    if (!res.ok || !part) {
      console.error(`${name}: ${res.status} ${json.error?.message ?? json.candidates?.[0]?.finishReason ?? 'no audio'}`);
      failed++;
      durations[lang].push(null);
      continue;
    }
    const rate = Number((part.inlineData.mimeType ?? '').match(/rate=(\d+)/)?.[1] ?? 24000);
    const pcm = path.join(out, `${name}.pcm`);
    fs.writeFileSync(pcm, Buffer.from(part.inlineData.data, 'base64'));
    const mp3 = path.join(out, `${name}.mp3`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', pcm, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse', '-c:a', 'libmp3lame', '-b:a', '64k', mp3]);
    fs.rmSync(pcm);
    const secs = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim());
    durations[lang].push(Math.round(secs * 100) / 100);
    console.log(`${name}: ${secs.toFixed(2)} s`);
  }
}
fs.writeFileSync(path.join(out, 'durations.json'), `${JSON.stringify(durations, null, 2)}\n`);
const total = Object.fromEntries(Object.entries(durations).map(([l, d]) => [l, d.reduce((s, x) => s + (x ?? 0), 0).toFixed(1)]));
console.log('total seconds', total);
if (failed) process.exit(1);
