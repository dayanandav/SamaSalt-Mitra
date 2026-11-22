-- v2.0.7 search quality numbers (roadmap S1.4): how a typed name was chosen, for the impact page.
-- One of a fixed set of words (worker/src/index.js keeps only these), never the typed text:
--   'typed'      typed and sent by the person
--   'suggest'    tapped in the suggestions while typing
--   'didyoumean' tapped in "Did you mean…?" after a not-found
--   'rx'         tapped in the list read from a prescription photo
-- NULL for photos, chat and WhatsApp (their way in is already in `input` and `mode`).
ALTER TABLE lookups ADD COLUMN via TEXT;
