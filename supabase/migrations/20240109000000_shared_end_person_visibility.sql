-- Extend co-participant visibility to include users who share ends.
-- If User A shares an end with User B, both should be able to resolve
-- each other's self-person records for display purposes.

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
  ) OR EXISTS (
    -- Current user owns an end shared with person's user
    SELECT 1 FROM persons p
    JOIN end_shares es ON es.shared_with_user_id = p.linked_user_id
    JOIN ends e ON e.id = es.end_id
    WHERE p.id = p_person_id
    AND e.user_id = auth.uid()
  ) OR EXISTS (
    -- Person's user owns an end shared with the current user
    SELECT 1 FROM persons p
    JOIN ends e ON e.user_id = p.linked_user_id
    JOIN end_shares es ON es.end_id = e.id
    WHERE p.id = p_person_id
    AND es.shared_with_user_id = auth.uid()
  );
$$;
