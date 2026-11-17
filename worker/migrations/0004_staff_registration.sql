-- Kendra registration by authorised staff (role 'registrar'), from an emailed request with documents.
-- The public form is closed: a Kendra emails its request; a registrar checks the documents and
-- enters it here; a reviewer then calls the Kendra and approves (two different people).

ALTER TABLE kendra_contacts ADD COLUMN registered_by TEXT;   -- username of the registrar who entered it
ALTER TABLE kendra_contacts ADD COLUMN request_ref TEXT;     -- the email request: date received + subject/sender
ALTER TABLE kendra_contacts ADD COLUMN docs_checked TEXT;    -- JSON: which required documents were checked
