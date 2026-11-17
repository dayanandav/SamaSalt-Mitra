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
4. **Registrar registers:** sign out, sign in as `test.registrar`: only **Kendras**, **New Kendra** and **Volunteers** are shown. Choose **By email** (or **In person**), fill the reference, code `PMBJK99004` + Find, numbers, name, hours, tick the four documents, **Register Kendra**. Note the reference (KR-…). A Registrar cannot approve.
5. **Poster before approval:** open `/poster?k=PMBJK99004`: it says the registration is not confirmed yet.
6. **Reviewer approves:** sign in as `test.reviewer`. **Waiting** tab: tap the line, check the official address against what was given, call the number, tick the three confirmations, write a note, **Approve**. Try **Modify details** (change the hours; a reason is required). Open **Review history**: who did what, when, and what changed.
7. **Patient view:** open `/`, type `Dolo 650` and PIN `999004`, tap Check: PMBJK99004 shows **Registered Kendra**, hours and **Call**.
8. **Poster and QR:** on the Kendra page, enter the code in "Print your QR poster" (or **Poster** in the staff console). Print or save as PDF; scan the QR with the phone: the app opens with "You are at Jan Aushadhi Kendra PMBJK99004" and PIN 999004.
9. **Number change goes back to review:** as reviewer, **Approved** tab → PMBJK99004 → **Modify details** → change the WhatsApp number: it goes back to **Waiting** and is not shown to patients until approved again.
10. **Withdraw:** **Approved** tab, write a reason, **Withdraw**. Step 7 no longer shows it as registered.
11. **Live site unchanged:** at the live address (no `?dev=1`), registered numbers are not shown (pilot mode).

## End-to-end test: v1.2 Order requests

Base address: the test site (order requests are on for everyone there; on the live site only with `?dev=1`).

1. Open `/`, type `Thyronorm 50`, PIN `999001`, **Check**. In the Kendra card, PMBJK99001 shows **Registered Kendra** but **no** "Order for pickup" (never-switch medicine only in the list).
2. **Check another medicine**: `Dolo 650`, same PIN. PMBJK99001 now shows **Order for pickup**.
3. Tap it. The order sheet shows Paracetamol Tablets IP 650 mg with PMBJP code, pack size and MRP; "Thyronorm …: same brand only, not included"; the estimated total; the pickup note.
4. Tap **+** twice: 3 packs, total updates. Tap **Send on WhatsApp**: WhatsApp opens to the Kendra's number with the message ready. Do not send to a real Kendra; on the test Kendras the number is your own.
5. Close, tap **Show 2 medicines to the pharmacist** → **Order these from a Kendra**: the same sheet, still 3 packs.
6. Switch to ಕನ್ನಡ / हिन्दी and open the order again: the sheet and the message are in that language, with an English part for the pharmacist.
7. Live site, plain address: the **Order for pickup** button does not appear (pilot).

## End-to-end test: v1.3 weak-network mode

Test site, Android Chrome.

1. Open `/`, check `Dolo 650`. Go back to the home screen: **Show the last answer again** is there.
2. Turn on airplane mode. Pull down to reload: the app still opens, with the yellow **No internet** notice; **Show to the pharmacist** and **Show the last answer again** still work.
3. Type `Paracetamol 500` and **Check**: "No internet right now..." with **Try again**. Keep the page open and turn airplane mode off: the answer appears by itself.
4. Airplane mode on, on an answer: change the language. The answer stays and a note says it changes when the internet is back.
5. Settings → Data Saver (or a 2G network): photos still read correctly (sent smaller).
6. After a new deploy, open the app with internet once: the new version is used (no old screens).

## End-to-end test: v1.3 registered volunteers

Test site. Staff sign-ins as in the v1.1 test (`test.registrar`, `test.reviewer`).

1. Open `/volunteer` → **Become a registered volunteer**. Read the terms; fill name, mobile, district; **Prepare my request** without ticking the terms: it asks you to agree. Tick, prepare: the request text appears with **Send email** (only when `REGISTRATION_EMAIL` is set; otherwise **Copy the request**). Nothing is saved.
2. `/kendra` → **Staff login** as `test.registrar` → **Volunteers** → **Register a volunteer**. Choose how the request came, fill the details, choose the **ID seen** (type only), tick both boxes, **Register volunteer**. Note the code (SV-…). A Registrar sees no Approve button.
3. Register the same mobile again: "already registered".
4. Sign out, sign in as `test.reviewer` → **Volunteers** → the waiting volunteer → tick the three confirmations, write a note, **Approve**.
5. **Approved** → the volunteer → **Send link on WhatsApp**: WhatsApp opens to the volunteer's number with the welcome message and the link `/v/SV-…`.
6. Open the link on a phone: the green banner says volunteer mode is on, with the code. Check `Dolo 650`. Back in the console the volunteer shows **Helped 1**.
7. Open `/v/SV-ZZZZZ`: the banner says the link is not active yet.
8. **Modify details** → change the mobile with a reason: the volunteer goes back to Waiting (call the new number). **Remove volunteer** with a reason: the link stops counting. Every step is in the History.
9. `/impact`: "registered volunteers who helped" counts volunteers, never patients.

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
