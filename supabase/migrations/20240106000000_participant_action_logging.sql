-- Allow habit participants to log actions against shared habits.
--
-- Participants are determined by:
-- 1. Direct assignment via habit_persons (linked_user_id = auth.uid())
-- 2. Team membership via habit.team_id → person_teams (linked_user_id = auth.uid())
--
-- Uses SECURITY DEFINER to avoid RLS recursion and for performance.

CREATE OR REPLACE FUNCTION public.can_log_action(p_habit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    -- Direct participant
    SELECT 1 FROM habit_persons hp
    JOIN persons p ON p.id = hp.person_id
    WHERE hp.habit_id = p_habit_id
    AND p.linked_user_id = auth.uid()
  ) OR EXISTS (
    -- Team member
    SELECT 1 FROM habits h
    JOIN person_teams pt ON pt.team_id = h.team_id
    JOIN persons p ON p.id = pt.person_id
    WHERE h.id = p_habit_id
    AND h.team_id IS NOT NULL
    AND p.linked_user_id = auth.uid()
  );
$$;

-- Allow participants to insert actions on habits they participate in
CREATE POLICY "Participants can create actions on shared habits"
  ON actions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_log_action(habit_id)
  );

-- Allow participants to view their own actions on shared habits
-- (existing "view actions on shared ends" policy covers viewing others' actions)
CREATE POLICY "Participants can update own actions on shared habits"
  ON actions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.can_log_action(habit_id)
  );

-- Allow participants to manage action_persons for their own actions on shared habits
CREATE POLICY "Participants can manage action_persons on shared habits"
  ON action_persons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM actions a
      WHERE a.id = action_persons.action_id
      AND a.user_id = auth.uid()
      AND public.can_log_action(a.habit_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM actions a
      WHERE a.id = action_persons.action_id
      AND a.user_id = auth.uid()
      AND public.can_log_action(a.habit_id)
    )
  );
