-- Supporting ends: many-to-many relationship between ends.
-- Grandparent → parent → leaf (max depth 2 levels, enforced at API layer).

CREATE TABLE end_supports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_end_id UUID NOT NULL REFERENCES ends(id) ON DELETE CASCADE,
  child_end_id UUID NOT NULL REFERENCES ends(id) ON DELETE CASCADE,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_end_id, child_end_id),
  CHECK (parent_end_id != child_end_id)
);

CREATE INDEX idx_end_supports_parent ON end_supports(parent_end_id);
CREATE INDEX idx_end_supports_child ON end_supports(child_end_id);

ALTER TABLE end_supports ENABLE ROW LEVEL SECURITY;

-- SELECT: view if you own either end (supports shared-end visibility)
CREATE POLICY "Users can view own end_supports"
  ON end_supports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM ends e WHERE e.id = end_supports.parent_end_id AND e.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM ends e WHERE e.id = end_supports.child_end_id AND e.user_id = auth.uid())
  );

-- INSERT/UPDATE/DELETE: must own the parent end
CREATE POLICY "Users can manage end_supports for own parent ends"
  ON end_supports FOR ALL
  USING (
    EXISTS (SELECT 1 FROM ends e WHERE e.id = end_supports.parent_end_id AND e.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM ends e WHERE e.id = end_supports.parent_end_id AND e.user_id = auth.uid())
  );

-- Shared-end visibility: users can view end_supports where the parent is accessible
CREATE POLICY "Users can view end_supports on shared ends"
  ON end_supports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ends e
      WHERE e.id = end_supports.parent_end_id
      AND public.can_access_end(e.id)
    )
  );
