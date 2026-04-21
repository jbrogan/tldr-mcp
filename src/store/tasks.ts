/**
 * Tasks Store
 *
 * Manages tasks for users — both one-off and recurring.
 * Uses task_persons junction table for with/for person relationships.
 */

import { getSupabase, getUserId } from "./base.js";
import { getUserTimezone, formatInstantForUser } from "../utils/timezone.js";
import { computeNextDueAt } from "../utils/recurrence.js";
import type { Task } from "../schemas/task.js";
import type { TaskEntity } from "../schemas/task.js";
import type { Task as DbTask } from "../supabase/types.js";

/**
 * Task row with person relationships joined
 */
interface TaskWithPersons extends DbTask {
  task_persons?: Array<{ person_id: string; relation_type: "with" | "for" }>;
}

/**
 * Convert database row to entity format
 */
async function toEntity(row: TaskWithPersons): Promise<TaskEntity> {
  const tz = await getUserTimezone();
  const withPersonIds: string[] = [];
  const forPersonIds: string[] = [];

  for (const tp of row.task_persons ?? []) {
    if (tp.relation_type === "with") {
      withPersonIds.push(tp.person_id);
    } else {
      forPersonIds.push(tp.person_id);
    }
  }

  return {
    id: row.id,
    name: row.name,
    endId: row.end_id ?? undefined,
    areaId: row.area_id ?? undefined,
    dueDate: row.due_date ?? undefined,
    scheduledDate: row.scheduled_date ?? undefined,
    estimatedDurationMinutes: row.estimated_duration_minutes ?? undefined,
    completedAt: row.completed_at ? formatInstantForUser(row.completed_at, tz) : undefined,
    recurrence: row.recurrence ?? undefined,
    lastCompletedAt: row.last_completed_at ? formatInstantForUser(row.last_completed_at, tz) : undefined,
    nextDueAt: row.next_due_at ? formatInstantForUser(row.next_due_at, tz) : undefined,
    notes: row.notes ?? undefined,
    withPersonIds: withPersonIds.length > 0 ? withPersonIds : undefined,
    forPersonIds: forPersonIds.length > 0 ? forPersonIds : undefined,
    createdAt: formatInstantForUser(row.created_at, tz),
  };
}

/**
 * Create a new task.
 */
export async function createTask(data: Task): Promise<TaskEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Compute next_due_at for recurring tasks (server-side fallback)
  let nextDueAt = data.nextDueAt ?? null;
  let lastCompletedAt: string | null = null;
  if (data.recurrence && !nextDueAt) {
    const refDate = data.completedAt ?? new Date().toISOString();
    nextDueAt = await computeNextDueAt(data.recurrence, refDate);
  }
  if (data.recurrence && data.completedAt) {
    lastCompletedAt = data.completedAt;
  }

  // Insert task
  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      name: data.name,
      end_id: data.endId,
      area_id: data.areaId,
      due_date: data.dueDate,
      scheduled_date: data.scheduledDate,
      estimated_duration_minutes: data.estimatedDurationMinutes,
      completed_at: data.recurrence ? null : data.completedAt, // recurring tasks stay open
      recurrence: data.recurrence ?? null,
      last_completed_at: lastCompletedAt,
      next_due_at: nextDueAt,
      notes: data.notes,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  // Insert person relationships
  const personRelations: Array<{
    task_id: string;
    person_id: string;
    relation_type: "with" | "for";
  }> = [];

  for (const personId of data.withPersonIds ?? []) {
    personRelations.push({
      task_id: created.id,
      person_id: personId,
      relation_type: "with",
    });
  }

  for (const personId of data.forPersonIds ?? []) {
    personRelations.push({
      task_id: created.id,
      person_id: personId,
      relation_type: "for",
    });
  }

  if (personRelations.length > 0) {
    const { error: personError } = await supabase
      .from("task_persons")
      .insert(personRelations);

    if (personError) {
      throw new Error(`Failed to create task person relationships: ${personError.message}`);
    }
  }

  return {
    ...(await toEntity(created)),
    withPersonIds: data.withPersonIds,
    forPersonIds: data.forPersonIds,
  };
}

/**
 * Get a task by ID.
 */
export async function getTaskById(id: string): Promise<TaskEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      task_persons (*)
    `
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get task: ${error.message}`);
  }

  return data ? await toEntity(data as TaskWithPersons) : undefined;
}

/**
 * Update a task.
 */
export async function updateTask(
  id: string,
  updates: Partial<
    Pick<
      TaskEntity,
      | "name"
      | "endId"
      | "areaId"
      | "withPersonIds"
      | "forPersonIds"
      | "dueDate"
      | "scheduledDate"
      | "estimatedDurationMinutes"
      | "completedAt"
      | "recurrence"
      | "nextDueAt"
      | "notes"
    >
  >
): Promise<TaskEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Check existence — need raw DB row for recurrence fields
  const { data: existingRow, error: getError } = await supabase
    .from("tasks")
    .select("*, task_persons (*)")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (getError) {
    if (getError.code === "PGRST116") return null;
    throw new Error(`Failed to get task: ${getError.message}`);
  }
  if (!existingRow) return null;

  const isRecurring = updates.recurrence !== undefined
    ? !!updates.recurrence
    : !!existingRow.recurrence;
  const recurrenceStr = updates.recurrence ?? existingRow.recurrence;

  // Prepare update data
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.endId !== undefined) updateData.end_id = updates.endId;
  if (updates.areaId !== undefined) updateData.area_id = updates.areaId;
  if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
  if (updates.scheduledDate !== undefined) updateData.scheduled_date = updates.scheduledDate;
  if (updates.estimatedDurationMinutes !== undefined) updateData.estimated_duration_minutes = updates.estimatedDurationMinutes;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.recurrence !== undefined) updateData.recurrence = updates.recurrence;

  // Handle completion — different behavior for recurring vs one-off
  if (updates.completedAt !== undefined) {
    if (isRecurring && updates.completedAt !== null && recurrenceStr) {
      // Recurring task completion: set last_completed_at, compute next_due_at, reopen
      updateData.last_completed_at = updates.completedAt;
      updateData.next_due_at = updates.nextDueAt
        ?? await computeNextDueAt(recurrenceStr, updates.completedAt);
      updateData.completed_at = null; // reopen
    } else {
      // Non-recurring or explicit reopen (null)
      updateData.completed_at = updates.completedAt;
    }
  }

  // Handle nextDueAt set directly (one-cycle override or recurrence change)
  if (updates.nextDueAt !== undefined && !("next_due_at" in updateData)) {
    updateData.next_due_at = updates.nextDueAt;
  }

  // Handle recurrence change — recompute next_due_at if not already set
  if (updates.recurrence !== undefined && !("next_due_at" in updateData)) {
    if (updates.recurrence) {
      const refDate = existingRow.last_completed_at ?? existingRow.created_at;
      updateData.next_due_at = await computeNextDueAt(updates.recurrence, refDate);
    } else {
      // Recurrence removed — clear recurring fields
      updateData.next_due_at = null;
      updateData.last_completed_at = null;
    }
  }

  // Update task if there are field changes
  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }
  }

  // Handle person relationship updates
  const needsPersonUpdate =
    updates.withPersonIds !== undefined || updates.forPersonIds !== undefined;

  if (needsPersonUpdate) {
    // Delete existing relationships
    const { error: deleteError } = await supabase
      .from("task_persons")
      .delete()
      .eq("task_id", id);

    if (deleteError) {
      throw new Error(`Failed to update task persons: ${deleteError.message}`);
    }

    // Insert new relationships
    const personRelations: Array<{
      task_id: string;
      person_id: string;
      relation_type: "with" | "for";
    }> = [];

    const existingEntity = await toEntity(existingRow as TaskWithPersons);
    const newWithPersonIds = updates.withPersonIds ?? existingEntity.withPersonIds ?? [];
    const newForPersonIds = updates.forPersonIds ?? existingEntity.forPersonIds ?? [];

    for (const personId of newWithPersonIds) {
      personRelations.push({
        task_id: id,
        person_id: personId,
        relation_type: "with",
      });
    }

    for (const personId of newForPersonIds) {
      personRelations.push({
        task_id: id,
        person_id: personId,
        relation_type: "for",
      });
    }

    if (personRelations.length > 0) {
      const { error: insertError } = await supabase
        .from("task_persons")
        .insert(personRelations);

      if (insertError) {
        throw new Error(`Failed to update task persons: ${insertError.message}`);
      }
    }
  }

  // Return updated task
  return (await getTaskById(id)) ?? null;
}

/**
 * List tasks with optional filters.
 */
export async function listTasks(options?: {
  endId?: string;
  areaId?: string;
  completed?: boolean;
  dueBy?: string;
}): Promise<TaskEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  let query = supabase
    .from("tasks")
    .select(
      `
      *,
      task_persons (*)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options?.endId) {
    query = query.eq("end_id", options.endId);
  }

  if (options?.areaId) {
    query = query.eq("area_id", options.areaId);
  }

  if (options?.completed !== undefined) {
    if (options.completed) {
      query = query.not("completed_at", "is", null);
    } else {
      query = query.is("completed_at", null);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list tasks: ${error.message}`);
  }

  let results = await Promise.all((data ?? []).map((row) => toEntity(row as TaskWithPersons)));

  // For open-task queries (completed === false or undefined):
  // Exclude recurring tasks whose next_due_at is in the future — they aren't
  // actionable yet. Include them if a dueBy window is specified and they fall within it.
  if (options?.completed !== true) {
    const now = new Date();
    results = results.filter((t) => {
      if (!t.recurrence || !t.nextDueAt) return true; // non-recurring or no next_due
      const nextDue = new Date(t.nextDueAt);
      if (options?.dueBy) {
        // Include if next_due_at <= dueBy
        const dueByDate = new Date(options.dueBy + "T23:59:59Z");
        return nextDue <= dueByDate;
      }
      // Default: only include if next_due_at <= now
      return nextDue <= now;
    });
  }

  return results;
}

/**
 * List tasks for a shared end — includes all users' tasks visible via RLS.
 */
export async function listTasksForEnd(endId: string, options?: {
  completed?: boolean;
}): Promise<(TaskEntity & { isShared?: boolean; ownerDisplayName?: string })[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  let query = supabase
    .from("tasks")
    .select(`
      *,
      task_persons (*),
      profiles!tasks_user_id_fkey (display_name)
    `)
    .eq("end_id", endId)
    .order("created_at", { ascending: false });

  if (options?.completed !== undefined) {
    if (options.completed) {
      query = query.not("completed_at", "is", null);
    } else {
      query = query.is("completed_at", null);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list tasks for end: ${error.message}`);
  }

  return Promise.all((data ?? []).map(async (row) => {
    const task = row as TaskWithPersons & { profiles?: { display_name: string } };
    const isOwned = task.user_id === userId;
    return {
      ...(await toEntity(task)),
      isShared: !isOwned,
      ownerDisplayName: task.profiles?.display_name,
    };
  }));
}

/**
 * Delete a task.
 */
export async function deleteTask(id: string): Promise<TaskEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get task to return it
  const existing = await getTaskById(id);
  if (!existing) {
    return null;
  }

  // Delete (cascade deletes task_persons)
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`);
  }

  return existing;
}
