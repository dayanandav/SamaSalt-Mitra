// 2.0.16: in the chat and the bot, "No" to "exactly these two salts?" means the strip has other salts: the
// same answer as in the app (photograph the back or ask the pharmacist), nothing priced. "No" to a photo
// still means another medicine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDb } from './d1shim.mjs';
import { handleMessage } from '../worker/src/whatsapp.js';
import { STRINGS } from '../public/strings.js';

async function chat() {
  const DB = fixtureDb({ ja: [], kendras: [], meta: { ja_loaded_at: 't', kendras_loaded_at: 't' } });
  await DB.prepare("INSERT INTO medicines (id,name,manufacturer,salt,ckey,price,pack,unit_price,form,rel,nti,incomplete) VALUES (900001,'Trizol Two Tablet','M','','aceclofenac:100mg+paracetamol:325mg|tablet',90,10,9,'tablet',NULL,0,0)").run();
  return (lang) => async (msg) => (await handleMessage({ DB, AI: null, WA_HASH_KEY: 'k' }, { from: '919999999999', ...msg }, { lang, isTest: true })).at(-1);
}

test('"No" to the two salts: the salts message in every language, nothing priced, nothing left waiting', async () => {
  const open = await chat();
  for (const lang of ['en', 'kn', 'hi']) {
    const say = open(lang);
    assert.equal((await say({ kind: 'text', text: 'Trizol Two Tablet' })).kind, 'buttons', lang);
    const no = await say({ kind: 'button', button: 'confirm:no' });
    assert.equal(no.body, `${STRINGS[lang].incompleteTitle}
${STRINGS[lang].incompleteBody}`, lang);
    assert.ok(!/₹/.test(no.body));
    assert.equal((await say({ kind: 'button', button: 'confirm:yes' })).body, STRINGS[lang].waNothingPending, 'a later yes does nothing');
  }
});

test('"Yes" to the two salts still checks that medicine', async () => {
  const say = (await chat())('en');
  await say({ kind: 'text', text: 'Trizol Two Tablet' });
  assert.match((await say({ kind: 'button', button: 'confirm:yes' })).body, /Trizol Two Tablet/);
});
