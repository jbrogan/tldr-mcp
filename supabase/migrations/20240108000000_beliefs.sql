-- Core beliefs that motivate ends.
-- Hierarchy: beliefs -> ends -> habits -> actions

CREATE TABLE beliefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction table: belief <-> end (many-to-many)
CREATE TABLE belief_ends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
  end_id UUID NOT NULL REFERENCES ends(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(belief_id, end_id)
);

-- RLS policies
ALTER TABLE beliefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE belief_ends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own beliefs"
  ON beliefs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can CRUD own belief_ends"
  ON belief_ends FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM beliefs b
      WHERE b.id = belief_ends.belief_id
      AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM beliefs b
      WHERE b.id = belief_ends.belief_id
      AND b.user_id = auth.uid()
    )
  );
