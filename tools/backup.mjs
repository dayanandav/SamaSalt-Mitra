// Backup of the live database to this computer (owner). The Kendra registry, staff accounts and the
// impact log cannot be rebuilt from public lists, so keep a copy:
//
//   node tools/backup.mjs            → backups/samasalt-mitra-<date>.sql (live)
//   node tools/backup.mjs --staging  → backups/samasalt-mitra-staging-<date>.sql
//
// Uses the Cloudflare login already set up for `wrangler deploy`. The file contains staff names and
// Kendra phone numbers: it stays on this computer (backups/ is gitignored), never in GitHub.
// Cloudflare D1 "Time Travel" can also restore the database to any minute of the last 7 days on the
// free plan (30 on Workers Paid; see docs/OPERATIONS.md); these files are the long-term copy.
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const staging = process.argv.includes('--staging');
const db = staging ? 'samasalt-mitra-staging' : 'samasalt-mitra';
const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dir = join(root, 'backups');
mkdirSync(dir, { recursive: true });
const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const out = join(dir, `${db}-${day}.sql`);

const args = ['wrangler', 'd1', 'export', db, '--remote', '--output', out, ...(staging ? ['--env', 'staging'] : [])];
console.log(`Exporting ${db} → ${out}`);
if (process.platform === 'win32') execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npx', ...args], { cwd: join(root, 'worker'), stdio: 'inherit' });
else execFileSync('npx', args, { cwd: join(root, 'worker'), stdio: 'inherit' });
console.log(`Done: ${(statSync(out).size / 1e6).toFixed(1)} MB`);

// The copy of the Jan Aushadhi list deployed with the app (used only while D1 refuses).
if (!staging) await import('./ja-copy.mjs');
// The nearest Kendras of every PIN, deployed with the app.
if (!staging) await import('./kendra-files.mjs');

// Keep the newest 12 backups of this database.
const mine = readdirSync(dir).filter((f) => f.startsWith(`${db}-2`) && f.endsWith('.sql')).sort();
for (const f of mine.slice(0, Math.max(0, mine.length - 12))) { rmSync(join(dir, f)); console.log(`Removed old backup ${f}`); }
