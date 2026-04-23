-- Migrate habits from many-to-many (habit_ends) to single end_id.

-- 1. Add end_id column
ALTER TABLE habits ADD COLUMN end_id UUID REFERENCES ends(id) ON DELETE SET NULL;

-- 2. Backfill from habit_ends (takes first end for each habit)
UPDATE habits h
SET end_id = (
  SELECT end_id FROM habit_ends
  WHERE habit_id = h.id
  LIMIT 1
);

-- 3. Create index
CREATE INDEX idx_habits_end_id ON habits(end_id);

-- 4. Drop ALL policies that depend on habit_ends before we can drop the table.
-- Use exact policy names from the error + original migrations.
DROP POLICY IF EXISTS "Users can view shared habits" ON habits;
DROP POLICY IF EXISTS "Users can view habits on shared ends" ON habits;
DROP POLICY IF EXISTS "Users can view habit_persons on accessible ends" ON habit_persons;
DROP POLICY IF EXISTS "Users can CRUD habit_ends for own habits" ON habit_ends;
DROP POLICY IF EXISTS "Users can view habit_ends on shared ends" ON habit_ends;

-- Also drop action policies that join through habit_ends
DROP POLICY IF EXISTS "Users can view actions on shared ends" ON actions;
DROP POLICY IF EXISTS "Users can view action_persons on shared ends" ON action_persons;

-- 5. Drop habit_ends indexes and table
DROP INDEX IF EXISTS idx_habit_ends_habit_id;
DROP INDEX IF EXISTS idx_habit_ends_end_id;
DROP TABLE habit_ends;

-- 6. Recreate policies using habits.end_id directly (no habit_ends join)

CREATE POLICY "Users can view shared habits"
  ON habits FOR SELECT
  USING (
    habits.end_id IS NOT NULL
    AND public.can_access_end(habits.end_id)
  );

CREATE POLICY "Users can view actions on shared ends"
  ON actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM habits h
      WHERE h.id = actions.habit_id
      AND h.end_id IS NOT NULL
      AND public.can_access_end(h.end_id)
    )
  );

CREATE POLICY "Users can view action_persons on shared ends"
  ON action_persons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM actions a
      JOIN habits h ON h.id = a.habit_id
      WHERE a.id = action_persons.action_id
      AND h.end_id IS NOT NULL
      AND public.can_access_end(h.end_id)
    )
  );

-- Recreate habit_persons policy using habits.end_id
CREATE POLICY "Users can view habit_persons on accessible ends"
  ON habit_persons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM habits h
      WHERE h.id = habit_persons.habit_id
      AND h.end_id IS NOT NULL
      AND public.can_access_end(h.end_id)
    )
  );
