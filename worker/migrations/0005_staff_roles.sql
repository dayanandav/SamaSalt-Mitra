-- Staff roles as in most admin consoles: one sign-in, the role decides what each person can do.
--   admin     : adds / switches off Reviewer and Registrar accounts; reviews; can also register.
--   reviewer  : approves, rejects, withdraws and modifies registrations.
--   registrar : registers Kendras from a request received by email or in person.
-- The ADMIN_TOKEN holder ("system owner", username 'owner') is the only one who can add Admins.

-- Accounts made with the old 'owner' role become Admins.
UPDATE admins SET role = 'admin' WHERE role = 'owner';
UPDATE admin_sessions SET role = 'admin' WHERE role = 'owner' AND username <> 'owner';

-- How the Kendra's request arrived: 'email' | 'in_person'.
ALTER TABLE kendra_contacts ADD COLUMN request_channel TEXT;

-- For an 'edit' in the review log: JSON { field: [before, after] }.
ALTER TABLE kendra_reviews ADD COLUMN changes TEXT;
