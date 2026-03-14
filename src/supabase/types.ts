/**
 * Supabase Database Types
 *
 * TypeScript types for all database tables.
 * Uses type aliases (not interfaces) to ensure implicit index signature
 * compatibility with the Supabase SDK's conditional type resolution.
 */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      areas: {
        Row: AreaRow;
        Insert: AreaInsert;
        Update: Partial<AreaInsert>;
        Relationships: [];
      };
      organizations: {
        Row: OrganizationRow;
        Insert: OrganizationInsert;
        Update: Partial<OrganizationInsert>;
        Relationships: [];
      };
      teams: {
        Row: TeamRow;
        Insert: TeamInsert;
        Update: Partial<TeamInsert>;
        Relationships: [];
      };
      persons: {
        Row: PersonRow;
        Insert: PersonInsert;
        Update: Partial<PersonInsert>;
        Relationships: [];
      };
      person_teams: {
        Row: PersonTeamRow;
        Insert: PersonTeamInsert;
        Update: Partial<PersonTeamInsert>;
        Relationships: [
          {
            foreignKeyName: "person_teams_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "persons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "person_teams_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: CollectionRow;
        Insert: CollectionInsert;
        Update: Partial<CollectionInsert>;
        Relationships: [];
      };
      ends: {
        Row: EndRow;
        Insert: EndInsert;
        Update: Partial<EndInsert>;
        Relationships: [];
      };
      end_shares: {
        Row: EndShareRow;
        Insert: EndShareInsert;
        Update: Partial<EndShareInsert>;
        Relationships: [];
      };
      habits: {
        Row: HabitRow;
        Insert: HabitInsert;
        Update: Partial<HabitInsert>;
        Relationships: [
          {
            foreignKeyName: "habits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      habit_persons: {
        Row: HabitPersonRow;
        Insert: HabitPersonInsert;
        Update: Partial<HabitPersonInsert>;
        Relationships: [
          {
            foreignKeyName: "habit_persons_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "habit_persons_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "persons";
            referencedColumns: ["id"];
          },
        ];
      };
      habit_ends: {
        Row: HabitEndRow;
        Insert: HabitEndInsert;
        Update: Partial<HabitEndInsert>;
        Relationships: [
          {
            foreignKeyName: "habit_ends_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "habit_ends_end_id_fkey";
            columns: ["end_id"];
            isOneToOne: false;
            referencedRelation: "ends";
            referencedColumns: ["id"];
          },
        ];
      };
      actions: {
        Row: ActionRow;
        Insert: ActionInsert;
        Update: Partial<ActionInsert>;
        Relationships: [
          {
            foreignKeyName: "actions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "actions_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      action_persons: {
        Row: ActionPersonRow;
        Insert: ActionPersonInsert;
        Update: Partial<ActionPersonInsert>;
        Relationships: [
          {
            foreignKeyName: "action_persons_action_id_fkey";
            columns: ["action_id"];
            isOneToOne: false;
            referencedRelation: "actions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_persons_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "persons";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: TaskRow;
        Insert: TaskInsert;
        Update: Partial<TaskInsert>;
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_persons: {
        Row: TaskPersonRow;
        Insert: TaskPersonInsert;
        Update: Partial<TaskPersonInsert>;
        Relationships: [
          {
            foreignKeyName: "task_persons_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_persons_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "persons";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ============================================================================
// Row Types (what you get back from queries)
// ============================================================================

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export type AreaRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type OrganizationRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type TeamRow = {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  created_at: string;
};

export type PersonRow = {
  id: string;
  user_id: string;
  linked_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  title: string | null;
  notes: string | null;
  relationship_type: string | null;
  created_at: string;
};

export type PersonTeamRow = {
  id: string;
  person_id: string;
  team_id: string;
  created_at: string;
};

export type CollectionRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  owner_type: string;
  owner_id: string;
  collection_type: string | null;
  created_at: string;
};

export type EndRow = {
  id: string;
  user_id: string;
  name: string;
  area_id: string | null;
  collection_id: string | null;
  created_at: string;
};

export type EndShareRow = {
  id: string;
  end_id: string;
  shared_by_user_id: string;
  shared_with_user_id: string;
  created_at: string;
};

export type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  area_id: string | null;
  team_id: string | null;
  frequency: string | null;
  duration_minutes: number | null;
  created_at: string;
};

export type HabitEndRow = {
  id: string;
  habit_id: string;
  end_id: string;
  created_at: string;
};

export type ActionRow = {
  id: string;
  user_id: string;
  habit_id: string;
  completed_at: string;
  actual_duration_minutes: number | null;
  notes: string | null;
  created_at: string;
};

export type ActionPersonRow = {
  id: string;
  action_id: string;
  person_id: string;
  relation_type: string;
  created_at: string;
};

export type TaskRow = {
  id: string;
  user_id: string;
  name: string;
  end_id: string | null;
  area_id: string | null;
  actual_duration_minutes: number | null;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type TaskPersonRow = {
  id: string;
  task_id: string;
  person_id: string;
  relation_type: string;
  created_at: string;
};

// ============================================================================
// Insert Types (what you send for inserts)
// ============================================================================

export type ProfileInsert = {
  id: string;
  email: string;
  display_name: string;
  created_at?: string;
  updated_at?: string;
};

export type AreaInsert = {
  id?: string;
  user_id: string;
  name: string;
  created_at?: string;
};

export type OrganizationInsert = {
  id?: string;
  user_id: string;
  name: string;
  created_at?: string;
};

export type TeamInsert = {
  id?: string;
  user_id: string;
  organization_id: string;
  name: string;
  created_at?: string;
};

export type PersonInsert = {
  id?: string;
  user_id: string;
  linked_user_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  title?: string | null;
  notes?: string | null;
  relationship_type?: string | null;
  created_at?: string;
};

export type PersonTeamInsert = {
  id?: string;
  person_id: string;
  team_id: string;
  created_at?: string;
};

export type CollectionInsert = {
  id?: string;
  user_id: string;
  name: string;
  description?: string | null;
  owner_type: string;
  owner_id: string;
  collection_type?: string | null;
  created_at?: string;
};

export type EndInsert = {
  id?: string;
  user_id: string;
  name: string;
  area_id?: string | null;
  collection_id?: string | null;
  created_at?: string;
};

export type EndShareInsert = {
  id?: string;
  end_id: string;
  shared_by_user_id: string;
  shared_with_user_id: string;
  created_at?: string;
};

export type HabitInsert = {
  id?: string;
  user_id: string;
  name: string;
  area_id?: string | null;
  team_id?: string | null;
  frequency?: string | null;
  duration_minutes?: number | null;
  created_at?: string;
};

export type HabitPersonRow = {
  id: string;
  habit_id: string;
  person_id: string;
  created_at: string;
};

export type HabitPersonInsert = {
  id?: string;
  habit_id: string;
  person_id: string;
  created_at?: string;
};

export type HabitEndInsert = {
  id?: string;
  habit_id: string;
  end_id: string;
  created_at?: string;
};

export type ActionInsert = {
  id?: string;
  user_id: string;
  habit_id: string;
  completed_at: string;
  actual_duration_minutes?: number | null;
  notes?: string | null;
  created_at?: string;
};

export type ActionPersonInsert = {
  id?: string;
  action_id: string;
  person_id: string;
  relation_type: string;
  created_at?: string;
};

export type TaskInsert = {
  id?: string;
  user_id: string;
  name: string;
  end_id?: string | null;
  area_id?: string | null;
  actual_duration_minutes?: number | null;
  due_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at?: string;
};

export type TaskPersonInsert = {
  id?: string;
  task_id: string;
  person_id: string;
  relation_type: string;
  created_at?: string;
};

// ============================================================================
// Convenience Aliases
// ============================================================================

export type Profile = ProfileRow;
export type Area = AreaRow;
export type Organization = OrganizationRow;
export type Team = TeamRow;
export type Person = PersonRow;
export type PersonTeam = PersonTeamRow;
export type Collection = CollectionRow;
export type End = EndRow;
export type EndShare = EndShareRow;
export type Habit = HabitRow;
export type HabitPerson = HabitPersonRow;
export type HabitEnd = HabitEndRow;
export type Action = ActionRow;
export type ActionPerson = ActionPersonRow;
export type Task = TaskRow;
export type TaskPerson = TaskPersonRow;
