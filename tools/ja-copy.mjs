// Writes public/meds/ja.json: the Jan Aushadhi list and its dates from the newest backup, deployed with the
// app and used only while D1 refuses (jaList in worker/src/tools.js). Run by tools/backup.mjs.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const file = readdirSync(join(root, 'backups')).filter((f) => /^samasalt-mitra-\d{4}-\d{2}-\d{2}\.sql$/.test(f)).sort().at(-1);
const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync(join(root, 'backups', file), 'utf8'));
const rows = raw.prepare("SELECT drug_code, generic_name, unit_size, mrp, group_name, units, unit_price, ckey FROM ja_products WHERE ckey IS NOT NULL AND ckey != ''").all();
const meta = Object.fromEntries(raw.prepare("SELECT key, value FROM meta WHERE key IN ('ja_loaded_at', 'ja_list_date', 'kendras_loaded_at', 'kendra_list_date', 'medicines_dataset_date')").all().map((r) => [r.key, r.value]));
if (rows.length < 500 || !meta.ja_loaded_at) throw new Error(`${file}: ${rows.length} rows, not a full list`);
mkdirSync(join(root, 'public/meds'), { recursive: true });
writeFileSync(join(root, 'public/meds/ja.json'), JSON.stringify({ meta, rows }));
console.log(`public/meds/ja.json: ${rows.length} products, list of ${meta.ja_list_date} (from ${file})`);
