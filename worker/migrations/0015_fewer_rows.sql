-- Fewer D1 rows read and written (free plan counts both).
-- Today's photo count reads only today's photo rows (it read every lookup).
CREATE INDEX IF NOT EXISTS idx_lookups_photo ON lookups(day) WHERE input LIKE 'photo%';
-- Only a lookup with a volunteer's code is in this index (one row less written for every other lookup).
DROP INDEX IF EXISTS idx_lookups_volunteer;
CREATE INDEX IF NOT EXISTS idx_lookups_volunteer ON lookups(volunteer) WHERE volunteer IS NOT NULL;
-- /impact: the figures as one row, made again after IMPACT_CACHE_MIN minutes. Counts only, nothing personal.
CREATE TABLE IF NOT EXISTS impact_summary (
  key TEXT PRIMARY KEY,   -- 'all' or a month 'YYYY-MM'
  at INTEGER NOT NULL,    -- when it was made (ms)
  data TEXT NOT NULL
);
