// The agent on this computer: the code in worker/src, the brand files in public/meds and the newest backup
// of the live database (tools/backup.mjs), in memory. Used by run_search_evals.mjs.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { d1 } from '../test/d1shim.mjs';
import { runAgent } from '../worker/src/agent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export async function localAgent() {
  const file = readdirSync(join(ROOT, 'backups')).filter((f) => /^samasalt-mitra-\d{4}-\d{2}-\d{2}\.sql$/.test(f)).sort().at(-1);
  if (!file) throw new Error('No backup of the live database in backups/: run node tools/backup.mjs once.');
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync(join(ROOT, 'backups', file), 'utf8'));
  const ASSETS = { fetch: async (req) => {
    const p = join(ROOT, 'public', decodeURIComponent(new URL(req.url).pathname));
    return existsSync(p) ? new Response(readFileSync(p), { headers: { 'content-type': 'application/json' } }) : new Response('', { status: 404 });
  } };
  const env = { DB: d1(raw), ASSETS, AI: null };
  console.log(`local: worker/src, public/meds, backups/${file}`);
  return (input) => runAgent(env, input).catch((e) => ({ status: 'error', detail: String(e) }));
}
