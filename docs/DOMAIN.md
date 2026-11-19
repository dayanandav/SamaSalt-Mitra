# Own domain for SamaSalt-Mitra

**Status: parked by the owner on 19 Nov 2026 (open enhancement).** The code is ready and switched off (`CANONICAL_HOST = ""`). Ideally buy the domain before printing QR posters in large numbers; posters printed before the switch keep working through the redirect.

The app runs at `samasalt-mitra.samasalt-mitra-worker.workers.dev`. A short domain of its own
(for example `samasaltmitra.in`) looks trustworthy to patients and pharmacists and fits on QR posters.
The code is ready: every link is built from the address the page is served on, and old links move
to the new domain by themselves.

## 1. Buy the domain (owner)

- Any Indian or international registrar (for example the one you already use). A `.in` domain costs
  about ₹500–900 a year; `.org` or `.org.in` also suit a volunteer project.
- Check the name is free first, and turn on auto-renew so it never lapses.

## 2. Put it on Cloudflare (owner, free plan)

1. Cloudflare dashboard → **Add a domain** → enter the domain → choose the **Free** plan.
2. Cloudflare shows two nameservers. At the registrar, replace the domain's nameservers with these two.
3. Wait until Cloudflare says the domain is **Active** (usually under an hour, at most a day).

## 3. Point it at the app (developer)

In `worker/wrangler.toml` (live section):

```toml
CANONICAL_HOST = "samasaltmitra.in"
routes = [{ pattern = "samasaltmitra.in", custom_domain = true }, { pattern = "www.samasaltmitra.in", custom_domain = true }]
```

Then `npx wrangler deploy` (from `worker/`). Cloudflare creates the DNS records and the HTTPS
certificate itself.

What happens to old links:

- **QR posters** (`/k/…`), volunteer links (`/v/…`) and bot order links (`/o/…`) on the old address:
  the Worker sends them to the same path on the new domain (301). Posters already printed keep working.
- **The app page** on the old address: it moves itself to the new domain on load (same `?k=`, `?volunteer=`).
- **`/api/*`** is never redirected, so app copies already on phones and the WhatsApp webhook keep working.
- A phone's saved language and PIN code belong to the old address, so a patient may choose them once more.

## 4. After the switch

- New QR posters (`/poster`) print the new domain automatically.
- WhatsApp bot (when it goes live): set the webhook to `https://<domain>/api/wa/webhook` in the Meta app.
- Update the address in `README.md`, `docs/PILOT.md` and anything sent to PMBI.
- The test site stays on `workers.dev` (no `CANONICAL_HOST` in `[env.staging.vars]`).
