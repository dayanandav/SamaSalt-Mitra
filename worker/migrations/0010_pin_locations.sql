-- v2.0.4 Kendras by distance: one point per PIN code (median of India Post's post offices,
-- All India Pincode Directory, data.gov.in). Filled by data/build_pins.mjs (also sets kendras.lat/lng
-- from their PIN code where empty). Public data: nothing about any person.
CREATE TABLE IF NOT EXISTS pin_locations (
  pin TEXT PRIMARY KEY,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kendras_latlng ON kendras(lat, lng);
