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
      api_tokens: {
        Row: ApiTokenRow;
        Insert: ApiTokenInsert;
        Update: Partial<ApiTokenInsert>;
        Relationships: [
          {
            foreignKeyName: "api_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      beliefs: {
        Row: BeliefRow;
        Insert: BeliefInsert;
        Update: Partial<BeliefInsert>;
        Relationships: [
          {
            foreignKeyName: "beliefs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      belief_ends: {
        Row: BeliefEndRow;
        Insert: BeliefEndInsert;
        Update: Partial<BeliefEndInsert>;
        Relationships: [
          {
            foreignKeyName: "belief_ends_belief_id_fkey";
            columns: ["belief_id"];
            isOneToOne: false;
            referencedRelation: "beliefs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "belief_ends_end_id_fkey";
            columns: ["end_id"];
            isOneToOne: false;
            referencedRelation: "ends";
            referencedColumns: ["id"];
          },
        ];
      };
      portfolios: {
        Row: PortfolioRow;
        Insert: PortfolioInsert;
        Update: Partial<PortfolioInsert>;
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
      end_supports: {
        Row: EndSupportRow;
        Insert: EndSupportInsert;
        Update: Partial<EndSupportInsert>;
        Relationships: [
          {
            foreignKeyName: "end_supports_parent_end_id_fkey";
            columns: ["parent_end_id"];
            isOneToOne: false;
            referencedRelation: "ends";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "end_supports_child_end_id_fkey";
            columns: ["child_end_id"];
            isOneToOne: false;
            referencedRelation: "ends";
            referencedColumns: ["id"];
          },
        ];
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
      task_time: {
        Row: TaskTimeRow;
        Insert: TaskTimeInsert;
        Update: Partial<TaskTimeInsert>;
        Relationships: [
          {
            foreignKeyName: "task_time_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_time_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_time_persons: {
        Row: TaskTimePersonRow;
        Insert: TaskTimePersonInsert;
        Update: Partial<TaskTimePersonInsert>;
        Relationships: [
          {
            foreignKeyName: "task_time_persons_task_time_id_fkey";
            columns: ["task_time_id"];
            isOneToOne: false;
            referencedRelation: "task_time";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_time_persons_person_id_fkey";
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
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type ApiTokenRow = {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  last_four: string;
  expires_at: string;
  last_used_at: string | null;
  created_at: string;
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
  last_name: string | null;
  email: string | null;
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

export type BeliefRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type BeliefEndRow = {
  id: string;
  belief_id: string;
  end_id: string;
  created_at: string;
};

export type PortfolioRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  owner_type: string;
  owner_id: string;
  portfolio_type: string | null;
  created_at: string;
};

export type EndRow = {
  id: string;
  user_id: string;
  name: string;
  area_id: string | null;
  portfolio_id: string | null;
  end_type: string;
  state: string;
  due_date: string | null;
  thesis: string | null;
  resolution_notes: string | null;
  purpose: string | null;
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
  end_id: string | null;
  area_id: string | null;
  team_id: string | null;
  recurrence: string | null;
  duration_minutes: number | null;
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
  due_date: string | null;
  scheduled_date: string | null;
  estimated_duration_minutes: number | null;
  completed_at: string | null;
  recurrence: string | null;
  last_completed_at: string | null;
  next_due_at: string | null;
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

export type TaskTimeRow = {
  id: string;
  user_id: string;
  task_id: string;
  completed_at: string;
  actual_duration_minutes: number | null;
  notes: string | null;
  created_at: string;
};

export type TaskTimePersonRow = {
  id: string;
  task_time_id: string;
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
  timezone?: string;
  created_at?: string;
  updated_at?: string;
};

export type ApiTokenInsert = {
  id?: string;
  user_id: string;
  name: string;
  token_hash: string;
  last_four: string;
  expires_at: string;
  last_used_at?: string | null;
  created_at?: string;
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
  last_name?: string | null;
  email?: string | null;
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

export type BeliefInsert = {
  id?: string;
  user_id: string;
  name: string;
  description?: string | null;
  created_at?: string;
};

export type BeliefEndInsert = {
  id?: string;
  belief_id: string;
  end_id: string;
  created_at?: string;
};

export type PortfolioInsert = {
  id?: string;
  user_id: string;
  name: string;
  description?: string | null;
  owner_type: string;
  owner_id: string;
  portfolio_type?: string | null;
  created_at?: string;
};

export type EndInsert = {
  id?: string;
  user_id: string;
  name: string;
  area_id?: string | null;
  portfolio_id?: string | null;
  end_type?: string;
  state?: string;
  due_date?: string | null;
  thesis?: string | null;
  resolution_notes?: string | null;
  purpose?: string | null;
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
  end_id?: string | null;
  area_id?: string | null;
  team_id?: string | null;
  recurrence?: string | null;
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
  due_date?: string | null;
  scheduled_date?: string | null;
  estimated_duration_minutes?: number | null;
  completed_at?: string | null;
  recurrence?: string | null;
  last_completed_at?: string | null;
  next_due_at?: string | null;
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

export type TaskTimeInsert = {
  id?: string;
  user_id: string;
  task_id: string;
  completed_at?: string;
  actual_duration_minutes?: number | null;
  notes?: string | null;
  created_at?: string;
};

export type TaskTimePersonInsert = {
  id?: string;
  task_time_id: string;
  person_id: string;
  relation_type: string;
  created_at?: string;
};

export type EndSupportRow = {
  id: string;
  parent_end_id: string;
  child_end_id: string;
  rationale: string | null;
  created_at: string;
};

export type EndSupportInsert = {
  id?: string;
  parent_end_id: string;
  child_end_id: string;
  rationale?: string | null;
  created_at?: string;
};

// ============================================================================
// Convenience Aliases
// ============================================================================

export type Profile = ProfileRow;
export type ApiToken = ApiTokenRow;
export type Area = AreaRow;
export type Organization = OrganizationRow;
export type Team = TeamRow;
export type Person = PersonRow;
export type PersonTeam = PersonTeamRow;
export type Belief = BeliefRow;
export type BeliefEnd = BeliefEndRow;
export type Portfolio = PortfolioRow;
export type End = EndRow;
export type EndShare = EndShareRow;
export type EndSupport = EndSupportRow;
export type Habit = HabitRow;
export type HabitPerson = HabitPersonRow;
export type Action = ActionRow;
export type ActionPerson = ActionPersonRow;
export type Task = TaskRow;
export type TaskPerson = TaskPersonRow;
export type TaskTime = TaskTimeRow;
export type TaskTimePerson = TaskTimePersonRow;
