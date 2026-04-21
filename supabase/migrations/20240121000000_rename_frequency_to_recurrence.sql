-- Rename frequency to recurrence on habits for consistency with recurring tasks.
-- No data transformation — existing values are valid as-is.
ALTER TABLE habits RENAME COLUMN frequency TO recurrence;
