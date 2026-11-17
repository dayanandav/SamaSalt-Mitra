-- v1.3 Registered volunteers: people who help patients check medicines at camps and Kendras.
-- Registered like Kendras: the volunteer's request (by phone, email or in person) is entered by a
-- Registrar, then a Reviewer calls them, sees an ID and approves. Volunteer details are seen by
-- staff only, never by patients. The ID's type is noted, never its number.
-- Patients' data is never stored: a lookup made through a volunteer's link records only the
-- volunteer's code (lookups.volunteer), so staff can see how many checks each volunteer helped with.

CREATE TABLE IF NOT EXISTS volunteers (
  code TEXT PRIMARY KEY,        -- SV-XXXXX, in the volunteer's personal link /v/SV-XXXXX
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,         -- 10-digit Indian mobile; staff only
  district TEXT NOT NULL,       -- where they help
  pin TEXT,                     -- 6-digit PIN of their area (optional)
  organisation TEXT,            -- NGO, ASHA, NSS unit, college ... (optional)
  languages TEXT,               -- languages they use with patients (optional)
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | withdrawn (shown as "removed")
  consent_at TEXT NOT NULL,     -- when the volunteer agreed to the terms (told to the registrar)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  verified_at TEXT,
  verified_by TEXT,
  admin_note TEXT,
  registered_by TEXT,           -- username of the registrar
  request_channel TEXT,         -- phone | email | in_person
  request_ref TEXT,             -- the request: date, and how it came
  id_seen TEXT                  -- type of ID seen by the registrar (aadhaar, voter, ...); never the number
);
CREATE INDEX IF NOT EXISTS idx_vol_status ON volunteers(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_vol_mobile ON volunteers(mobile);

CREATE TABLE IF NOT EXISTS volunteer_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  action TEXT NOT NULL,         -- register | approve | reject | withdraw | edit
  from_status TEXT,
  to_status TEXT,
  admin_username TEXT,
  admin_name TEXT,
  checks TEXT,                  -- JSON, on approve
  note TEXT,
  changes TEXT,                 -- JSON {field: [before, after]}, on edit
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_volrev_code ON volunteer_reviews(code, id);

ALTER TABLE lookups ADD COLUMN volunteer TEXT; -- approved volunteer's code, or NULL
CREATE INDEX IF NOT EXISTS idx_lookups_volunteer ON lookups(volunteer);
