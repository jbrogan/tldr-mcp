-- Multi-person habits + shared end write access
--
-- 1. Create habit_persons junction table (replaces habits.person_id)
-- 2. Migrate existing person_id data to junction table
-- 3. Drop person_id column from habits
-- 4. Add can_access_end() helper for shared write validation
-- 5. Update habit_ends policy for shared end write access

-- 1. Create habit_persons junction table
CREATE TABLE habit_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(habit_id, person_id)
);

CREATE INDEX idx_habit_persons_habit_id ON habit_persons(habit_id);
CREATE INDEX idx_habit_persons_person_id ON habit_persons(person_id);

ALTER TABLE habit_persons ENABLE ROW LEVEL SECURITY;

-- RLS: reuse owns_habit() SECURITY DEFINER to avoid recursion
CREATE POLICY "Users can CRUD habit_persons for own habits"
  ON habit_persons FOR ALL
  USING (public.owns_habit(habit_id))
  WITH CHECK (public.owns_habit(habit_id));

-- 2. Migrate existing person_id data
INSERT INTO habit_persons (habit_id, person_id)
SELECT id, person_id FROM habits
WHERE person_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop person_id column
ALTER TABLE habits DROP COLUMN person_id;

-- 4. Helper: check if user can access an end (owns or has share)
CREATE OR REPLACE FUNCTION public.can_access_end(p_end_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ends WHERE id = p_end_id AND user_id = auth.uid()
    UNION ALL
    SELECT 1 FROM end_shares WHERE end_id = p_end_id AND shared_with_user_id = auth.uid()
  );
$$;

-- 5. Update habit_ends policies for shared end access
DROP POLICY IF EXISTS "Users can CRUD habit_ends for own habits" ON habit_ends;

-- Owner can fully manage habit_ends for own habits
CREATE POLICY "Users can CRUD habit_ends for own habits"
  ON habit_ends FOR ALL
  USING (public.owns_habit(habit_id))
  WITH CHECK (public.owns_habit(habit_id) AND public.can_access_end(end_id));

-- Shared users can view habit_ends for ends shared with them
CREATE POLICY "Users can view habit_ends on accessible ends"
  ON habit_ends FOR SELECT
  USING (public.can_access_end(end_id));

-- 6. Shared users can view habit_persons on shared habits
CREATE POLICY "Users can view habit_persons on accessible ends"
  ON habit_persons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM habit_ends he
      WHERE he.habit_id = habit_persons.habit_id
      AND public.can_access_end(he.end_id)
    )
  );
