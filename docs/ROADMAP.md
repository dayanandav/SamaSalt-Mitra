# SamaSalt-Mitra roadmap and stage status

*Refreshed 17 Nov 2026.*

**Purpose.** Help patients across India buy the same medicine for less: the same salt, strength, form and release, at a Jan Aushadhi Kendra, under PMBJP rules (pickup at the counter, valid prescription, no online sale or delivery).

**How stages move.** Each stage is built, tested (automated tests + a phone-size browser run), deployed to the **test site** first, then to the live site in a safe mode. The project owner reviews and tests it on a real phone; only then does the next stage start. A stage reaches patients only after its **PMBJP approval gate**. Nothing is committed to GitHub until the owner asks.

Full design: *SamaSalt-Mitra Design Document* (`docs/SamaSalt-Mitra Design Document.pdf`). Test site and test steps: [`TESTING.md`](TESTING.md).

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | before Nov 2026 | v1.0 Find: same-salt brands, Jan Aushadhi generic and MRP, nearest Kendra; en/kn/hi |
| 1.1.0 | 17 Nov 2026 | v1.1 Kendra registry: partner-style Kendra page (apply online, then email with documents), QR poster, staff console with Registrar / Reviewer / Admin roles and system-owner setup key, modify with audit history, Registered Kendra for patients (pilot mode on live) |
| 1.1.1 | 17 Nov 2026 | Staff console on desktop: tables with side panel for registrations and staff accounts, two-column forms; phones unchanged |

## Overview

| Stage | Version | What it adds | Status | PMBJP gate |
|---|---|---|---|---|
| 0 | v1.0 Find | Photo or name → same-salt brands, Jan Aushadhi generic and MRP, nearest Kendra (en/kn/hi) | **Done**, live | Send the design document to PMBI |
| 1 | v1.1 Kendra registry | Kendras apply; staff register, review and approve; QR poster; "Registered Kendra" for patients | **Done**: reviewed and accepted by the owner 17 Nov 2026 (live in pilot mode) | PMBI agrees to QR posters and contact registration |
| 1+ | v1.1.x Staff console on desktop | Wide table layout for staff on laptops (phones unchanged) | **Done**: approved by the owner 17 Nov 2026, live | none |
| 2 | v1.2 Order requests | Patient sends a medicine list with pack quantities to a registered Kendra by WhatsApp/SMS link; pickup only | Not started | PMBI confirms reserve-and-collect fits PMBJP rules |
| 3 | v1.3 Reach | More languages, weak-network mode, volunteer helpers | Not started | Inform PMBI |
| 4 | v2.0 WhatsApp bot | Check a medicine and send order requests inside WhatsApp | Not started | PMBI approves message templates; DPDP legal review |
| 5 | v2.1 Doctor network | PMBJP-recommended volunteer doctors, registered and verified like Kendras | Not started | PMBI provides or endorses the doctor list |
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

## Stage 2: v1.2 Order requests (next)

- From the result screen, the patient builds an **order list**: the Jan Aushadhi generic(s) with **pack quantity** (packs, not doses: no dosage advice).
- **Send to a Registered Kendra** by WhatsApp or SMS link (`wa.me` / `sms:`), prefilled message in the patient's language plus English; nothing stored on our server.
- The pharmacist replies from their own phone (available / when to collect). **Pickup only**: bring the prescription.
- NTI medicines can be listed only as the exact prescribed brand, never as a switch.
- Only Kendras approved in Stage 1, only when the registry is public.
- Gate: PMBI confirms reserve-and-collect fits PMBJP rules.

## Stage 3: v1.3 Reach

More Indian languages (after native review), weak-network mode (smaller pages, offline last result), volunteer helpers who assist patients at camps and Kendras.

## Stage 4: v2.0 WhatsApp bot

Check a medicine and send an order request inside WhatsApp (WhatsApp Business API, approved templates). Needs DPDP Act legal review: consent, what is kept, for how long.

## Stage 5: v2.1 Doctor network

Volunteer doctors **recommended or endorsed by PMBJP** register (registration number verified with the medical council); same registrar → reviewer → admin process as Kendras; doctors can be removed at any time.

## Stage 6: v2.2 Request doctor review

A patient asks an approved doctor to review switching a prescribed brand to its Jan Aushadhi generic (same salt, strength, form, release). Only approved doctors can approve a switch; NTI medicines are excluded; the doctor's note follows the Telemedicine Practice Guidelines; patient data is minimal and consented (DPDP).

## Stage 7: v3.0 One journey

Scan → doctor-reviewed switch → order request to a Registered Kendra → pickup with the prescription and the review note, as one guided flow. Gate: PMBI agrees how pharmacists treat a reviewed request.
