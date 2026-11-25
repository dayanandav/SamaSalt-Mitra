# SamaSalt-Mitra roadmap and stage status

*Refreshed 23 Nov 2026.*

**Purpose.** Help patients across India buy the same medicine for less: the same salt, strength, form and release, at a Jan Aushadhi Kendra, under PMBJP rules (pickup at the counter, valid prescription, no online sale or delivery).

**How stages move.** Each stage is built, tested (automated tests + a phone-size browser run), deployed to the **test site** first, then to the live site in a safe mode. The project owner reviews and tests it on a real phone; only then does the next stage start. A stage reaches patients only after its **PMBJP approval gate**. Nothing is committed to GitHub until the owner asks.

Full design: *SamaSalt-Mitra Design Document* (`docs/SamaSalt-Mitra Design Document.pdf`). Test site and test steps: [`TESTING.md`](TESTING.md).

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | before Nov 2026 | v1.0 Find: same-salt brands, Jan Aushadhi generic and MRP, nearest Kendra; en/kn/hi |
| 1.1.0 | 17 Nov 2026 | v1.1 Kendra registry: partner-style Kendra page (apply online, then email with documents), QR poster, staff console with Registrar / Reviewer / Admin roles and system-owner setup key, modify with audit history, Registered Kendra for patients (pilot mode on live) |
| 1.1.1 | 17 Nov 2026 | Staff console on desktop: tables with side panel for registrations and staff accounts, two-column forms; phones unchanged |
| 1.2.0 | 17 Nov 2026 | v1.2 Order requests: packs per medicine, "Order for pickup" at Registered Kendras, WhatsApp/SMS message from the patient's phone (nothing stored), NTI and no-equivalent medicines left out; `ORDER_REQUESTS` pilot on live. Owner approved. Remove button in the medicine list made a soft light red |
| 1.3.0 | 17 Nov 2026 | v1.3 Reach: registered volunteers (Registrar registers, Reviewer approves, personal link `/v/SV-…`, help counted by volunteer code only); weak-network mode: the app opens without internet (service worker), offline notice, a check waits and runs by itself when the internet is back, last answer kept for the visit, smaller photos on 2G/3G or Save-Data |
| 2.0.0 | 17 Nov 2026 | v2.0 WhatsApp bot (test site): Meta Cloud API webhook, typed name / photo (confirm first) / PIN / language / DELETE, templated answers, short order link `/o/…`, chat simulator `/wa-sim`; number never stored (HMAC chat key, 24-hour memory); `WHATSAPP_BOT` off on live. Registered volunteers parked on live |
| 2.0.1 | 18 Nov 2026 | Chat in the app, the way other apps do it: floating **Chat** button (home and answers) → the bot's conversation inside the app (`/api/chat`, `APP_CHAT`: off on live, on on the test site; counted as mode `chat`), suggestion chips (Scan strip, Nearest Kendra, Language, Clear chat), message times, conversation kept for the visit; **Continue on WhatsApp** in the chat header once `WA_BOT_NUMBER` is set and the bot is on. Shared chat box `public/chat.js`. Clear chat / DELETE also forget the app's saved PIN. **Approved by the owner 19 Nov 2026** (test site) |
| 2.0.2 | 19 Nov 2026 | Hardening (test site): abuse protection (per-address limits on checks and staff sign-in, daily photo cap), Privacy and disclaimer page (en/kn/hi, linked from every page), own-domain switch ready (`CANONICAL_HOST`, docs/DOMAIN.md; **parked by the owner 19 Nov 2026, open enhancement**). |
| 2.0.3 | 19 Nov 2026 | NPPA ceiling prices (owner chose option A): developer import of the NPPA list (CSV) on the same composition keys, "Government maximum price (NPPA): ₹X per tablet + GST" under the answer and in the chat/bot (never for never-switch medicines). Brand prices stay as dated; no "overpriced" flags on stale MRPs. Test site: table ready, no list loaded yet |
| 2.0.4 | 19 Nov 2026 | Patient features (test site): share the answer, "Add to home screen" prompt, scan a prescription (names only, each checked when tapped), Kendras by distance (India Post PIN code centres; "Use my location"; ≈ km). Privacy page updated. Voice input and "Not in stock here?" reports were built, then removed by the owner (19 Nov 2026) |
| 2.0.5 | 19 Nov 2026 | Operations and polish: tests on GitHub for every push, live site check every 3 hours (GitHub emails on failure; warns at 80% of the daily photo cap), weekly backup script + Time Travel restore (docs/OPERATIONS.md), monthly impact report (CSV / PDF) for PMBI, larger text button, Kendra opening hours in the chat and on the QR banner. Evals on the test site: 22/23 (the heavy-blur photo now asks for a retake instead of a match) |
| 2.0.6 | 22 Nov 2026 | Search and matching fixes (live): typed Jan Aushadhi product names find their PMBJP code; never-switch medicines show the code to the pharmacist with "do not change without the doctor's approval" (no MRP, no order); "not available in this strength and form"; "Did you mean…?" suggestions and not-found help (photograph or type the salts, add the name to the pharmacist list); syrups read as liquids, strengths per 5 ml; "PR"/"DSR" read as SR (3,370 brands regrouped; SameSalt pipeline too); owner-approved Jan Aushadhi spelling list `public/ja-synonyms.js` (1,386 → 1,517 Jan Aushadhi products matched). Test lock: every test change approved by the owner |
| 2.0.8 | 23 Nov 2026 | Patient features (live): "My monthly medicines" (keep the pharmacist list on the phone, packs, saving a month / a year from our data, never-switch medicines never counted), photo tip under Take a photo ("Each tablet contains…" on the back; typing first after two unread photos), typed salt + strength → choices with salts (Jan Aushadhi first, also the 397 products with no brand; every form and release, never another strength). Search set on live: 67/67, 0 wrong |
| 2.0.9 | 23 Nov 2026 | Trust and demand (live): "Is the quality the same?" under the Jan Aushadhi card (fixed text, never for never-switch medicines), "Show this to your doctor" note on the pharmacist list (salt + strength + form in English for the doctor, print or share, no prices, no dosage), demand by area on /impact for Kendras and PMBI (counts per PIN area, at least 3 checks; hidden the same day, see 2.0.10) |
| 2.0.10 | 23 Nov 2026 | Fixes: demand by area hidden on live (`DEMAND_BY_AREA = "off"`): it counted checks, so one person could be listed although the page said not; it now needs 3 different phones and stays off until the owner turns it on. A composition without a clear strength for every salt is never answered ("Amoxicillin 500 Clavulanic acid 125" was, wrongly). Search test set grown from 67 to 363 cases |
| 2.0.11 | 24 Nov 2026 | A salt and strength typed with no form is never answered by a brand named like the salt ("Tramadol 50 mg" chose the capsule); every form is offered. Demand by area (P5) removed. 10 search cases now expect a choice (no form or release was typed) |
| 2.0.12 | 24 Nov 2026 | Matching fixes found by new search cases: 2.0.11 still answered "Orlistat 120 mg" and "Ramipril 1.25 mg" in one form; 10 of 1,914 official Jan Aushadhi names were matched to a brand instead (now 0); a Jan Aushadhi match ignored the form typed ("Paracetamol Capsules 650mg" gave the tablet; now offered, never answered); a typed salt was answered by a brand with other salts ("Doxepin 10 mg"; now asked). Search set 363 to 394 cases |
| 2.0.13 | 24 Nov 2026 | Audit of all 241,990 brand names, each typed up to five ways: a changed strength was answered for 2,383 names (gm, IU and numbers with letters; now 0) and another form for 236 (now 12, names with the form written twice or no form at all); more exact names answered. Prescription photos: the written form counts, and an unclear form or salt is "choose". A salt with no form is asked when another form is a Jan Aushadhi product too (30 salt + strength pairs, e.g. "Tranexamic acid 500"); "OF Derm Cream" is no longer answered as "Derm Cream". Search set 408 cases. The Jan Aushadhi list is kept in memory (it was scanned on every check; the search runs used up the free daily D1 reads and live checks stopped on 24 Nov 2026), and the live monitor now makes a real check |
| 2.0.14 | 25 Nov 2026 | Few database reads (the Jan Aushadhi list as one saved row, then memory; checks go on when D1 refuses; the search set runs on this computer). Safety: the brand list keeps at most two salts. A brand marked incomplete (6,189) is never answered; a typed two-salt brand asks "Does your strip list exactly these two salts?" first; other brands are no longer listed for two-salt medicines; a strip with three or more salts decides by its salts. "C Tax" and other one-letter names no longer fail |
| 2.0.15 | 25 Nov 2026 | Fewer database rows (C6): today's photo count through a small index, the impact figures as one row made again each hour, the nearest Kendras of a PIN as files deployed with the app (410 PINs near big cities could miss the nearest Kendra: fixed), one row less written per check |
| 2.0.16 | 25 Nov 2026 | Chat and bot: "No" to "exactly these two salts?" says to photograph the back or ask the pharmacist, as in the app (it said to type the name). Volunteer mode lasts for the visit only, and only while volunteers are on (it stayed on in the browser) |
| 2.0.17 | 25 Nov 2026 | Found more: the 14 searches that were missed or only asked (search set 408 of 408, 0 wrong): Kannada/Hindi names through a small sounds-like index (253 files read per search at worst, now 38), V/G in names are not units, flavours and DT, several salts typed, salt + form; 3 false PINs removed |

## Overview

| Stage | Version | What it adds | Status | PMBJP gate |
|---|---|---|---|---|
| 0 | v1.0 Find | Photo or name → same-salt brands, Jan Aushadhi generic and MRP, nearest Kendra (en/kn/hi) | **Done**, live | Send the design document to PMBI |
| 1 | v1.1 Kendra registry | Kendras apply; staff register, review and approve; QR poster; "Registered Kendra" for patients | **Done**: reviewed and accepted by the owner 17 Nov 2026 (live in pilot mode) | PMBI agrees to QR posters and contact registration |
| 1+ | v1.1.x Staff console on desktop | Wide table layout for staff on laptops (phones unchanged) | **Done**: approved by the owner 17 Nov 2026, live | none |
| 2 | v1.2 Order requests | Patient sends a medicine list with pack quantities to a registered Kendra by WhatsApp/SMS link; pickup only | **Done (approved 17 Nov 2026): public on the test site, pilot on live until PMBI confirms** | PMBI confirms reserve-and-collect fits PMBJP rules |
| 3 | v1.3 Reach | More languages, weak-network mode, volunteer helpers | **Done (approved 17 Nov 2026), live**: weak-network mode live for everyone. Registered volunteers **parked** (`VOLUNTEER_REGISTRY = "off"` on live, on the test site only). More languages: later (owner) | Inform PMBI |
| 4 | v2.0 WhatsApp bot | Check a medicine and send order requests inside WhatsApp | **Built: on the test site (simulator), off on live. Waiting for owner review, then the Meta WhatsApp account** | PMBI approves message templates; DPDP legal review |
| S1 | v2.0.7 Search basics | Suggestions while typing, missing-medicines list (staff add brands), reviewed short forms ("PCM"), search quality numbers on the impact page | **Done 22 Nov 2026, live** (2.0.6–2.0.7) | none (inform PMBI of the missing-medicines list) |
| S2 | v2.0.8 Search for everyone | Kannada/Hindi names without the AI model, "sounds-like" matching, QR code on strips (Schedule H2) | **In development**: Kannada/Hindi names live 22 Nov 2026 | none |
| S3 | ongoing | Newer brand data (PMBI / NPPA feed), real-search test set with a zero-wrong-match rule | Ongoing; data requests drafted 22 Nov 2026 | PMBI / NPPA share data |
| 5 | v2.1 Doctor network | PMBJP-recommended volunteer doctors, registered and verified like Kendras | **Parked by the owner 19 Nov 2026 (future work)** | PMBI provides or endorses the doctor list |
| 6 | v2.2 Request doctor review | Patient asks an approved doctor to review a switch to the Jan Aushadhi generic | Not started | PMBI agrees; Telemedicine Practice Guidelines and DPDP review |
| 7 | v3.0 One journey | Scan → doctor-reviewed switch → order request → pickup, as one flow | Not started | PMBI agrees how pharmacists treat a reviewed request |

Rules that hold in every stage: same salt + strength + form + release only; never dosage advice; narrow-therapeutic-index (NTI) medicines never get a "switch" suggestion; no model writes prices or safety text; the impact log stores no personal data.

## Stage 0: v1.0 Find (done)

The current patient app: scan a strip or type a name, see every brand with exactly the same composition, the Jan Aushadhi generic and its MRP, savings, and the nearest Kendras by PIN. English, Kannada, Hindi; Listen; pharmacist list. Developer mode only with `?dev=1`.

## Stage 1: v1.1 Kendra registry (done)

**For Kendras: `/kendra`** (en/kn/hi), a partner-style page:
- Top: **Apply now** and **Print QR poster**; right below, "Already registered? Print your QR poster" with a code box.
- Why register, how it works (4 steps), documents needed (PMBI allotment letter, drug licence, pharmacist registration certificate, owner's signed consent), terms and conditions (fold-open), 5 questions.
- **Apply online, step 1 of 2:** Kendra code (checked against the official PMBI list), name, role, WhatsApp, SMS, hours, pharmacist details, accept the terms.
- **Step 2 of 2:** summary, documents to attach, **Send email** (opens the email app with the standard request filled in), Copy email, Edit details. The public page saves nothing; the email with documents is the application. Kendras that cannot email can apply in person.

**For staff: `/kendra` → Staff login** (one sign-in; the role decides what each person sees):

| Role | Can do |
|---|---|
| Registrar | Register a Kendra from its request (by email or in person), after checking the 4 documents |
| Reviewer | Call the Kendra; approve (3 confirmations + note), reject, withdraw; modify details |
| Admin | Everything above + add Reviewers and Registrars, reset passwords, remove accounts |
| System owner (setup key) | Everything + add Admins; only for setup or if every Admin is locked out |

- Maker-checker: a Registrar cannot approve, so every Kendra is checked by two people.
- Modify details: reason required; changing the number of an approved Kendra sends it back to Waiting to be called again.
- Registrations: search by Kendra code; numbered one-line list per status tab; tap for details, actions and full review history.
- Staff accounts: numbered list; tap for details, **Reset password**, **Remove account** (signs out at once; can be restored; history kept).
- Security: PBKDF2 passwords, 8-hour HttpOnly session, 5 wrong passwords lock for 15 minutes, CSRF guard, every action logged.

**For patients:** an approved Kendra shows **Registered Kendra**, hours and **Call** in the nearest-Kendra list; the QR (`/k/PMBJK…`) opens the app with "You are at Jan Aushadhi Kendra …". `/poster?k=…`: A4 poster, English + Kannada or Hindi.

**Safe mode:** `KENDRA_REGISTRY = "pilot"` on the live site shows numbers only to developer mode. Switch to `"public"` only after PMBI agrees. The test site runs `"public"`.

**Technical:** migrations `0002`–`0005` (applied to live and test databases); `worker/src/kendra.js`, `worker/src/admin.js`; tests `test/kendra.test.mjs` (12) and `test/admin.test.mjs` (9); full suite 96 tests passing.

**Still open from Stage 1** (do not block Stage 1+)
- [x] Owner: review and test on the test site (steps in `TESTING.md`).
- [ ] Owner: give the registration email address → set `REGISTRATION_EMAIL` on both sites (turns on **Send email**).
- [ ] Owner: set the live setup key: `npx wrangler secret put ADMIN_TOKEN`, then add the first Admin.
- [ ] Owner: confirm the claims "No fee" and "no commission".
- [ ] Native-speaker review of the Kannada and Hindi text (page and poster).
- [ ] PMBI: approve the poster wording, the document list and the terms; agree to public numbers → `KENDRA_REGISTRY = "public"`.
- [ ] Commit (when the owner asks).

## Stage 1+: staff console on desktop (done)

On screens wider than about 1000 px: full width; registrations and staff accounts as tables, with details opening in a side panel; two-column registration form. Phones stay as they are. About half a day. Optional: on the Kendra page, form and documents side by side on wide screens.

## Stage 2: v1.2 Order requests (done)

- From the result screen, the patient builds an **order list**: the Jan Aushadhi generic(s) with **pack quantity** (packs, not doses: no dosage advice).
- **Send to a Registered Kendra** by WhatsApp or SMS link (`wa.me` / `sms:`), prefilled message in the patient's language plus English; nothing stored on our server.
- The pharmacist replies from their own phone (available / when to collect). **Pickup only**: bring the prescription.
- NTI medicines can be listed only as the exact prescribed brand, never as a switch.
- Only Kendras approved in Stage 1, only when the registry is public.
- Gate: PMBI confirms reserve-and-collect fits PMBJP rules.

**What was built**
- Each medicine in the per-visit list keeps a **pack count** (1 to 10; packs to collect, never doses).
- A Registered Kendra in the answer shows **Order for pickup**; the pharmacist list has **Order these from a Kendra**.
- The order sheet: Kendra (choice if several), Jan Aushadhi items with PMBJP code, pack size, MRP per pack and **− / +** packs; estimated total at MRP (from the PMBI list, never from a model); medicines left out and why (NTI: same brand only; no Jan Aushadhi equivalent); pickup-only note.
- **Send on WhatsApp** (`wa.me`) and **Send SMS** open the patient's own app with the message ready (patient's language + English for the pharmacist). Nothing is stored on our server; the Kendra replies directly.
- Gate: `ORDER_REQUESTS` in `worker/wrangler.toml`: `pilot` on live (only developer mode sees the button), `public` on the test site. Switch live to `public` only after PMBI confirms.
- Code: `orderItems`, `orderQty`, `orderMessage`, `waLink`, `smsLink` in `public/rules.js`; order sheet in `public/app.js` and `public/index.html`; `markOrders` in `worker/src/index.js`. Tests: `test/orders.test.mjs` (7); full suite 103.

**Open points**: native-speaker review of the Kannada/Hindi order text; PMBI wording of the message; whether to count (anonymously) how many order messages are opened, for the impact page.

## Stage 3: v1.3 Reach (done; more languages later)

More Indian languages (after native review), weak-network mode (smaller pages, offline last result), volunteer helpers who assist patients at camps and Kendras.

**Part 1, weak-network mode (built, on the test site)**
- `public/sw.js`: the patient app's own files are kept on the phone; network first with a 4-second wait, then the saved copy. Never stored: `/api/*`, staff, developer and Kendra pages. `VERSION` equals `APP_VERSION`; a new version replaces the saved copy at once.
- No internet: a notice at the top; a check is not lost: it says so, offers **Try again**, and runs by itself when the internet is back. Very slow: says so after 25 s (names) / 45 s (photos), doubled on 2G.
- The last answer is kept for this visit (sessionStorage, no photo): **Show the last answer again** on the home screen. Opening the page again without internet keeps the medicine list and the last answer; with internet it starts empty, as before.
- Language change without internet keeps the answer on screen and says it changes when the internet is back.
- Photos are sent at 1024 px (quality 0.72) on 2G/3G or Save-Data, 1280 px otherwise.
- Ordering by SMS works without mobile data (v1.2 sheet).
- Code: `photoSendSize`, `askTimeoutMs`, `savableAnswer` in `public/rules.js`; `ask`, `renderNet`, `#lastBtn`, `#offlineBar` in `public/app.js` / `index.html`. Tests: `test/offline.test.mjs` (5); full suite 108.

**Part 2, more languages**: later. The owner will handle the choice of languages and the native-speaker review.

**Part 3, registered volunteers (built; parked by the owner on 17 Nov 2026 for a future enhancement)**: chosen by the owner over an anonymous camp mode. Switch: `VOLUNTEER_REGISTRY` in `worker/wrangler.toml`: `"off"` on live (the join section on /volunteer, the console's Volunteers tab and the `/api/admin/volunteer/*` API are hidden or closed; the tables from migration 0006 exist and stay empty), `"on"` on the test site. To resume: DPDP review, live `ADMIN_TOKEN` and staff accounts, `REGISTRATION_EMAIL`, Kannada/Hindi text, then set `"on"` and deploy. Plain volunteer mode (/volunteer guide, `?volunteer=1`) is not affected.
- Public `/volunteer` → **Become a registered volunteer**: benefits, how it works, six terms (no medical advice; never a switch for "same brand only"; no patient data; no money or selling; who sees their details, removal any time; the link is personal). The form prepares a request to send by email (`REGISTRATION_EMAIL`), as for Kendras: **nothing is saved from the public page**.
- Staff console → **Volunteers** tab (tabs renamed **Kendras**, **New Kendra**, **Volunteers**). Registrar: **Register a volunteer** from a request by phone, email or in person, with the **type of ID seen** (never its number) and the volunteer's agreement; one active registration per mobile. Reviewer: approve (called, ID seen, terms understood + note), reject, **Remove volunteer**, **Modify details** (a new mobile sends an approved volunteer back to Waiting), **Send link on WhatsApp**, **Copy link**. History of every action. Table + side panel on desktop, one line each on phones.
- Each approved volunteer gets a code `SV-XXXXX` and a personal link `/v/SV-XXXXX` → volunteer mode with the code (green banner; "link not active yet" if not approved). A check made through it records the volunteer's code in `lookups.volunteer` (only if approved): the console shows **Helped** per volunteer; `/impact` shows "registered volunteers who helped". No patient data is added.
- Data: migration `0006_volunteers.sql` (`volunteers`, `volunteer_reviews`, `lookups.volunteer`); applied to the test database only. Code: `worker/src/volunteers.js`, `validateVolunteer`/`volunteerCode`/`volunteerRequest`/`volunteerWelcome` in `public/rules.js`, `public/vol-admin.js` (console tab), `public/volunteer.js` (public form). `/v/*` added to `run_worker_first`. Tests: `test/volunteers.test.mjs` (7); full suite 115.
- Gate: volunteers' personal data (name, mobile) is staff-only, like Kendra contacts. **Before live**: apply migration 0006 to the live database; DPDP review of volunteer data (consent, retention, removal on request); native-speaker Kannada/Hindi text for the volunteer section (English only now).

## Stage 4: v2.0 WhatsApp bot (built, waiting for review)

Check a medicine and send an order request inside WhatsApp. Needs DPDP Act legal review: consent, what is kept, for how long. **DPDP review parked by the owner on 19 Nov 2026, to be revisited later** (before the WhatsApp bot or registered volunteers go public).

**Analysis**
- Channel: **Meta WhatsApp Cloud API** straight to the Worker (no paid middleman). The patient always writes first, so every reply is inside WhatsApp's 24-hour service window: free-form replies and reply buttons, **no pre-approved templates and no per-message charge** for these replies. Templates (and PMBI approval of them) are needed only if we ever message people first (for example reminders); v2.0 does not.
- What the bot does is exactly what the app does, from the same agent and the same templates: no model writes any price or safety line.
- Privacy by design: the WhatsApp number is never stored. A chat is keyed by HMAC(secret, number); it remembers only language, PIN and one medicine waiting for confirmation, for at most 24 hours; **DELETE** erases it. The impact log gets mode `whatsapp`, no device, no number.

**What was built**
- Conversation: **Hi** → welcome (what it does, no dose advice, DELETE) + language buttons; typed medicine name → full answer (templated text, Jan Aushadhi generic with PMBJP code, pack and MRP, up to 3 lower-priced same-salt brands, nearest Kendras if a PIN is known, data note); **photo** → "I read this from your photo: … Is this your medicine?" [Yes, check it] [No]: nothing is priced before Yes; **6-digit PIN** → saved, nearest Kendras (registered numbers where `KENDRA_REGISTRY` allows); **kannada / hindi / english** or the buttons; **DELETE**.
- Never-switch (NTI) medicines: the warning only; no brands, no generic, no order link.
- Order for pickup: at a Registered Kendra with `ORDER_REQUESTS = "public"`, a short link `/o/<Kendra>/<PMBJP code>` opens the patient's WhatsApp to the Kendra with the order message (1 pack; patient's language + English). Refused for NTI products, unapproved Kendras or pilot mode.
- Meta webhook `/api/wa/webhook`: verification (GET), signature check (`X-Hub-Signature-256`), answer 200 at once and reply in the background; duplicate deliveries answered once (`wa_seen`, 24 hours); photos downloaded from Meta into memory only.
- **Chat simulator** `/wa-sim` (team only, test traffic, linked in developer mode): the real bot logic, nothing sent to WhatsApp.
- Switch `WHATSAPP_BOT`: `"off"` on live, `"on"` on the test site. Migration `0007_whatsapp.sql` (`wa_chats`, `wa_seen`), applied to the test database only.
- Code: `worker/src/whatsapp.js` (webhook, conversation, Cloud API), `worker/src/watext.js` (reply text), `wa*` keys in `public/strings.js`, `/o/` and `/api/wa/*` in `worker/src/index.js`, `public/wa-sim.html` + `wa-sim.js`. Tests: `test/whatsapp.test.mjs` (9); full suite 124.

**To go live (owner)**
1. Meta Business account (business verification), a WhatsApp Business phone number not used in the WhatsApp app, a Meta app with the WhatsApp product.
2. Secrets on the live Worker: `WA_TOKEN` (permanent system-user token), `WA_PHONE_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `WA_HASH_KEY`. Webhook URL `https://<live site>/api/wa/webhook`, subscribe to `messages`.
3. DPDP review (parked 19 Nov 2026, revisit before go-live; the welcome message is the notice; DELETE and 24-hour expiry are the erasure); native-speaker check of the Kannada/Hindi bot text.
4. Apply migration 0007 on the live database, set `WHATSAPP_BOT = "on"`, deploy. Tell PMBI.

## Search track: finding the medicine (S1–S3)

Goal: fewer "not found", never a wrong match. One rule holds throughout: fuzzy matching only **suggests** names for the patient to tap; the answer still needs exactly the same salt, strength, form and release. Every step is measured (S1.4) and guarded by tests that no wrong match appears.

**Done in 2.0.6 (22 Nov 2026, live):** "Did you mean…?" after a not-found (typos, letter O for zero; never another strength or form), not-found help, Jan Aushadhi names typed in full, syrups and per-5 ml strengths, PR/DSR release, reviewed Jan Aushadhi spelling list. A check of all 1,914 Jan Aushadhi products against the brand list found the spelling gaps; about 250 have no brand in the 2022 list (Jan Aushadhi-only items, newer medicines).

**S1: v2.0.7 Search basics (in development)**
1. **Suggestions while typing**: brand names as the patient types ("Dol…" → Dolo 650, Dolo 500), from the existing name index; tapping one checks it.
2. **Missing-medicines list**: anonymous count of names searched but not found (name and day only, no person); staff add the brand with its salts from the strip, a Reviewer approves (same roles as Kendras).
3. **Short forms**: a small reviewed list ("PCM" → paracetamol, "Amox-clav", "Tab", "Syp"), reviewed like `public/ja-synonyms.js`; patients' spelling variants use the same reviewed lists.
4. **Search quality numbers** on the impact page: found, not found, found through a suggestion, by language and by way of searching (no personal data).

Status: 1 **live in 2.0.6** (22 Nov 2026). 4 **live** (22 Nov 2026): "Finding the medicine" card on `/impact` (+ CSV); each lookup records `via` = typed / suggest / didyoumean / rx (fixed words only, never text; migration `0011_search_via.sql`, which must be applied to the live database **before** that deploy). 3 **live** (22 Nov 2026): `public/short-forms.js` (PCM, CPM, HCQ, HCTZ, INH, ASA; tabs, caps, syp, susp, oint, drops), tried only when the typed name is not found.

**"Ask, don't guess"** (owner's decision 22 Nov 2026, live with 3): the short-forms check found that a typed name could match a different combination ("Atorva 10" → Atorva **E** with ezetimibe; "Calpol syp" → Calpol **T**, a tramadol tablet). Now a typed name is answered only when a brand's words are exactly the typed words (forms and units aside), the typed number is in its name or is its strength ("Atorva 10" = Atorva Tablet, 10 mg), and a typed form is its form. Otherwise, and when no strength is typed but several exist ("Atorva", "Thyronorm"), the patient chooses from up to 5 brands shown with their salts; a full listed name is always answered directly. Photos keep their composition check.

2 **live** (22 Nov 2026): typed names not found are counted in `missing_names` (real traffic only; only text that looks like a medicine name, no device or time); staff console tab **Missing medicines**: a Registrar adds the brand with every salt and strength from the strip ("Check how the app reads it" shows the composition, Jan Aushadhi product and same-salt brands), another person (Reviewer) approves after comparing with the strip, with a note; approved brands are found like any brand, with no price; remove / ignore; every action logged (`added_medicine_reviews`). Migration `0012_missing_medicines.sql` (apply to live before that deploy). Code: `worker/src/missing.js`, `public/missing-admin.js`.

**S2: v2.0.8 Search for everyone (planned)**
5. **Kannada and Hindi names without the AI model**: a fixed letter-by-letter conversion ("ಡೋಲೋ 650", "डोलो 650" → "dolo 650") plus "sounds-like" matching (Pantop / Pantap); faster, free and predictable.
6. **QR code on strips**: India's top 300 brands carry a QR code with brand, generic name, manufacturer and batch (Schedule H2, 2023). First check which brands carry it and what it holds; then read it as an exact lookup.
Status: 5 **live** (22 Nov 2026): `public/indic.js` turns Kannada/Devanagari letters and digits into English letters (Hindi drops the inherent "a" where it is not spoken: मेटफॉर्मिन → metformin); an exact fit is answered (ಡೋಲೋ 650 / डोलो 650 → Dolo 650); otherwise brands that sound alike (same consonants, or 1–2 letters apart; first letters spelled c/k/s, th/t, ph/f…) are offered as choices with their salts, keeping the typed number (टेल्मा 40 → Telma 40 first; एटोर्वा 10 → Atorva Tablet 10 mg first). The AI model is asked only when nothing sounds alike. Salt names typed in Kannada/Hindi (**live**, 23 Nov 2026): Jan Aushadhi products whose name starts with a word that sounds alike are offered first, under their full official name, with the typed strength being the named salt's (मेटफॉर्मिन 500 → Metformin Hydrochloride Tablets IP 500mg, code 145; tablets before injections). Next: 6.

Research for 6 (23 Nov 2026), from CDSCO's FAQ on G.S.R. 823(E) (21 Jul 2023): the code must carry the unique product identification code (each manufacturer's own scheme), proper and generic name, brand name, manufacturer name and address, batch, manufacturing and expiry dates, and manufacturing licence number. **No format is set** (plain text, a link to the company's site, or GS1 data are all allowed), **strength is not a required field**, it may be on the carton instead of the strip, and it is required only on the 300 Schedule H2 brands made from 1 Aug 2023 (news in Jun 2026 reports a wider rollout to vaccines, antimicrobials, cancer and narcotic drugs; to be confirmed in the gazette). So the code cannot be the exact lookup by itself: at best it gives the exact **brand name** (no misreading), which then goes through the normal "ask, don't guess" match. Links inside codes are never opened (unknown sites, privacy). **Next step (owner):** decode the QR code on 5–10 real strips/cartons of top brands with any QR scanner app and share the text, so the reader is built for real formats.

7. Voice search: **parked** (voice input was built and removed by the owner on 19 Nov 2026); revisit only if the owner asks.

**S3: ongoing**
8. **Newer brand data**: PMBI / NPPA data requests (drafted 22 Nov 2026). With every new list, rerun the Jan Aushadhi ↔ brand match check before it goes live.
9. **Real-search test set**: 200–300 anonymised real queries (typos, Kannada/Hindi, strip photos, syrups, SR brands) with their correct answers, run on every change (`evals/`): more correct answers each version, and **zero wrong matches** (another strength, form or release) as a hard rule.

Photos (23 Nov 2026): on 22 Nov, 5 of 7 real strip photos on live could not be read. Each unreadable lookup now records the agent's reason as a fixed word (`read_reason`: salts not clear / brand and salts disagree / too unsure; migration `0013_read_reason.sql`; live 23 Nov 2026), shown on `/impact` as "Why photos and scans were not read". **Front of the strip** (owner's decision 23 Nov 2026, **live** 23 Nov 2026): when the brand was read but not the salts, the brand read is matched like a typed name and offered as choices with their salts ("We read “DOLO 650” from your photo, but not the salts. Is it one of these?"); never an answer, nothing priced until a tap (counted as `via = photochoice`); not for a brand whose salts disagree. Next: improve the photo guidance or reading for the most common remaining reason once real data shows it.

Status of 9 (23 Nov 2026): first set of 67 searches built (`evals/search_cases.src.json`: exact names, no strength, combination letters, typos, short forms, Jan Aushadhi names, SR/PR, liquids and strip text, Kannada/Hindi brands and salts, never-switch, not-in-list and junk). Each expected composition is taken from the data (`node evals/build_search_cases.mjs --db ../samesalt/assets/samesalt.db`), never written by hand. `node evals/run_search_evals.mjs` (test site; `SAMASALT_MITRA_URL=…` for live) scores right / offered / missed / **WRONG** and exits with an error on any wrong match; results in `evals/SEARCH_RESULTS.md`. Test site 23 Nov 2026: **67/67, 0 wrong** (41 answered, 26 offered among choices or "Did you mean"). It found one gap, now fixed: a typo whose start is also a real brand ("Dolp 500") now gets "Did you mean: Dolo 500" next to the choices. To grow: add real searches from the missing-medicines list and the impact numbers.

**Next plan (23 Nov 2026).** Agreed with the owner, in this order.

*I can build now (each on the test site first; new behaviour comes with new tests for the owner to approve):*
- **S3.10 Photo tips** (**live 23 Nov 2026 (2.0.8)**: the tip now sits right under Take a photo and stays on small phones; camera title and "salts not clear" say “Each tablet contains…” on the back; after a second photo not read in a visit, Type the name comes first with "typing is often quicker". Live before: 17 of 51 photos not read): before the camera opens, a short tip in en/kn/hi: "Photograph the back of the strip, where the salts are printed, flat and in good light". After an unreadable photo, the tip matches the recorded reason (salts not clear → turn the strip over; too unsure → hold it steady, more light). The impact page's "Why photos and scans were not read" card shows whether it helps.
- **S3.9 Grow the search test set** (363 cases 23 Nov 2026; first run on the test site 337 pass, 1 wrong match, fixed in 2.0.10; 18 "asked instead of answered": the owner decided on 24 Nov 2026 that 10 expect a choice and 8 stay as failures to improve) from 67 to about 250 searches: more typos, syrups, release types, Kannada/Hindi spellings and never-switch medicines. Expected compositions still come from the data; the rule stays **0 wrong matches**. Only search cases are added, no test files.
- **S3.11 Jan Aushadhi medicines with no brand in the 2022 list** (measured 23 Nov 2026: **397** products; typed salts such as "Metoprolol 50 mg" also found nothing even when brands exist. **Live 23 Nov 2026 (2.0.8)**: `saltChoices` in tools.js, step `salt_choices` in agent.js: a typed salt + strength that no name fits gets every real medicine with that salt and strength as choices (Jan Aushadhi first, every form and release, a typed form or release narrows it, never another strength, never answered by itself; each choice's name is checked to answer exactly the composition shown). Sample of 30: not found 20 → 1. Also: two Jan Aushadhi names that differ only by Tablets/capsules are told apart by the typed form). Was: when the salt is searched (typed or read from a photo), show the Jan Aushadhi product with its PMBJP code and MRP, even though no brand matches, instead of "not found". Same salt, strength, form and release; never-switch rules unchanged.

- **P1 My monthly medicines** (draft agreed 23 Nov 2026, lighter version): the answer screen is unchanged. One switch on the existing pharmacist list, "Keep this list for next month", keeps it on the phone only (off = cleared when the app closes, as today; turning it off deletes it). Once on, the list shows the saving for the packs already in it ("about ₹X a month · ₹Y a year", per tablet, prices only from our data, brand MRPs dated); never-switch medicines keep their warning and are never counted or ordered. The home screen shows "My monthly medicines (n)" only on a phone where a list was kept. No dosage question. Impact page counts lists kept and reopened (numbers only); removed if little used after 1–2 months. Calendar reminder and a parent's list only later, if used. **Live 23 Nov 2026 (2.0.8)**: switch `#keepSwitch` in the pharmacist list, kept list in the phone's storage (`ss_keep_list`), packs per medicine once kept (1–10, like an order), saving from `monthlySaving` in rules.js, home button "My monthly medicines (n)"; while kept, medicines checked are added to the kept list (Remove takes one off; an empty kept list is deleted); `/api/monthly` counts kept / opened per month in `meta` (no list, no device, never test traffic), shown on /impact as "My monthly medicines". Tests: `test/monthly.test.mjs`.

*More patient benefits (added 23 Nov 2026 at the owner's request; judged like the monthly list: real help, little new on screen):*
- **P2 "Is Jan Aushadhi quality the same?"** (**live 23 Nov 2026 (2.0.9), wording as drafted** `jaTrust` in strings.js; `trustHtml` in app.js, never for a never-switch medicine) Doubt about quality is the main reason people don't switch. A small "Why trust it?" link under the Jan Aushadhi card opens fixed en/kn/hi text that the owner writes or approves (e.g. WHO-GMP suppliers, every batch tested in NABL labs, same salt and strength), opening on tap like the never-switch "Why?". Never written by a model. Effort: small; **needs the owner's wording**.
- **P3 "Show this to your doctor"** (**live 23 Nov 2026 (2.0.9), wording as drafted** `doctor*` in strings.js; `doctorNote` in rules.js, dialog `#doctor`, Print and Share; the note is in English for the doctor, never-switch medicines left out): one button on the pharmacist list (next to the monthly switch) giving a printable / on-screen note that asks the doctor to write the salt names, listing the salts and strengths from the list. No dosage, no advice; NMC rules already ask for generic names. Effort: small; **needs the owner's wording**. Best built together with P2.
- **P4 Medicine safety alerts**: a red notice, shown only when it applies, when a combination is on the government's banned fixed-dose combination (FDC) list, or a brand is on CDSCO's monthly "not of standard quality" list. Fixed text, data only from the official lists, imported by the system owner like the NPPA list (preview → apply, list date shown). Effort: medium (a data import); the matching rule (by composition key for FDCs, by brand + batch for CDSCO) is agreed with the owner first.
- **P5 Demand by area** (**discarded by the owner, 24 Nov 2026**; built in 2.0.9, hidden in 2.0.10, removed in 2.0.11) for Kendras and PMBI: "most-searched Jan Aushadhi medicines in PIN 5600xx", counts only from the impact log (PIN area level, no personal data, test traffic excluded), as a card and CSV on /impact. Nothing new for patients. Effort: small.

*Later or not now:* other low-cost places (AMRIT pharmacies, state free-medicine schemes) once a reliable official list exists; Kendra counter mode once Kendras are registered on live; more languages (Tamil, Telugu, Marathi, Bengali) when native reviewers are available; low-literacy mode (Listen and larger text cover part of it).

*Next phase (owner's decision 24 Nov 2026): lower photo cost, so photos can grow with use. Photos are nearly all of the running cost; typed checks cost almost nothing.*
- **C1 Measure** real photos first: tokens and Neurons per photo and prescription, success rate by photo size. Then set `DAILY_PHOTO_LIMIT` to what the daily AI allowance really covers (the estimate is about 140 photos a day free, while the cap is 1,500).
- **C2 Typing first**: the name box is the first action on the home screen, the photo button second; suggestions while typing stay. Photos stay one tap away (people who cannot type or read English need them).
- **C3 Smaller photos**: the smallest size at which the salts are still read correctly, from C1; the crop is sent, not the whole picture. Never below the size where read accuracy drops.
- **C4 A cheaper model**: compare vision models on the same set of real strips (Kannada/Hindi packs too). Switch only if it reads the salts at least as well and gives 0 wrong matches; the read check (`READ_PASS_MARK`) and the confirm screen stay.
- **C5 Photo limit per person**: photos and prescriptions together per device per day (5-10; the number and "per day or one-time trial" wait for the owner), then "type the name" (typing is never limited by this). Counted on the server by the random device code the app already has (no new personal data; counts deleted after 2 days). Per address only a short limit (a few photos a minute, Cloudflare's counter, never stored): Indian mobile networks put many people behind one address, so a daily limit per address would block strangers. Approved volunteers and staff get a higher limit. The daily cap for everyone stays.
- **C6 Caching, so the database is used only when needed** (2.0.14 did the first part): (1) phone: the app, name suggestions and this visit's answers; the same medicine checked again in a visit sends nothing new; a repeated upload of the same photo is not read by the AI twice. (2) Files deployed with the app, no database reads: brands, the Jan Aushadhi copy, and next the Kendra list by PIN area. (3) Worker memory: Jan Aushadhi list, staff-added brands, settings (10 minutes). (4) Database, only for: one log record per real check, staff work, registrations, counters. Reports (/impact) read a summary made once an hour; the photo count is one row. Test runs are never logged.
- **How this phase is built (owner, 24 Nov 2026):** one item at a time, by priority and by what real use shows; the order below is a starting point and is reviewed before each item. For C5 the number and "per day or one-time" are open (suggested: 10 per device per day).
- Order C1, C5, C6, C3, C2, C4. Each is tested on real strips before live. Needs from the owner: photos of 20-30 strips, front and back, with no patient details.

*Very low priority (draft, owner's request 24 Nov 2026):*
- **O1 Test site on the owner's Oracle Cloud server** (draft only, nothing built): the same Worker code behind a small Node server (the tests already run the database part on SQLite), brand files and pages from disk, database as a file, per-address limits replaced, its own HTTPS address with the camera allowed (the existing portal's settings switch it off). Photos stay on Cloudflare Workers AI through an API token the owner creates. The owner runs the install; no passwords or keys are shared. Check first: the server's type and memory, Oracle's current free limits and idle-instance rules. Gain: tests never use live's Cloudflare quota; later a backup or a second home for live. Since 2.0.14 the search set already runs on the developer's computer, so this is not urgent.

*Waiting for the owner:*
- **WhatsApp bot (stage 4)**: review it in the simulator (`/wa-sim`), then set up the Meta WhatsApp business account; then it is connected and switched on for live.
- **S2.6 QR code on strips**: the decoded text from the QR codes on 5–10 real strips or cartons; then the reader is built for those formats.
- **S3.8 Newer brand data**: send the drafted PMBI and NPPA data requests; each new list is checked against the Jan Aushadhi match before it goes live.
- **Staff accounts on live**: Admin, Registrar and Reviewer, so Kendra registration and the missing-medicines list can be used.
- **Kannada and Hindi wording**: a native-speaker check of the newer texts.

## Stage 5: v2.1 Doctor network

**Parked by the owner on 19 Nov 2026: future work, not now.** Stages 6 and 7 build on it, so they wait too.

Volunteer doctors **recommended or endorsed by PMBJP** register (registration number verified with the medical council); same registrar → reviewer → admin process as Kendras; doctors can be removed at any time.

## Stage 6: v2.2 Request doctor review

A patient asks an approved doctor to review switching a prescribed brand to its Jan Aushadhi generic (same salt, strength, form, release). Only approved doctors can approve a switch; NTI medicines are excluded; the doctor's note follows the Telemedicine Practice Guidelines; patient data is minimal and consented (DPDP).

## Stage 7: v3.0 One journey

Scan → doctor-reviewed switch → order request to a Registered Kendra → pickup with the prescription and the review note, as one guided flow. Gate: PMBI agrees how pharmacists treat a reviewed request.
