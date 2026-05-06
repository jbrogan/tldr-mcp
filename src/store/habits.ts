/**
 * Habits Store
 *
 * Manages recurring behaviors for users.
 * Each habit serves a single end (end_id).
 * Uses habit_persons junction table for person relationships.
 * Habits can be viewed by users sharing the linked end.
 */

import { getSupabase, getUserId } from "./base.js";
import { getUserTimezone, formatInstantForUser, todayInTz, daysBetween } from "../utils/timezone.js";
import { getExpectedIntervalDays } from "../utils/recurrence.js";
import type { Habit } from "../schemas/habit.js";
import type { HabitEntity } from "../schemas/habit.js";
import type { Habit as DbHabit } from "../supabase/types.js";

/**
 * Habit row with person IDs joined
 */
interface HabitWithJoins extends DbHabit {
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
async function toEntity(row: HabitWithJoins): Promise<HabitEntity> {
  const tz = await getUserTimezone();
  const lastActionAt = row.last_action_at
    ? formatInstantForUser(row.last_action_at, tz)
    : null;
  const daysSinceLastAction = lastActionAt
    ? daysBetween(lastActionAt.slice(0, 10), todayInTz(tz))
    : null;
  return {
    id: row.id,
    name: row.name,
    endId: row.end_id ?? "",
    areaId: row.area_id ?? undefined,
    teamId: row.team_id ?? undefined,
    personIds: row.habit_persons?.map((hp) => hp.person_id) ?? [],
    recurrence: row.recurrence ?? undefined,
    preferredDays: row.preferred_days ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    createdAt: formatInstantForUser(row.created_at, tz),
    lastActionAt,
    daysSinceLastAction,
    expectedIntervalDays: row.expected_interval_days ?? null,
  };
}

const HABIT_SELECT = `
  *,
  habit_persons (person_id)
`;

/**
 * Fetch action counts in the last 30 days, grouped by habit_id.
 * Returns a map of habit_id -> count for the given habits.
 */
async function fetchActionCountsLast30Days(
  habitIds: string[],
): Promise<Record<string, number>> {
  if (habitIds.length === 0) return {};
  const supabase = getSupabase();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("actions")
    .select("habit_id")
    .in("habit_id", habitIds)
    .gte("completed_at", since);
  if (error) {
    console.error(`[habits] Failed to fetch 30-day action counts: ${error.message}`);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.habit_id] = (counts[row.habit_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Create a new habit.
 */
export async function createHabit(data: Habit): Promise<HabitEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  const expectedIntervalDays = await getExpectedIntervalDays(data.recurrence);

  // Insert habit with end_id directly
  const { data: created, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name: data.name,
      end_id: data.endId,
      area_id: data.areaId,
      team_id: data.teamId,
      recurrence: data.recurrence,
      preferred_days: data.preferredDays,
      duration_minutes: data.durationMinutes,
      expected_interval_days: expectedIntervalDays,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create habit: ${error.message}`);
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
    ...(await toEntity(created)),
    endId: data.endId,
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

  if (!data) return undefined;
  const habit = await toEntity(data as HabitWithJoins);
  const counts = await fetchActionCountsLast30Days([habit.id]);
  habit.actionCountLast30Days = counts[habit.id] ?? 0;
  return habit;
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

  if (options?.endId) {
    query = query.eq("end_id", options.endId);
  }
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

  let habits = await Promise.all((data ?? []).map((row) => toEntity(row as HabitWithJoins)));

  // Filter by personId in memory (junction table)
  if (options?.personId) {
    habits = habits.filter((h) => h.personIds?.includes(options.personId!));
  }

  const counts = await fetchActionCountsLast30Days(habits.map((h) => h.id));
  for (const h of habits) {
    h.actionCountLast30Days = counts[h.id] ?? 0;
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
  let query = supabase
    .from("habits")
    .select(
      `
      *,
      habit_persons (person_id),
      profiles!habits_user_id_fkey (display_name)
    `
    )
    .order("name");

  if (options?.endId) {
    query = query.eq("end_id", options.endId);
  }
  if (options?.areaId) {
    query = query.eq("area_id", options.areaId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list habits: ${error.message}`);
  }

  const habits = await Promise.all((data ?? []).map(async (row) => {
    const habit = row as HabitWithJoins & { profiles?: { display_name: string } };
    const isOwned = habit.user_id === userId;

    return {
      ...(await toEntity(habit)),
      isShared: !isOwned,
      ownerId: isOwned ? undefined : habit.user_id,
      ownerDisplayName: isOwned ? undefined : habit.profiles?.display_name,
    };
  }));

  const counts = await fetchActionCountsLast30Days(habits.map((h) => h.id));
  for (const h of habits) {
    h.actionCountLast30Days = counts[h.id] ?? 0;
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

  // Delete (cascade deletes habit_persons and actions)
  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete habit: ${error.message}`);
  }

  return await toEntity(existing as HabitWithJoins);
}

/**
 * Update a habit's basic fields including end association.
 */
export async function updateHabit(
  id: string,
  updates: { name?: string; endId?: string; recurrence?: string; preferredDays?: string; durationMinutes?: number }
): Promise<HabitEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const existing = await getHabitById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.endId !== undefined) updateData.end_id = updates.endId;
  if (updates.recurrence !== undefined) {
    updateData.recurrence = updates.recurrence;
    updateData.expected_interval_days = await getExpectedIntervalDays(updates.recurrence);
  }
  if (updates.preferredDays !== undefined) updateData.preferred_days = updates.preferredDays;
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
 * Remove persons from a habit.
 */
export async function removeHabitPersons(
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

  for (const personId of personIds) {
    const { error } = await supabase
      .from("habit_persons")
      .delete()
      .eq("habit_id", habitId)
      .eq("person_id", personId);

    if (error) {
      throw new Error(`Failed to remove person from habit: ${error.message}`);
    }
  }
}

/**
 * Update habit person relationships (replace all).
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
