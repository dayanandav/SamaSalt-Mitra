-- v2.0.7 why a photo or scan could not be read (impact page, "Finding the medicine"): one of the
-- agent's fixed words, never the photo or any text. worker/src/index.js keeps only these:
--   'no_composition'  the salts and strengths were not clear
--   'brand_mismatch'  the brand read and the salts read do not belong together
--   'low_confidence'  the reading was too unsure (blurred, cut off, glare)
-- NULL for every other lookup.
ALTER TABLE lookups ADD COLUMN read_reason TEXT;
