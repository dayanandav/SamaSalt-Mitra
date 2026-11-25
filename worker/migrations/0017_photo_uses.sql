-- Photos read per device per day (PHOTO_PER_DEVICE). The device is the app's random code (not taken from
-- the phone) or the chat's scrambled code; rows are deleted after 2 days.
CREATE TABLE IF NOT EXISTS photo_uses (
  device TEXT NOT NULL,
  day TEXT NOT NULL,      -- YYYY-MM-DD (IST)
  n INTEGER NOT NULL,
  PRIMARY KEY (device, day)
) WITHOUT ROWID;
