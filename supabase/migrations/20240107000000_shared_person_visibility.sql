-- Allow users to see person records of co-participants on shared habits,
-- and person records linked to their own account.
-- Uses SECURITY DEFINER to avoid recursion on persons table.

CREATE OR REPLACE FUNCTION public.is_co_participant(p_person_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    -- Person is linked to the current user's account
    SELECT 1 FROM persons
    WHERE id = p_person_id
    AND linked_user_id = auth.uid()
  ) OR EXISTS (
    -- Person is a co-participant on a shared habit
    SELECT 1 FROM habit_persons hp1
    JOIN habit_persons hp2 ON hp1.habit_id = hp2.habit_id
    JOIN persons p2 ON p2.id = hp2.person_id
    WHERE hp1.person_id = p_person_id
    AND p2.linked_user_id = auth.uid()
    AND hp1.person_id != hp2.person_id
  );
$$;

-- Drop if exists from previous migration attempt
DROP POLICY IF EXISTS "Users can view co-participant persons" ON persons;

CREATE POLICY "Users can view co-participant persons"
  ON persons FOR SELECT
  USING (public.is_co_participant(id));
