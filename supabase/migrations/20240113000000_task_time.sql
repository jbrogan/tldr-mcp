-- Task time — track work sessions against tasks.
-- Separate from actions (which track habit completions).

CREATE TABLE task_time (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actual_duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction table for with/for persons on task time
CREATE TABLE task_time_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_time_id UUID NOT NULL REFERENCES task_time(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  relation_type person_relation_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_time_id, person_id, relation_type)
);

-- RLS
ALTER TABLE task_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_time_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own task time"
  ON task_time FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Shared end visibility for task time
CREATE POLICY "Users can view task time on shared ends"
  ON task_time FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_time.task_id
      AND t.end_id IS NOT NULL
      AND public.can_access_end(t.end_id)
    )
  );

CREATE POLICY "Users can CRUD own task time persons"
  ON task_time_persons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM task_time tt
      WHERE tt.id = task_time_persons.task_time_id
      AND tt.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_time tt
      WHERE tt.id = task_time_persons.task_time_id
      AND tt.user_id = auth.uid()
    )
  );
