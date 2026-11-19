// v2.0 WhatsApp bot: the reply text for one agent result. Built only from the agent's verified
// facts and the templates in public/strings.js (composeAnswer + wa* keys): no model writes any
// price or safety line. Never-switch (NTI) medicines get the warning only: no brands, no generic,
// no order link.
import { t, rupees, unitKind } from '../../public/strings.js';
import { showMobile, waLink, orderItems, orderMessage } from '../../public/rules.js';

export const WA_MAX = 4000; // WhatsApp text limit is 4096
const clip = (s) => (s.length > WA_MAX ? s.slice(0, WA_MAX - 1) + '…' : s);
const one = (s) => String(s ?? '').replace(/[\r\n*_~`]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Nearest Kendras: up to 3, with the registered number and an order link where allowed. */
// With `origin`, the order link is a short one on our site (/o/<Kendra>/<PMBJP code>) that opens the
// same prepared WhatsApp message; without it, the full wa.me link.
export function orderLink(lang, k, order, origin) {
  if (origin) return `${origin}/o/${k.code}/${encodeURIComponent(order.items[0].code)}${lang === 'en' ? '' : `?l=${lang}`}`;
  return waLink(k.contact.whatsapp, orderMessage(k, order, (key, v) => t(lang, key, v), lang === 'en' ? null : (key, v) => t('en', key, v), rupees));
}

export function kendraLines(lang, kendras, pin, order = null, origin = null) {
  if (!kendras?.items?.length) return [t(lang, 'waNoKendra', { pin })];
  const L = [t(lang, 'waKendras', { pin })];
  kendras.items.slice(0, 3).forEach((k, i) => {
    L.push(`${i + 1}. ${one(k.code)}: ${one([k.address, k.district].filter(Boolean).join(', '))} (${one(k.pin)})`);
    if (k.contact?.whatsapp) {
      L.push(`   ${t(lang, 'waRegistered', { mobile: showMobile(k.contact.whatsapp) })}`);
      // Opening hours given by the Kendra at registration, so nobody walks to a closed shop.
      if (k.contact.hours) L.push(`   🕘 ${t(lang, 'kendraHours', { hours: one(k.contact.hours) })}`);
      if (k.contact.orders && order?.items?.length) {
        const link = orderLink(lang, k, order, origin);
        if (link) L.push(`   ${t(lang, 'waOrder', { link })}`);
      }
    }
  });
  return L;
}

/** The full answer for a found medicine (status 'ok', confirmed or typed). */
export function answerText(lang, r, pin, origin = null) {
  const m = r.medicine;
  const nti = !!m.nti;
  const L = [`*${one(m.name)}*`, one(m.composition), '', r.answer];
  if (!nti) {
    const ja = r.jan_aushadhi;
    if (ja?.available && ja.product) {
      const p = ja.product;
      L.push('', t(lang, 'waJa', { name: one(p.generic_name), code: one(p.drug_code), size: p.unit_size ? ` · ${one(p.unit_size)}` : '', mrp: rupees(p.mrp) }));
    }
    const per = t(lang, 'perUnit')[unitKind(m.form)];
    if (r.ceiling?.available) L.push('', t(lang, 'waCeiling', { price: rupees(r.ceiling.unit_price), per }));
    const cheaper = (r.same_salt?.items || []).filter((b) => b.name.toLowerCase() !== m.name.toLowerCase() && b.unit_price != null && (m.unit_price == null || b.unit_price < m.unit_price)).slice(0, 3);
    if (cheaper.length) {
      L.push('', t(lang, 'waBrands'));
      cheaper.forEach((b, i) => L.push(`${i + 1}. ${one(b.name)}: ${rupees(b.unit_price)} ${per}`));
    }
  }
  L.push('');
  if (pin && pin.length === 6) {
    // Order link only for a Jan Aushadhi generic of a medicine that may be switched.
    const ja = r.jan_aushadhi;
    const order = !nti && ja?.available && ja.product
      ? orderItems([{ ckey: m.ckey, name: m.name, nti: false, qty: 1, ja: { name: ja.product.generic_name, code: ja.product.drug_code, unit_size: ja.product.unit_size, mrp: ja.product.mrp } }])
      : null;
    L.push(...kendraLines(lang, r.kendras, pin, order, origin));
  } else L.push(t(lang, 'waAskPin'));
  L.push('', t(lang, 'waFooter', { date: one(r.data?.brand_prices || '') }));
  return clip(L.join('\n'));
}

/** Short "what was read" line for the photo confirmation. */
export function readText(r) {
  const parts = [r.medicine?.name || r.read?.brand, r.read?.composition || r.medicine?.composition].filter(Boolean).map(one);
  return [...new Set(parts)].join(' · ');
}
