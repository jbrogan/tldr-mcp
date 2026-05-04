-- Add preferred_days to habits and tasks for scheduling hints.
-- Stores natural language day preferences (e.g., "M,W,F", "weekdays", "1st of the month").
-- Nullable — existing records unaffected; scheduling falls back to historical inference.

ALTER TABLE habits ADD COLUMN preferred_days text;
ALTER TABLE tasks ADD COLUMN preferred_days text;
