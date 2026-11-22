-- v2.0.7 missing-medicines list (roadmap S1.2).
-- missing_names: typed names that were not found, counted (real traffic only). Only text that looks
-- like a medicine name is kept (worker/src/missing.js: Latin letters/numbers, 3-60 characters, at
-- most 6 words, no long digit runs), with a count and the first/last day: no device, no time, no person.
CREATE TABLE IF NOT EXISTS missing_names (
  name_key TEXT PRIMARY KEY,      -- lowercased, spaces collapsed
  shown TEXT NOT NULL,            -- as first typed
  searches INTEGER NOT NULL DEFAULT 1,
  first_day TEXT NOT NULL,        -- YYYY-MM-DD (IST)
  last_day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'  -- open | added | ignored
);
CREATE INDEX IF NOT EXISTS idx_missing_open ON missing_names(status, searches);

-- added_medicines: brands staff add from the strip (Registrar), approved by a Reviewer. Found by
-- name like any brand (composition key, Jan Aushadhi product, same-salt brands); no price is kept.
CREATE TABLE IF NOT EXISTS added_medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,             -- brand name as printed
  manufacturer TEXT,
  composition TEXT NOT NULL,      -- salts and strengths as printed
  ckey TEXT NOT NULL,             -- canonical key (worker/src/normalize.js)
  form TEXT NOT NULL,
  rel TEXT,
  nti INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | removed
  source_name TEXT,               -- missing_names.name_key it answers, if any
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_added_name ON added_medicines(status, name);

CREATE TABLE IF NOT EXISTS added_medicine_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  med_id INTEGER NOT NULL,
  action TEXT NOT NULL,           -- add | approve | reject | remove
  admin_username TEXT NOT NULL,
  admin_name TEXT,
  note TEXT,
  at TEXT NOT NULL
);
