# SamaSalt-Mitra agent — project notes for AI assistants (AgentFoundry SMART-Code, Claude Code)

Mobile-first web app + Cloudflare Worker agent that tells Indian patients which brands have
EXACTLY the same salt + strength + form as the medicine they photographed, the Jan Aushadhi
(PMBJP) generic and its MRP, and the nearest Jan Aushadhi Kendra. English, Kannada, Hindi.

- `worker/src/normalize.js` — canonical composition key (port of SameSalt's Python pipeline; must stay byte-identical, see parity test)
- `worker/src/tools.js` — agent tools over D1: identify_medicine, find_same_salt, jan_aushadhi_match, nearest_kendra
- `worker/src/vision.js` — read_strip (Workers AI vision) and understand_text
- `worker/src/agent.js` — fixed tool plan + trace; `worker/src/index.js` — API + impact log
- `public/rules.js` — what the page may show (pharmacist list, switch question, Listen); tested in `test/rules.test.mjs`
- `public/strings.js` — ALL user-facing text (en/kn/hi) and the templated answer. Never let a model write prices or safety text.
- `public/app.js`, `public/impact.html`, `public/volunteer.html` — the web app
- Developer mode: `/?dev=1` (off: `/?dev=0`) shows the impact/volunteer/GitHub/data-import links and flags lookups as test traffic. Hidden for patients.
- `public/dev.html` + `dev.js` — developer data import: PMBI product MRP list CSV → preview diff → apply. `public/pmbi.js` (shared browser + Worker, a port of `data/build_ja.py`'s product parser; must give the same keys) parses in the browser; the Worker's `/api/admin/*` only validates and writes, guarded by the `ADMIN_TOKEN` secret.
- `data/` — build D1 seed SQL from SameSalt's DB and the official PMBJP lists
- Brand medicines are static files, not D1 rows: `node data/build_meds.mjs --db ../samesalt/assets/samesalt.db` writes `public/meds/` (gitignored, ~10.5k files, uploaded by `wrangler deploy`). `worker/src/medstore.js` reads them (D1 `medicines` table is the fallback, used by tests); `test/medstore.test.mjs` proves both give identical results. Reason: free D1 allows 100k rows written/day; this list needs ~740k.
- `test/` — `node --import ./test/register-md.mjs --test test/normalize.test.mjs test/tools.test.mjs test/pmbi.test.mjs test/medstore.test.mjs test/rules.test.mjs`; `python test/test_build_ja.py`
- `evals/` — `node evals/run_evals.mjs` (writes AF run JSONL to `.codenow/runs/`)

Rules: same salt + same strength + same form + same release only. Never give dosage advice. Narrow-
therapeutic-index salts never get a "switch" suggestion. Impact log stores no personal data.
