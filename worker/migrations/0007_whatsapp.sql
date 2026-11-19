-- v2.0 WhatsApp bot: the little a chat needs to remember, for at most 24 hours.
-- The patient's phone number is NEVER stored: `chat` is HMAC-SHA256(WA_HASH_KEY, number), which
-- cannot be turned back into the number. A row holds only the chosen language, the PIN code the
-- patient sent, and a medicine name read from a photo waiting for "Yes, check it". It is erased
-- when the patient types DELETE, and every row older than 24 hours is deleted on each message.

CREATE TABLE IF NOT EXISTS wa_chats (
  chat TEXT PRIMARY KEY,        -- HMAC of the WhatsApp number (hex), never the number
  lang TEXT,                    -- en | kn | hi
  pin TEXT,                     -- 6-digit PIN the patient sent
  pending TEXT,                 -- medicine name read from a photo, waiting for confirmation
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wa_chats_updated ON wa_chats(updated_at);

-- Meta may deliver the same message twice: its id is kept for 24 hours so it is answered once.
CREATE TABLE IF NOT EXISTS wa_seen (
  id TEXT PRIMARY KEY,          -- WhatsApp message id (wamid...), not linked to any number
  at TEXT NOT NULL
);
