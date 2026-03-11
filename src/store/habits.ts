/**
 * Habits Store
 *
 * Manages recurring behaviors for users.
 * Uses habit_ends junction table for end relationships.
 * Habits can be viewed by users sharing any linked end.
 */

import { getSupabase, getUserId } from "./base.js";
import type { Habit } from "../schemas/habit.js";
import type { HabitEntity } from "../schemas/habit.js";
import type { Habit as DbHabit } from "../supabase/types.js";

/**
 * Habit row with end IDs joined and owner info
 */
interface HabitWithEnds extends DbHabit {
  habit_ends?: Array<{ end_id: string }>;
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
function toEntity(row: HabitWithEnds): HabitEntity {
  return {
    id: row.id,
    name: row.name,
    endIds: row.habit_ends?.map((he) => he.end_id) ?? [],
    areaId: row.area_id ?? undefined,
    teamId: row.team_id ?? undefined,
    personId: row.person_id ?? undefined,
    frequency: row.frequency ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    createdAt: row.created_at,
  };
}

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
      person_id: data.personId,
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

  return {
    ...toEntity(created),
    endIds,
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
    .select(
      `
      *,
      habit_ends (end_id)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get habit: ${error.message}`);
  }

  return data ? toEntity(data as HabitWithEnds) : undefined;
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
    .select(
      `
      *,
      habit_ends (end_id)
    `
    )
    .eq("user_id", userId);

  if (options?.areaId) {
    query = query.eq("area_id", options.areaId);
  }
  if (options?.teamId) {
    query = query.eq("team_id", options.teamId);
  }
  if (options?.personId) {
    query = query.eq("person_id", options.personId);
  }

  const { data, error } = await query.order("name");

  if (error) {
    throw new Error(`Failed to list habits: ${error.message}`);
  }

  let habits = (data ?? []).map((row) => toEntity(row as HabitWithEnds));

  // Filter by endId in memory (junction table)
  if (options?.endId) {
    habits = habits.filter((h) => h.endIds.includes(options.endId!));
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
      profiles!habits_user_id_fkey (display_name)
    `
    )
    .order("name");

  if (error) {
    throw new Error(`Failed to list habits: ${error.message}`);
  }

  let habits: HabitWithOwner[] = (data ?? []).map((row) => {
    const habit = row as HabitWithEnds & { profiles?: { display_name: string } };
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
    .select(
      `
      *,
      habit_ends (end_id)
    `
    )
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

  // Delete (cascade deletes habit_ends and actions)
  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete habit: ${error.message}`);
  }

  return toEntity(existing as HabitWithEnds);
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
