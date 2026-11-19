# Running SamaSalt-Mitra (owner)

How the live service is watched, backed up and kept inside the free plan.

## 1. Is it working? (automatic)

- **Live site check** (`.github/workflows/monitor.yml`) runs every 3 hours on GitHub: the home page
  answers, `/api/health` is ok, the Jan Aushadhi and Kendra lists are loaded, and today's photo reads
  are under 80% of `DAILY_PHOTO_LIMIT`. When a check fails, GitHub emails the repository owner.
  - Make sure GitHub emails you: GitHub → Settings → Notifications → **Actions** → tick
    "Email" and "Only notify for failed workflows".
  - Run it by hand: repository → **Actions** → **Live site check** → **Run workflow**.
  - GitHub pauses scheduled checks after 60 days with no commit; it shows a button to turn them back on.
- **Tests** (`.github/workflows/test.yml`) run every test on each push and pull request.
- Errors in the Worker: Cloudflare dashboard → Workers → `samasalt-mitra` → **Logs** (observability
  is on in `wrangler.toml`).

## 2. Backups

| What | How | Keeps |
|---|---|---|
| Cloudflare D1 **Time Travel** (automatic) | Restore the database to any minute: `npx wrangler d1 time-travel restore samasalt-mitra --timestamp=2026-11-19T10:00:00+05:30` (from `worker/`) | Last **7 days** on the free plan (30 days on Workers Paid) |
| **Backup file** on your computer | `node tools/backup.mjs` (live) or `node tools/backup.mjs --staging`, once a week and before every "make live" | The newest 12 files in `backups/` |

- A backup file holds staff names and Kendra phone numbers: it stays on your computer. `backups/` is
  in `.gitignore`; never upload it to GitHub or share it.
- Restore a backup file into an **empty** database only, e.g. a new test database:
  `npx wrangler d1 execute <db> --remote --file backups/<file>.sql`.
- Before restoring anything on the live database, take a fresh backup first.

## 3. Free plan limits (what to watch)

| Cloudflare free plan | Limit | SamaSalt-Mitra's protection |
|---|---|---|
| Workers requests | 100,000 a day | Per-address limit on checks (`LIMIT_CHECK`) |
| Workers AI (photo and prescription reading) | Daily free allocation | `DAILY_PHOTO_LIMIT` (1,500 a day on live); the live check warns at 80% |
| D1 rows written | 100,000 a day | Big loads (Kendra list, PIN locations ~78,000 rows) one per day |
| D1 storage | 5 GB | Today well under 100 MB |

`/api/health` shows today's photo reads (`usage.photo_reads` / `usage.photo_cap`). If the warning
comes often with real patients (not abuse), either raise `DAILY_PHOTO_LIMIT` a little or move to
Workers Paid (about US$5 a month), which lifts all of these limits.

## 4. Monthly impact report

`/impact` → **Period** (a month) → **Download CSV** or **Print / save as PDF**. Real lookups only;
test traffic is never counted. Useful for PMBI and partners.
