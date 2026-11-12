// The full record of each Clearing run (prompts, transcript, closing
// interviews) as a downloadable file: /clearing/clr-0001.json
import { loadClearing, loadTranscript } from '../../lib/corpus.mjs';

export function getStaticPaths() {
  return loadClearing()
    .runs.filter((r) => loadTranscript(r.id))
    .map((r) => ({ params: { run: r.id } }));
}

export function GET({ params }) {
  const run = loadClearing().runs.find((r) => r.id === params.run);
  const { file, ...summary } = run;
  return new Response(JSON.stringify({ ...summary, ...loadTranscript(run.id) }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
