-- Add recurrence support to tasks.
-- Existing tasks have all three fields NULL and behave as one-time items.

ALTER TABLE tasks
  ADD COLUMN recurrence text,
  ADD COLUMN last_completed_at timestamptz,
  ADD COLUMN next_due_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_next_due_at ON tasks (user_id, next_due_at)
  WHERE next_due_at IS NOT NULL;
