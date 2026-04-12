-- Update task schema for better time tracking
-- actual_duration_minutes moves to task_time entries
-- Add scheduled_date and estimated_duration_minutes for planning

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;
ALTER TABLE tasks DROP COLUMN IF EXISTS actual_duration_minutes;
