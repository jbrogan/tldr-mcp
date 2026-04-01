/**
 * Habits Store
 *
 * Manages recurring behaviors for users.
 * Uses habit_ends junction table for end relationships.
 * Uses habit_persons junction table for person relationships.
 * Habits can be viewed by users sharing any linked end.
 */

import { getSupabase, getUserId } from "./base.js";
import type { Habit } from "../schemas/habit.js";
import type { HabitEntity } from "../schemas/habit.js";
import type { Habit as DbHabit } from "../supabase/types.js";

/**
 * Habit row with end IDs and person IDs joined
 */
interface HabitWithJoins extends DbHabit {
  habit_ends?: Array<{ end_id: string }>;
  habit_persons?: Array<{ person_id: string }>;
}

/**
 * Habit with owner info for shared context
 */
export interface HabitWithOwner extends HabitEntity {
  isShared?: boolean;
  ownerDisplayName?: string;
  ownerId?: string;
}

/**
 * Convert database row to entity format
 */
function toEntity(row: HabitWithJoins): HabitEntity {
  return {
    id: row.id,
    name: row.name,
    endIds: row.habit_ends?.map((he) => he.end_id) ?? [],
    areaId: row.area_id ?? undefined,
    teamId: row.team_id ?? undefined,
    personIds: row.habit_persons?.map((hp) => hp.person_id) ?? [],
    frequency: row.frequency ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    createdAt: row.created_at,
  };
}

const HABIT_SELECT = `
  *,
  habit_ends (end_id),
  habit_persons (person_id)
`;

/**
 * Create a new habit.
 */
export async function createHabit(data: Habit): Promise<HabitEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Insert habit
  const { data: created, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name: data.name,
      area_id: data.areaId,
      team_id: data.teamId,
      frequency: data.frequency,
      duration_minutes: data.durationMinutes,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create habit: ${error.message}`);
  }

  // Insert end relationships
  const endIds = data.endIds ?? [];
  if (endIds.length > 0) {
    const { error: endError } = await supabase.from("habit_ends").insert(
      endIds.map((endId) => ({
        habit_id: created.id,
        end_id: endId,
      }))
    );

    if (endError) {
      throw new Error(`Failed to create habit end relationships: ${endError.message}`);
    }
  }

  // Insert person relationships
  const personIds = data.personIds ?? [];
  if (personIds.length > 0) {
    const { error: personError } = await supabase.from("habit_persons").insert(
      personIds.map((personId) => ({
        habit_id: created.id,
        person_id: personId,
      }))
    );

    if (personError) {
      throw new Error(`Failed to create habit person relationships: ${personError.message}`);
    }
  }

  return {
    ...toEntity(created),
    endIds,
    personIds,
  };
}

/**
 * Get a habit by ID.
 * RLS allows viewing habits on shared ends.
 */
export async function getHabitById(id: string): Promise<HabitEntity | undefined> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("habits")
    .select(HABIT_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get habit: ${error.message}`);
  }

  return data ? toEntity(data as HabitWithJoins) : undefined;
}

/**
 * List habits with optional filters.
 * RLS automatically includes habits on shared ends.
 */
export async function listHabits(options?: {
  endId?: string;
  areaId?: string;
  teamId?: string;
  personId?: string;
}): Promise<HabitEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get owned habits
  let query = supabase
    .from("habits")
    .select(HABIT_SELECT)
    .eq("user_id", userId);

  if (options?.areaId) {
    query = query.eq("area_id", options.areaId);
  }
  if (options?.teamId) {
    query = query.eq("team_id", options.teamId);
  }

  const { data, error } = await query.order("name");

  if (error) {
    throw new Error(`Failed to list habits: ${error.message}`);
  }

  let habits = (data ?? []).map((row) => toEntity(row as HabitWithJoins));

  // Filter by endId in memory (junction table)
  if (options?.endId) {
    habits = habits.filter((h) => h.endIds.includes(options.endId!));
  }

  // Filter by personId in memory (junction table)
  if (options?.personId) {
    habits = habits.filter((h) => h.personIds?.includes(options.personId!));
  }

  return habits;
}

/**
 * List habits with owner info, including shared habits.
 */
export async function listHabitsWithShared(options?: {
  endId?: string;
  areaId?: string;
}): Promise<HabitWithOwner[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get all accessible habits (RLS handles owned + shared)
  const { data, error } = await supabase
    .from("habits")
    .select(
      `
      *,
      habit_ends (end_id),
      habit_persons (person_id),
      profiles!habits_user_id_fkey (display_name)
    `
    )
    .order("name");

  if (error) {
    throw new Error(`Failed to list habits: ${error.message}`);
  }

  let habits: HabitWithOwner[] = (data ?? []).map((row) => {
    const habit = row as HabitWithJoins & { profiles?: { display_name: string } };
    const isOwned = habit.user_id === userId;

    return {
      ...toEntity(habit),
      isShared: !isOwned,
      ownerId: isOwned ? undefined : habit.user_id,
      ownerDisplayName: isOwned ? undefined : habit.profiles?.display_name,
    };
  });

  // Apply filters
  if (options?.areaId) {
    habits = habits.filter((h) => h.areaId === options.areaId);
  }
  if (options?.endId) {
    habits = habits.filter((h) => h.endIds.includes(options.endId!));
  }

  return habits;
}

/**
 * Delete a habit (only owner can delete).
 */
export async function deleteHabit(id: string): Promise<HabitEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get habit (must be owner)
  const { data: existing, error: getError } = await supabase
    .from("habits")
    .select(HABIT_SELECT)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (getError) {
    if (getError.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get habit: ${getError.message}`);
  }

  if (!existing) return null;

  // Delete (cascade deletes habit_ends, habit_persons, and actions)
  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete habit: ${error.message}`);
  }

  return toEntity(existing as HabitWithJoins);
}

/**
 * Update a habit's basic fields.
 */
export async function updateHabit(
  id: string,
  updates: { name?: string; frequency?: string; durationMinutes?: number }
): Promise<HabitEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const existing = await getHabitById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
  if (updates.durationMinutes !== undefined) updateData.duration_minutes = updates.durationMinutes;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("habits")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to update habit: ${error.message}`);
    }
  }

  return (await getHabitById(id)) ?? null;
}

/**
 * Add persons to a habit (merges with existing).
 */
export async function addHabitPersons(
  habitId: string,
  personIds: string[]
): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Verify ownership
  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", userId)
    .single();

  if (!habit) {
    throw new Error("Habit not found or not owned by you");
  }

  // Get existing person IDs to avoid duplicates
  const { data: existing } = await supabase
    .from("habit_persons")
    .select("person_id")
    .eq("habit_id", habitId);

  const existingIds = new Set((existing ?? []).map((r) => r.person_id));
  const toAdd = personIds.filter((pid) => !existingIds.has(pid));

  if (toAdd.length > 0) {
    const { error } = await supabase.from("habit_persons").insert(
      toAdd.map((personId) => ({
        habit_id: habitId,
        person_id: personId,
      }))
    );

    if (error) {
      throw new Error(`Failed to add persons to habit: ${error.message}`);
    }
  }
}

/**
 * Update habit end relationships.
 */
export async function updateHabitEnds(
  habitId: string,
  endIds: string[]
): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Verify ownership
  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", userId)
    .single();

  if (!habit) {
    throw new Error("Habit not found or not owned by you");
  }

  // Delete existing relationships
  const { error: deleteError } = await supabase
    .from("habit_ends")
    .delete()
    .eq("habit_id", habitId);

  if (deleteError) {
    throw new Error(`Failed to update habit ends: ${deleteError.message}`);
  }

  // Insert new relationships
  if (endIds.length > 0) {
    const { error: insertError } = await supabase.from("habit_ends").insert(
      endIds.map((endId) => ({
        habit_id: habitId,
        end_id: endId,
      }))
    );

    if (insertError) {
      throw new Error(`Failed to update habit ends: ${insertError.message}`);
    }
  }
}

/**
 * Update habit person relationships.
 */
export async function updateHabitPersons(
  habitId: string,
  personIds: string[]
): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Verify ownership
  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", habitId)
    .eq("user_id", userId)
    .single();

  if (!habit) {
    throw new Error("Habit not found or not owned by you");
  }

  // Delete existing relationships
  const { error: deleteError } = await supabase
    .from("habit_persons")
    .delete()
    .eq("habit_id", habitId);

  if (deleteError) {
    throw new Error(`Failed to update habit persons: ${deleteError.message}`);
  }

  // Insert new relationships
  if (personIds.length > 0) {
    const { error: insertError } = await supabase.from("habit_persons").insert(
      personIds.map((personId) => ({
        habit_id: habitId,
        person_id: personId,
      }))
    );

    if (insertError) {
      throw new Error(`Failed to update habit persons: ${insertError.message}`);
    }
  }
}
