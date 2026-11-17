-- Admin sign-in for the /admin page, and a review log for Kendra registrations.
-- Owner: signs in with the ADMIN_TOKEN secret and creates reviewer accounts.
-- Reviewer: signs in with username + password; can review and approve Kendra registrations.

CREATE TABLE IF NOT EXISTS admins (
  username TEXT PRIMARY KEY,      -- lower-case, a-z 0-9 . _ -
  name TEXT NOT NULL,             -- shown in the review log ("approved by …")
  role TEXT NOT NULL DEFAULT 'reviewer', -- 'reviewer' | 'owner'
  pw_hash TEXT NOT NULL,          -- pbkdf2$<iterations>$<salt b64>$<hash b64>
  active INTEGER NOT NULL DEFAULT 1,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,              -- after 5 wrong passwords: locked for 15 minutes
  created_at TEXT NOT NULL,
  created_by TEXT,
  last_login_at TEXT
);

-- Signed-in sessions. Only a SHA-256 of the session cookie is stored.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,         -- an admins.username, or 'owner' for the ADMIN_TOKEN holder
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions(expires_at);

-- Every review action on a Kendra registration: who, what, when, and what they confirmed.
CREATE TABLE IF NOT EXISTS kendra_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  action TEXT NOT NULL,           -- approve | reject | withdraw
  from_status TEXT,
  to_status TEXT NOT NULL,
  admin_username TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  checks TEXT,                    -- JSON: { called, details, terms } ticked by the reviewer
  note TEXT,
  whatsapp TEXT,                  -- the number that was reviewed (so a later change is visible)
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_code ON kendra_reviews(code, at);

ALTER TABLE kendra_contacts ADD COLUMN verified_by TEXT;
