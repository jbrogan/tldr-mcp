-- Make email and last_name nullable on persons.
-- First name is the only required field.
-- SQL NULLs are inherently unique, so no constraint changes needed —
-- multiple persons can have NULL email without conflict.

ALTER TABLE persons ALTER COLUMN email DROP NOT NULL;
ALTER TABLE persons ALTER COLUMN last_name DROP NOT NULL;
