-- Allow users to read area records for shared ends.
-- Areas are standard Wheel of Life categories with no sensitive data.
-- Shared ends reference the owner's area_id, which shared users need to resolve.

CREATE POLICY "Users can view areas for shared ends"
  ON areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ends e
      JOIN end_shares es ON es.end_id = e.id
      WHERE e.area_id = areas.id
      AND es.shared_with_user_id = auth.uid()
    )
  );
