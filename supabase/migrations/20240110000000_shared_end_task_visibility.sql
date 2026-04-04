-- Allow users to see tasks linked to shared ends.
-- Read-only — shared users cannot modify each other's tasks.

CREATE POLICY "Users can view tasks on shared ends"
  ON tasks FOR SELECT
  USING (
    end_id IS NOT NULL
    AND public.can_access_end(end_id)
  );

-- Also allow viewing task_persons for tasks on shared ends
CREATE POLICY "Users can view task_persons on shared ends"
  ON task_persons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_persons.task_id
      AND t.end_id IS NOT NULL
      AND public.can_access_end(t.end_id)
    )
  );
