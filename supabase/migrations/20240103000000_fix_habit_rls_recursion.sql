-- Fix infinite recursion between habits and habit_ends RLS policies.
--
-- The "Users can CRUD habit_ends for own habits" policy on habit_ends queries
-- the habits table, which triggers "Users can view habits on shared ends"
-- which queries habit_ends → infinite recursion.
--
-- Fix: use a SECURITY DEFINER function to check habit ownership without
-- triggering RLS on the habits table.

CREATE OR REPLACE FUNCTION public.owns_habit(p_habit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM habits WHERE id = p_habit_id AND user_id = auth.uid()
  );
$$;

-- Replace the habit_ends CRUD policy to use the helper function
DROP POLICY IF EXISTS "Users can CRUD habit_ends for own habits" ON habit_ends;
CREATE POLICY "Users can CRUD habit_ends for own habits"
  ON habit_ends FOR ALL
  USING (public.owns_habit(habit_id))
  WITH CHECK (public.owns_habit(habit_id));

-- Also drop the redundant "view habit_ends on shared ends" policy.
-- It queries ends which can trigger further recursion chains.
-- Users already get visibility through the habits sharing policy.
DROP POLICY IF EXISTS "Users can view habit_ends on shared ends" ON habit_ends;
