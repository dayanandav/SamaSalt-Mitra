-- v2.0.3: NPPA ceiling prices (DPCO 2013 scheduled formulations), the legal maximum price per
-- tablet / capsule / ml before GST. Loaded by the developer import (/dev → NPPA ceiling prices).
-- Public, official data: nothing about any person.
CREATE TABLE IF NOT EXISTS ceiling_prices (
  ckey TEXT PRIMARY KEY,        -- composition key, the same as medicines.ckey and ja_products.ckey
  name TEXT NOT NULL,           -- as in the NPPA list ("Paracetamol Tablet 650 mg")
  unit TEXT,                    -- as in the NPPA list ("1 Tablet")
  price REAL NOT NULL,          -- ceiling price for that unit (Rs., before GST)
  unit_price REAL NOT NULL,     -- per one tablet / capsule / ml
  notification TEXT,            -- S.O. number
  notified_on TEXT              -- S.O. date, YYYY-MM-DD
);
