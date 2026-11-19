#!/usr/bin/env node
// Test lock: the tests are the agreed design. A commit may not change, add or remove a test file
// unless the owner approved it. Approval = the file's fingerprint written in test/APPROVED.json by
// the owner running `node tools/test-lock.mjs approve`.
//
//   node tools/test-lock.mjs check     fingerprints match test/APPROVED.json? (exit 1 if not)
//   node tools/test-lock.mjs run       check + every JavaScript test + the Python test (the pre-commit hook)
//   node tools/test-lock.mjs status    what changed since the last approval (never fails)
//   node tools/test-lock.mjs approve   OWNER ONLY, after reading the test changes: record them as approved
//
// Line endings are ignored (Windows CRLF and Linux LF give the same fingerprint).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOCK = join(ROOT, 'test', 'APPROVED.json');

function testFiles(dir = join(ROOT, 'test')) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === '__pycache__' || f === 'APPROVED.json') continue;
    if (statSync(p).isDirectory()) out.push(...testFiles(p));
    else if (/\.(mjs|js|py|json)$/.test(f)) out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join('/');
const fingerprint = (p) => createHash('sha256').update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const current = () => Object.fromEntries(testFiles().map((p) => [rel(p), fingerprint(p)]).sort(([a], [b]) => a.localeCompare(b)));
const approved = () => (existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')).files || {} : {});

function diff() {
  const now = current(), ok = approved();
  return {
    changed: Object.keys(now).filter((f) => f in ok && ok[f] !== now[f]),
    added: Object.keys(now).filter((f) => !(f in ok)),
    removed: Object.keys(ok).filter((f) => !(f in now)),
  };
}

function report(d) {
  const n = d.changed.length + d.added.length + d.removed.length;
  if (!n) { console.log('Test lock: all test files are approved.'); return true; }
  console.log('Test lock: these test files are NOT approved by the owner:');
  for (const f of d.changed) console.log(`  changed  ${f}`);
  for (const f of d.added) console.log(`  new      ${f}`);
  for (const f of d.removed) console.log(`  removed  ${f}`);
  return false;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false });
  return r.status === 0;
}

const cmd = process.argv[2] || 'check';

if (cmd === 'status') { report(diff()); process.exit(0); }

if (cmd === 'approve') {
  const d = diff();
  report(d);
  if (!process.argv.includes('--yes')) {
    console.log('\nRead the test changes first:  git diff -- test/');
    console.log('Then approve them:            node tools/test-lock.mjs approve --yes');
    process.exit(1);
  }
  writeFileSync(LOCK, JSON.stringify({
    note: 'Fingerprints of the owner-approved tests. Written only by `node tools/test-lock.mjs approve --yes`, run by the owner.',
    approved_at: new Date().toISOString(),
    files: current(),
  }, null, 2) + '\n');
  console.log(`\nApproved ${Object.keys(current()).length} test files. Commit test/APPROVED.json together with the tests.`);
  process.exit(0);
}

const lockOk = report(diff());
if (!lockOk) {
  console.log('\nA test changed without approval. Either undo the test change, or (owner) read it with');
  console.log('`git diff -- test/` and approve it with `node tools/test-lock.mjs approve --yes`.');
}
if (cmd === 'check') process.exit(lockOk ? 0 : 1);

if (cmd === 'run') {
  console.log('\nRunning every test (a failure means the change breaks the agreed design)…');
  const jsFiles = readdirSync(join(ROOT, 'test')).filter((f) => f.endsWith('.test.mjs')).map((f) => `test/${f}`);
  const js = run(process.execPath, ['--import', './test/register-md.mjs', '--test', '--test-reporter=dot', ...jsFiles]);
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const py = run(python, [join('test', 'test_build_ja.py')]);
  const ok = lockOk && js && py;
  console.log(ok ? '\nAll tests pass and are approved.' : `\nBLOCKED:${lockOk ? '' : ' unapproved test changes;'}${js ? '' : ' JavaScript tests failing;'}${py ? '' : ' Python test failing;'}`);
  process.exit(ok ? 0 : 1);
}

console.log(`Unknown command "${cmd}". Use check, run, status or approve.`);
process.exit(2);
