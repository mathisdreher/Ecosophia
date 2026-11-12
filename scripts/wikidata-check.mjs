// Compares the facts entered by hand in data/authors/*.yaml with Wikidata:
// years of birth and death, and the place of birth. It writes a report and a
// snapshot (.cache/wikidata.json) and changes nothing in the corpus.
//
//   WIKIDATA_USER_AGENT="EcosophiaFactCheck/0.1 (https://example.org/contact)" npm run wikidata
//
// Wikimedia requires automated clients to send a descriptive User-Agent with a
// contact address (https://w.wiki/4wJS). The script refuses to run without one,
// makes a handful of batched requests and waits between them.
import fs from 'node:fs';
import path from 'node:path';
import { loadCorpus } from '../src/lib/corpus.mjs';

const UA = process.env.WIKIDATA_USER_AGENT;
if (!UA || !/\(.+\)/.test(UA)) {
  console.error(
    'wikidata: set WIKIDATA_USER_AGENT to a descriptive name with a contact in brackets,\n' +
      'for example  EcosophiaFactCheck/0.1 (https://github.com/<owner>/<repo>)',
  );
  process.exit(2);
}

const API = 'https://www.wikidata.org/w/api.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function entities(ids, props) {
  const out = {};
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const url = `${API}?action=wbgetentities&format=json&languages=en%7Cfr&props=${props}&ids=${chunk.join('%7C')}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Wikidata answered ${res.status} ${res.statusText}`);
    const json = await res.json();
    Object.assign(out, json.entities ?? {});
    await sleep(1200);
  }
  return out;
}

const firstValue = (entity, prop) =>
  (entity?.claims?.[prop] ?? [])
    .filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue)
    .sort((a, b) => (a.rank === 'preferred' ? -1 : 0) - (b.rank === 'preferred' ? -1 : 0))
    .map((c) => c.mainsnak.datavalue.value)[0];
const yearOf = (v) => (v?.time ? Number(/^([+-]\d+)-/.exec(v.time)?.[1]) : null);
const label = (entity, lang) => entity?.labels?.[lang]?.value ?? entity?.labels?.en?.value ?? null;

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const corpus = loadCorpus();
const withQid = corpus.authors.filter((a) => a.wikidata);
const withoutQid = corpus.authors.filter((a) => !a.wikidata);

const people = await entities(withQid.map((a) => a.wikidata), 'claims%7Clabels%7Cdescriptions');
const placeIds = [...new Set(Object.values(people).map((e) => firstValue(e, 'P19')?.id).filter(Boolean))];
const places = placeIds.length ? await entities(placeIds, 'claims%7Clabels') : {};
const countryIds = [...new Set(Object.values(places).map((e) => firstValue(e, 'P17')?.id).filter(Boolean))];
const countries = countryIds.length ? await entities(countryIds, 'labels') : {};

const snapshot = {};
const differences = [];
const additions = [];

for (const a of withQid) {
  const e = people[a.wikidata];
  if (!e || e.missing !== undefined) {
    differences.push(`**${a.name}**: ${a.wikidata} does not exist on Wikidata.`);
    continue;
  }
  const born = yearOf(firstValue(e, 'P569'));
  const died = yearOf(firstValue(e, 'P570'));
  const place = places[firstValue(e, 'P19')?.id];
  const coord = firstValue(place, 'P625');
  const country = countries[firstValue(place, 'P17')?.id];
  snapshot[a.id] = {
    qid: a.wikidata,
    label: label(e, 'en'),
    description: e.descriptions?.en?.value ?? null,
    born,
    died,
    birthplace: place
      ? { en: label(place, 'en'), fr: label(place, 'fr'), lat: coord?.latitude ?? null, lon: coord?.longitude ?? null, country: { en: label(country, 'en'), fr: label(country, 'fr') } }
      : null,
  };
  const s = snapshot[a.id];

  if (s.label && !s.label.toLowerCase().includes(a.sort.toLowerCase().split(/[\s-]/)[0]) && !a.name.toLowerCase().includes(s.label.toLowerCase().split(' ').pop())) {
    differences.push(`**${a.name}**: ${a.wikidata} is labelled "${s.label}" (${s.description ?? 'no description'}). Check that the QID is the right person.`);
  }
  if (a.born != null && born != null && a.born !== born) differences.push(`**${a.name}**: born ${a.born} here, ${born} on Wikidata.`);
  if (a.died != null && died != null && a.died !== died) differences.push(`**${a.name}**: died ${a.died} here, ${died} on Wikidata.`);
  if (a.died == null && died != null) differences.push(`**${a.name}**: shown as living here; Wikidata gives a death in ${died}.`);
  if (a.died != null && died == null) differences.push(`**${a.name}**: died ${a.died} here; Wikidata gives no date of death.`);
  if (a.born == null && born != null) additions.push(`**${a.name}**: Wikidata gives a birth in ${born}.`);
  if (a.place?.lat != null && s.birthplace?.lat != null) {
    const km = distanceKm(a.place.lat, a.place.lon, s.birthplace.lat, s.birthplace.lon);
    if (km > 40) differences.push(`**${a.name}**: birthplace here is ${Math.round(km)} km from Wikidata's (${s.birthplace.en}, ${s.birthplace.country.en ?? '?'}).`);
  } else if (a.place?.lat == null && s.birthplace?.lat != null) {
    additions.push(`**${a.name}**: Wikidata gives a birthplace, ${s.birthplace.en} (${s.birthplace.country.en ?? '?'}), at ${s.birthplace.lat.toFixed(2)}, ${s.birthplace.lon.toFixed(2)}.`);
  }
}

fs.mkdirSync(path.join(process.cwd(), '.cache'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), '.cache/wikidata.json'), JSON.stringify(snapshot, null, 2));

const lines = [
  '## Corpus compared with Wikidata',
  '',
  `${withQid.length} authors checked, ${withoutQid.length} without a QID.`,
  '',
  `### Differences to look at (${differences.length})`,
  ...(differences.length ? differences.map((d) => `- ${d}`) : ['None.']),
  '',
  `### Facts Wikidata could add (${additions.length})`,
  ...(additions.length ? additions.map((d) => `- ${d}`) : ['None.']),
  '',
  `### Authors without a QID (${withoutQid.length})`,
  ...(withoutQid.length ? withoutQid.map((a) => `- ${a.name}`) : ['None.']),
  '',
  'Wikidata is a reference, not an authority: check a difference against a second source before changing the corpus.',
];
const report = lines.join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
