-- The Jan Aushadhi list as ONE row, so a Worker that starts reads a few rows instead of about 1,900
-- (D1 free plan: every row read counts). Written by the Worker itself (jaList in worker/src/tools.js)
-- when the list changed; nothing personal.
CREATE TABLE IF NOT EXISTS ja_snapshot (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version TEXT NOT NULL,  -- the list's dates in meta when this copy was made
  data TEXT NOT NULL      -- JSON rows
);
