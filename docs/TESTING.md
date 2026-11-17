# Test environment (staging)

A separate copy of SamaSalt-Mitra for end-to-end testing of each stage before it goes live. It has its own Worker, its own database and its own admin token, so nothing done here touches the live site or real Kendras.

| | Live | Test (staging) |
|---|---|---|
| Address | https://samasalt-mitra.samasalt-mitra-worker.workers.dev | https://samasalt-mitra-staging.samasalt-mitra-worker.workers.dev |
| Database | `samasalt-mitra` | `samasalt-mitra-staging` (copy of the Jan Aushadhi products and Kendra list, plus 5 test Kendras) |
| Kendra registry | `pilot` (numbers shown to developer mode only) | `public` (numbers shown to everyone, as after PMBJP approval) |
| Staff sign-in | `/kendra` → Staff login | same |
| Admin token | `ADMIN_TOKEN` secret | its own `ADMIN_TOKEN` secret (`--env staging`), shared with the tester separately, never in git |
| Banner | none | red "TEST ENVIRONMENT · test data only · not for patients" on every page and printout |

## Test Kendras

Made-up Kendras, in the test database only. Each has its own PIN, so typing that PIN shows exactly that Kendra.

| Kendra code | PIN | Address (all marked "not a real Kendra") |
|---|---|---|
| PMBJK99001 | 999001 | TEST KENDRA 1, Hubballi, Karnataka |
| PMBJK99002 | 999002 | TEST KENDRA 2, Dharwad, Karnataka |
| PMBJK99003 | 999003 | TEST KENDRA 3, Bengaluru, Karnataka |
| PMBJK99004 | 999004 | TEST KENDRA 4, New Delhi, Delhi |
| PMBJK99005 | 999005 | TEST KENDRA 5, Pune, Maharashtra |

Use your own phone number (or a made-up one such as 90000 00001) when registering. Real Kendra codes also work on the test site, but registering them there never affects the live site.

## End-to-end test: v1.1 Kendra registry

Base address: `https://samasalt-mitra-staging.samasalt-mitra-worker.workers.dev`. Test staff accounts (test site only): `test.admin`, `test.reviewer`, `test.registrar` (passwords shared separately).

1. **Kendra page (public):** open `/kendra`. Check the top: **Apply now**, **Print QR poster**, and the "Already registered? Print your QR poster" box. Scroll: why register, how it works, documents, terms (tap to open), questions. Try ಕನ್ನಡ / हिन्दी.
2. **Apply online:** tap **Apply now**. Enter `PMBJK99004`, tap **Find** (the official address appears), fill name, role, WhatsApp (e.g. 90000 00004), hours, tick the terms, tap **Submit and prepare email**. Step 2 shows the summary, the documents to attach, **Send email** (opens the email app with everything filled in; shown once the registration email address is set), **Copy email** and **Edit details**. Nothing is saved yet.
3. **Admin adds staff:** tap **Staff login**, sign in as `test.admin`. **Staff accounts** tab: the accounts are a numbered list; tap one for details, **Reset password**, **Remove account** (asks to confirm; a removed account can be restored). Under **Add an account**, choose Registrar or Reviewer and read the responsibilities shown.
4. **Registrar registers:** sign out, sign in as `test.registrar`: only **Registrations** and **New registration** are shown. Choose **By email** (or **In person**), fill the reference, code `PMBJK99004` + Find, numbers, name, hours, tick the four documents, **Register Kendra**. Note the reference (KR-…). A Registrar cannot approve.
5. **Poster before approval:** open `/poster?k=PMBJK99004`: it says the registration is not confirmed yet.
6. **Reviewer approves:** sign in as `test.reviewer`. **Waiting** tab: tap the line, check the official address against what was given, call the number, tick the three confirmations, write a note, **Approve**. Try **Modify details** (change the hours; a reason is required). Open **Review history**: who did what, when, and what changed.
7. **Patient view:** open `/`, type `Dolo 650` and PIN `999004`, tap Check: PMBJK99004 shows **Registered Kendra**, hours and **Call**.
8. **Poster and QR:** on the Kendra page, enter the code in "Print your QR poster" (or **Poster** in the staff console). Print or save as PDF; scan the QR with the phone: the app opens with "You are at Jan Aushadhi Kendra PMBJK99004" and PIN 999004.
9. **Number change goes back to review:** as reviewer, **Approved** tab → PMBJK99004 → **Modify details** → change the WhatsApp number: it goes back to **Waiting** and is not shown to patients until approved again.
10. **Withdraw:** **Approved** tab, write a reason, **Withdraw**. Step 7 no longer shows it as registered.
11. **Live site unchanged:** at the live address (no `?dev=1`), registered numbers are not shown (pilot mode).

## Maintenance (developer)

```bash
cd worker
npx wrangler deploy --env staging                    # deploy the current code to the test site
npx wrangler d1 migrations apply samasalt-mitra-staging --env staging --remote   # new tables
npx wrangler secret put ADMIN_TOKEN --env staging    # change the test admin token
# Reset all test registrations and test lookups:
npx wrangler d1 execute samasalt-mitra-staging --env staging --remote --command "DELETE FROM kendra_contacts; DELETE FROM lookups;"
```

Each new stage is deployed to the test site first, tested with the steps for that stage (added to this file), and only then deployed to the live site.
