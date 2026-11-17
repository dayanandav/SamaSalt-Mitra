-- v1.1 Kendra registry: contact numbers that Jan Aushadhi Kendra pharmacists register themselves.
-- The official Kendra list has no phone numbers, so each one comes from the pharmacist and is
-- shown to patients only after an admin has called it and approved it (status = 'approved').
-- These are Kendra business numbers, not patient data. Patients' data is never stored here.

CREATE TABLE IF NOT EXISTS kendra_contacts (
  code TEXT PRIMARY KEY,        -- PMBJK code; must exist in kendras
  whatsapp TEXT NOT NULL,       -- 10-digit Indian mobile number used for WhatsApp
  sms TEXT,                     -- 10-digit number for SMS and calls, if different
  hours TEXT,                   -- opening hours as the pharmacist wrote them
  contact_name TEXT,            -- who registered (pharmacist or owner); shown to the admin only
  role TEXT,                    -- 'pharmacist' | 'owner' | 'staff'
  ref TEXT NOT NULL,            -- registration reference given to the pharmacist (e.g. KR-7KQ2M)
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | withdrawn
  consent_at TEXT NOT NULL,     -- when the terms were accepted (ISO, UTC)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  verified_at TEXT,             -- when an admin approved it
  admin_note TEXT               -- e.g. "called 16 Nov, confirmed code and address"
);
CREATE INDEX IF NOT EXISTS idx_kc_status ON kendra_contacts(status, updated_at);
