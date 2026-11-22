#!/usr/bin/env node
// Runs the search test set (evals/search_cases.json, roadmap S3.9) against a deployment and scores it:
//   right   = answered with exactly the expected composition (or, for "none", not answered)
//   offered = not answered, but the expected composition is among the choices ("choice" cases pass)
//   missed  = neither (counts against the found rate, never a safety problem)
//   WRONG   = answered with another composition, or answered where nothing may be: must stay 0
// Writes evals/search_results.json + evals/SEARCH_RESULTS.md. Exit code 1 if any WRONG.
//
//   node evals/run_search_evals.mjs                       # test site (default)
//   SAMASALT_MITRA_URL=https://samasalt-mitra.samasalt-mitra-worker.workers.dev node evals/run_search_evals.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeKey } from '../worker/src/normalize.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SAMASALT_MITRA_URL || 'https://samasalt-mitra-staging.samasalt-mitra-worker.workers.dev';
const PACE_MS = Number(process.env.PACE_MS || 2500); // stays under the per-address limit
const { cases } = JSON.parse(readFileSync(join(HERE, 'search_cases.json'), 'utf8'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(c) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`${BASE}/api/ask`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-samasalt-mitra-test': '1' }, body: JSON.stringify({ text: c.text, lang: c.lang || 'en', test: true }) });
      const res = await r.json();
      if (res.status !== 'busy' && !res.error) return res;
    } catch {}
    await wait(15000 * (attempt + 1)); // busy or a network error: wait and try again
  }
  return { status: 'error' };
}

const results = [];
for (const c of cases) {
  const t0 = Date.now();
  const res = await ask(c);
  const ms = Date.now() - t0;
  const want = c.expect_ckey ? describeKey(c.expect_ckey) : null;
  let outcome;
  if (res.status === 'ok') outcome = c.expect !== 'none' && res.medicine?.ckey === c.expect_ckey ? 'right' : 'WRONG';
  else if (res.status === 'error') outcome = 'error';
  else if (c.expect === 'none') outcome = 'right';
  // Offered: among the choices (name + salts), or the expected brand among the "Did you mean" names.
  else outcome = (res.choices || []).some((x) => x.composition === want) || (c.brand && (res.suggestions || []).includes(c.brand)) ? 'offered' : 'missed';
  const pass = outcome === 'right' || (outcome === 'offered' && c.expect === 'choice');
  results.push({ id: c.id, text: c.text, expect: c.expect, want, outcome, pass, got: res.medicine ? `${res.medicine.name} [${res.medicine.composition}]` : res.choices ? `choices: ${res.choices.map((x) => x.name).join('; ')}` : res.suggestions ? `did you mean: ${res.suggestions.join('; ')}` : res.status, ms });
  console.log(`${(pass ? 'pass' : outcome === 'WRONG' ? 'WRONG' : 'fail').padEnd(5)} ${c.id.padEnd(26)} ${outcome.padEnd(7)} ${String(ms).padStart(5)} ms  ${results.at(-1).got.slice(0, 90)}`);
  await wait(PACE_MS);
}

const count = (o) => results.filter((r) => r.outcome === o).length;
const summary = {
  when: new Date().toISOString(), target: BASE, cases: results.length,
  passed: results.filter((r) => r.pass).length,
  right: count('right'), offered: count('offered'), missed: count('missed'), wrong: count('WRONG'), errors: count('error'),
  median_ms: results.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(results.length / 2)],
};
writeFileSync(join(HERE, 'search_results.json'), JSON.stringify({ summary, results }, null, 2) + '\n');
writeFileSync(join(HERE, 'SEARCH_RESULTS.md'), [
  '# Search test set results',
  '',
  `Run ${summary.when} against ${BASE}. **${summary.passed}/${summary.cases} pass.** Answered right ${summary.right}, offered among the choices ${summary.offered}, missed ${summary.missed}, **wrong matches ${summary.wrong}** (must be 0), errors ${summary.errors}. Median ${summary.median_ms} ms.`,
  '',
  'Cases: evals/search_cases.src.json (expected compositions taken from the data by evals/build_search_cases.mjs).',
  '',
  '| case | typed | expect | outcome | got |',
  '|---|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.text.replace(/\|/g, '/')} | ${r.expect} | ${r.pass ? r.outcome : `**${r.outcome}**`} | ${r.got.replace(/\|/g, '/').slice(0, 120)} |`),
  '',
].join('\n'));
console.log(`\n${summary.passed}/${summary.cases} pass · right ${summary.right} · offered ${summary.offered} · missed ${summary.missed} · WRONG ${summary.wrong} · errors ${summary.errors}`);
process.exit(summary.wrong ? 1 : 0);
