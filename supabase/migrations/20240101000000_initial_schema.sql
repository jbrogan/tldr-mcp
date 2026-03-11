-- ============================================================================
-- tldr-mcp: Multi-User Database Schema
-- ============================================================================
-- This migration creates all tables for the Wheel of Life productivity system
-- with multi-user support via Row Level Security (RLS).
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE owner_type AS ENUM ('organization', 'team', 'person');
CREATE TYPE person_relation_type AS ENUM ('with', 'for');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- User profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wheel of Life areas (seeded per user on signup)
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams (within organizations)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Persons (people representations)
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  linked_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  title TEXT,
  notes TEXT,
  relationship_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Person-Team junction table
CREATE TABLE person_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(person_id, team_id)
);

-- Collections (groupings of ends)
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  owner_type owner_type NOT NULL,
  owner_id UUID NOT NULL,
  collection_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ends (aspirations/goals)
CREATE TABLE ends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- End shares (sharing ends with other users)
CREATE TABLE end_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  end_id UUID NOT NULL REFERENCES ends(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(end_id, shared_with_user_id)
);

-- Habits (recurring behaviors)
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  frequency TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habit-End junction table
CREATE TABLE habit_ends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  end_id UUID NOT NULL REFERENCES ends(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(habit_id, end_id)
);

-- Actions (habit completions)
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  actual_duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Action-Person junction table
CREATE TABLE action_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  relation_type person_relation_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(action_id, person_id, relation_type)
);

-- Tasks (one-off to-dos)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  end_id UUID REFERENCES ends(id) ON DELETE SET NULL,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  actual_duration_minutes INTEGER,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task-Person junction table
CREATE TABLE task_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  relation_type person_relation_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, person_id, relation_type)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- User-based lookups (most common queries)
CREATE INDEX idx_areas_user_id ON areas(user_id);
CREATE INDEX idx_organizations_user_id ON organizations(user_id);
CREATE INDEX idx_teams_user_id ON teams(user_id);
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_persons_user_id ON persons(user_id);
CREATE INDEX idx_persons_linked_user_id ON persons(linked_user_id);
CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_ends_user_id ON ends(user_id);
CREATE INDEX idx_ends_area_id ON ends(area_id);
CREATE INDEX idx_ends_collection_id ON ends(collection_id);
CREATE INDEX idx_habits_user_id ON habits(user_id);
CREATE INDEX idx_habits_area_id ON habits(area_id);
CREATE INDEX idx_actions_user_id ON actions(user_id);
CREATE INDEX idx_actions_habit_id ON actions(habit_id);
CREATE INDEX idx_actions_completed_at ON actions(completed_at);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_end_id ON tasks(end_id);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at);

-- Sharing lookups
CREATE INDEX idx_end_shares_end_id ON end_shares(end_id);
CREATE INDEX idx_end_shares_shared_with_user_id ON end_shares(shared_with_user_id);

-- Junction table lookups
CREATE INDEX idx_person_teams_person_id ON person_teams(person_id);
CREATE INDEX idx_person_teams_team_id ON person_teams(team_id);
CREATE INDEX idx_habit_ends_habit_id ON habit_ends(habit_id);
CREATE INDEX idx_habit_ends_end_id ON habit_ends(end_id);
CREATE INDEX idx_action_persons_action_id ON action_persons(action_id);
CREATE INDEX idx_action_persons_person_id ON action_persons(person_id);
CREATE INDEX idx_task_persons_task_id ON task_persons(task_id);
CREATE INDEX idx_task_persons_person_id ON task_persons(person_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ends ENABLE ROW LEVEL SECURITY;
ALTER TABLE end_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_ends ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_persons ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: Profiles
-- ============================================================================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow viewing other profiles for sharing (limited info)
CREATE POLICY "Users can view profiles for sharing lookup"
  ON profiles FOR SELECT
  USING (true);

-- ============================================================================
-- RLS POLICIES: Base Tables (user_id ownership)
-- ============================================================================

-- Areas
CREATE POLICY "Users can CRUD own areas"
  ON areas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Organizations
CREATE POLICY "Users can CRUD own organizations"
  ON organizations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Teams
CREATE POLICY "Users can CRUD own teams"
  ON teams FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Persons
CREATE POLICY "Users can CRUD own persons"
  ON persons FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Person Teams (based on person ownership)
CREATE POLICY "Users can CRUD person_teams for own persons"
  ON person_teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM persons p
      WHERE p.id = person_teams.person_id
      AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM persons p
      WHERE p.id = person_teams.person_id
      AND p.user_id = auth.uid()
    )
  );

-- Collections
CREATE POLICY "Users can CRUD own collections"
  ON collections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tasks
CREATE POLICY "Users can CRUD own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Task Persons (based on task ownership)
CREATE POLICY "Users can CRUD task_persons for own tasks"
  ON task_persons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_persons.task_id
      AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_persons.task_id
      AND t.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: Ends (with sharing support)
-- ============================================================================

-- Ends: Own ends
CREATE POLICY "Users can CRUD own ends"
  ON ends FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ends: Shared ends (read-only)
CREATE POLICY "Users can view shared ends"
  ON ends FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM end_shares es
      WHERE es.end_id = ends.id
      AND es.shared_with_user_id = auth.uid()
    )
  );

-- End Shares: Users can manage shares they created
CREATE POLICY "Users can manage own shares"
  ON end_shares FOR ALL
  USING (auth.uid() = shared_by_user_id)
  WITH CHECK (auth.uid() = shared_by_user_id);

-- End Shares: Users can view shares for their ends
CREATE POLICY "Users can view shares for own ends"
  ON end_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ends e
      WHERE e.id = end_shares.end_id
      AND e.user_id = auth.uid()
    )
  );

-- End Shares: Users can view shares shared with them
CREATE POLICY "Users can view shares shared with them"
  ON end_shares FOR SELECT
  USING (auth.uid() = shared_with_user_id);

-- ============================================================================
-- RLS POLICIES: Habits (with sharing via ends)
-- ============================================================================

-- Habits: Users can CRUD own habits
CREATE POLICY "Users can CRUD own habits"
  ON habits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Habits: Users can view habits on shared ends
CREATE POLICY "Users can view habits on shared ends"
  ON habits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM habit_ends he
      JOIN ends e ON he.end_id = e.id
      WHERE he.habit_id = habits.id
      AND (
        e.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM end_shares es
          WHERE es.end_id = e.id
          AND es.shared_with_user_id = auth.uid()
        )
      )
    )
  );

-- Habit Ends: Users can CRUD for own habits
CREATE POLICY "Users can CRUD habit_ends for own habits"
  ON habit_ends FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM habits h
      WHERE h.id = habit_ends.habit_id
      AND h.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits h
      WHERE h.id = habit_ends.habit_id
      AND h.user_id = auth.uid()
    )
  );

-- Habit Ends: Users can view for accessible habits
CREATE POLICY "Users can view habit_ends on shared ends"
  ON habit_ends FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ends e
      WHERE e.id = habit_ends.end_id
      AND (
        e.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM end_shares es
          WHERE es.end_id = e.id
          AND es.shared_with_user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- RLS POLICIES: Actions (group visibility on shared ends)
-- ============================================================================

-- Actions: Users can CRUD own actions
CREATE POLICY "Users can CRUD own actions"
  ON actions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Actions: Users can view actions on accessible ends (group visibility)
CREATE POLICY "Users can view actions on shared ends"
  ON actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM habits h
      JOIN habit_ends he ON he.habit_id = h.id
      JOIN ends e ON he.end_id = e.id
      WHERE h.id = actions.habit_id
      AND (
        e.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM end_shares es
          WHERE es.end_id = e.id
          AND es.shared_with_user_id = auth.uid()
        )
      )
    )
  );

-- Action Persons: Users can CRUD for own actions
CREATE POLICY "Users can CRUD action_persons for own actions"
  ON action_persons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM actions a
      WHERE a.id = action_persons.action_id
      AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM actions a
      WHERE a.id = action_persons.action_id
      AND a.user_id = auth.uid()
    )
  );

-- Action Persons: Users can view for accessible actions
CREATE POLICY "Users can view action_persons on shared ends"
  ON action_persons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM actions a
      JOIN habits h ON h.id = a.habit_id
      JOIN habit_ends he ON he.habit_id = h.id
      JOIN ends e ON he.end_id = e.id
      WHERE a.id = action_persons.action_id
      AND (
        e.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM end_shares es
          WHERE es.end_id = e.id
          AND es.shared_with_user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to seed default areas for new users
CREATE OR REPLACE FUNCTION seed_user_areas()
RETURNS TRIGGER AS $$
DECLARE
  area_names TEXT[] := ARRAY[
    'Career',
    'Family',
    'Health',
    'Finances',
    'Spiritual',
    'Relationships',
    'Personal Growth',
    'Fun & Recreation',
    'Community',
    'Physical Environment'
  ];
  area_name TEXT;
BEGIN
  FOREACH area_name IN ARRAY area_names
  LOOP
    INSERT INTO public.areas (user_id, name)
    VALUES (NEW.id, area_name);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to seed areas when profile is created
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION seed_user_areas();

-- Function to create profile from auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to update profile updated_at
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on profile update
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_timestamp();
