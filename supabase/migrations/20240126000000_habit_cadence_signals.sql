-- Habit cadence signals: last_action_at (denormalized, trigger-maintained)
-- and expected_interval_days (computed at write time by application code).
-- See docs/tldr-cadence-signals-spec.md.

ALTER TABLE habits ADD COLUMN last_action_at TIMESTAMPTZ;
ALTER TABLE habits ADD COLUMN expected_interval_days INTEGER;

CREATE INDEX idx_habits_last_action_at ON habits(last_action_at);

-- Trigger function: on any change to actions, recompute MAX(completed_at)
-- for the affected habit(s). Recomputing on every change (vs. GREATEST on
-- insert + selective recompute on update/delete) keeps the trigger correct
-- under all action edits with no edge cases. Handles the rare case where
-- an action's habit_id is changed by syncing both old and new habits.
CREATE OR REPLACE FUNCTION sync_habit_last_action_at() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.habit_id IS NOT NULL THEN
    UPDATE habits
    SET last_action_at = (
      SELECT MAX(completed_at) FROM actions WHERE habit_id = NEW.habit_id
    )
    WHERE id = NEW.habit_id;
  END IF;

  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND OLD.habit_id IS DISTINCT FROM NEW.habit_id) THEN
    UPDATE habits
    SET last_action_at = (
      SELECT MAX(completed_at) FROM actions WHERE habit_id = OLD.habit_id
    )
    WHERE id = OLD.habit_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actions_sync_last_action
AFTER INSERT OR UPDATE OF completed_at, habit_id OR DELETE ON actions
FOR EACH ROW EXECUTE FUNCTION sync_habit_last_action_at();

-- Backfill last_action_at for existing habits.
UPDATE habits h SET last_action_at = (
  SELECT MAX(completed_at) FROM actions WHERE habit_id = h.id
);

-- expected_interval_days is backfilled by application code (npm run cli
-- backfill-cadence) since the recurrence parser lives in TypeScript.
