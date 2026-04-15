/**
 * Actions Store
 *
 * Manages habit completions for users.
 * Uses action_persons junction table for with/for person relationships.
 * Actions are visible to users sharing the linked end (group visibility).
 */

import { getSupabase, getUserId } from "./base.js";
import { getUserTimezone, localDateToUtcRange, formatInstantForUser } from "../utils/timezone.js";
import type { Action } from "../schemas/action.js";
import type { ActionEntity } from "../schemas/action.js";
import type { Action as DbAction } from "../supabase/types.js";

/**
 * Resolve a user-local date range to UTC instant bounds for TIMESTAMPTZ queries.
 * Fetches the user's timezone once per call when a filter is present.
 */
async function resolveDateRangeToUtc(
  fromDate?: string,
  toDate?: string,
): Promise<{ fromUtc?: string; toUtcExclusive?: string }> {
  if (!fromDate && !toDate) return {};
  const tz = await getUserTimezone();
  return {
    fromUtc: fromDate ? localDateToUtcRange(fromDate, tz).startUtc : undefined,
    toUtcExclusive: toDate ? localDateToUtcRange(toDate, tz).endUtc : undefined,
  };
}

/**
 * Action row with person relationships joined
 */
interface ActionWithPersons extends DbAction {
  action_persons?: Array<{ person_id: string; relation_type: "with" | "for" }>;
}

/**
 * Action with owner info for shared context
 */
export interface ActionWithOwner extends ActionEntity {
  isShared?: boolean;
  ownerDisplayName?: string;
  ownerId?: string;
}

/**
 * Convert database row to entity format
 */
async function toEntity(row: ActionWithPersons): Promise<ActionEntity> {
  const tz = await getUserTimezone();
  const withPersonIds: string[] = [];
  const forPersonIds: string[] = [];

  for (const ap of row.action_persons ?? []) {
    if (ap.relation_type === "with") {
      withPersonIds.push(ap.person_id);
    } else {
      forPersonIds.push(ap.person_id);
    }
  }

  return {
    id: row.id,
    habitId: row.habit_id,
    completedAt: formatInstantForUser(row.completed_at, tz),
    actualDurationMinutes: row.actual_duration_minutes ?? undefined,
    notes: row.notes ?? undefined,
    withPersonIds: withPersonIds.length > 0 ? withPersonIds : undefined,
    forPersonIds: forPersonIds.length > 0 ? forPersonIds : undefined,
    createdAt: formatInstantForUser(row.created_at, tz),
  };
}

/**
 * Create a new action.
 */
export async function createAction(data: Action): Promise<ActionEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Insert action
  const { data: created, error } = await supabase
    .from("actions")
    .insert({
      user_id: userId,
      habit_id: data.habitId,
      completed_at: data.completedAt,
      actual_duration_minutes: data.actualDurationMinutes,
      notes: data.notes,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create action: ${error.message}`);
  }

  // Insert person relationships
  const personRelations: Array<{
    action_id: string;
    person_id: string;
    relation_type: "with" | "for";
  }> = [];

  for (const personId of data.withPersonIds ?? []) {
    personRelations.push({
      action_id: created.id,
      person_id: personId,
      relation_type: "with",
    });
  }

  for (const personId of data.forPersonIds ?? []) {
    personRelations.push({
      action_id: created.id,
      person_id: personId,
      relation_type: "for",
    });
  }

  if (personRelations.length > 0) {
    const { error: personError } = await supabase
      .from("action_persons")
      .insert(personRelations);

    if (personError) {
      throw new Error(`Failed to create action person relationships: ${personError.message}`);
    }
  }

  return {
    ...(await toEntity(created)),
    withPersonIds: data.withPersonIds,
    forPersonIds: data.forPersonIds,
  };
}

/**
 * List actions with optional filters.
 */
export async function listActions(options?: {
  habitId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<ActionEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  let query = supabase
    .from("actions")
    .select(
      `
      *,
      action_persons (*)
    `
    )
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  if (options?.habitId) {
    query = query.eq("habit_id", options.habitId);
  }

  const { fromUtc, toUtcExclusive } = await resolveDateRangeToUtc(options?.fromDate, options?.toDate);
  if (fromUtc) query = query.gte("completed_at", fromUtc);
  if (toUtcExclusive) query = query.lt("completed_at", toUtcExclusive);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list actions: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toEntity(row as ActionWithPersons)));
}

/**
 * List actions with owner info, including shared actions (group visibility).
 */
export async function listActionsWithShared(options?: {
  habitId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<ActionWithOwner[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  // RLS handles visibility - includes actions on habits linked to shared ends
  let query = supabase
    .from("actions")
    .select(
      `
      *,
      action_persons (*),
      profiles!actions_user_id_fkey (display_name)
    `
    )
    .order("completed_at", { ascending: false });

  if (options?.habitId) {
    query = query.eq("habit_id", options.habitId);
  }

  const { fromUtc, toUtcExclusive } = await resolveDateRangeToUtc(options?.fromDate, options?.toDate);
  if (fromUtc) query = query.gte("completed_at", fromUtc);
  if (toUtcExclusive) query = query.lt("completed_at", toUtcExclusive);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list actions: ${error.message}`);
  }

  return Promise.all((data ?? []).map(async (row) => {
    const action = row as ActionWithPersons & { profiles?: { display_name: string } };
    const isOwned = action.user_id === userId;

    return {
      ...(await toEntity(action)),
      isShared: !isOwned,
      ownerId: isOwned ? undefined : action.user_id,
      ownerDisplayName: isOwned ? undefined : action.profiles?.display_name,
    };
  }));
}

/**
 * Get an action by ID.
 */
export async function getActionById(id: string): Promise<ActionEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("actions")
    .select(`*, action_persons (*)`)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined;
    throw new Error(`Failed to get action: ${error.message}`);
  }

  return data ? await toEntity(data as ActionWithPersons) : undefined;
}

/**
 * Update an action.
 */
export async function updateAction(
  id: string,
  updates: {
    completedAt?: string;
    actualDurationMinutes?: number;
    notes?: string;
    withPersonIds?: string[];
    forPersonIds?: string[];
  }
): Promise<ActionEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const existing = await getActionById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
  if (updates.actualDurationMinutes !== undefined) updateData.actual_duration_minutes = updates.actualDurationMinutes;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("actions")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to update action: ${error.message}`);
    }
  }

  // Update person relationships if provided
  if (updates.withPersonIds !== undefined || updates.forPersonIds !== undefined) {
    await supabase.from("action_persons").delete().eq("action_id", id);

    const personRelations: Array<{
      action_id: string;
      person_id: string;
      relation_type: "with" | "for";
    }> = [];

    for (const personId of updates.withPersonIds ?? existing.withPersonIds ?? []) {
      personRelations.push({ action_id: id, person_id: personId, relation_type: "with" });
    }
    for (const personId of updates.forPersonIds ?? existing.forPersonIds ?? []) {
      personRelations.push({ action_id: id, person_id: personId, relation_type: "for" });
    }

    if (personRelations.length > 0) {
      const { error } = await supabase.from("action_persons").insert(personRelations);
      if (error) {
        throw new Error(`Failed to update action persons: ${error.message}`);
      }
    }
  }

  return (await getActionById(id)) ?? null;
}

/**
 * Delete actions by habit ID.
 */
export async function deleteActionsByHabitId(habitId: string): Promise<number> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Count first
  const { data: existing } = await supabase
    .from("actions")
    .select("id")
    .eq("habit_id", habitId)
    .eq("user_id", userId);

  const count = existing?.length ?? 0;
  if (count === 0) return 0;

  // Delete (cascade deletes action_persons)
  const { error } = await supabase
    .from("actions")
    .delete()
    .eq("habit_id", habitId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete actions: ${error.message}`);
  }

  return count;
}

/**
 * Delete a single action.
 */
export async function deleteAction(id: string): Promise<ActionEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get action to return it
  const { data: existing, error: getError } = await supabase
    .from("actions")
    .select(
      `
      *,
      action_persons (*)
    `
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (getError) {
    if (getError.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get action: ${getError.message}`);
  }

  if (!existing) return null;

  // Delete (cascade deletes action_persons)
  const { error } = await supabase
    .from("actions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete action: ${error.message}`);
  }

  return await toEntity(existing as ActionWithPersons);
}
