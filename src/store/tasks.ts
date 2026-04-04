/**
 * Tasks Store
 *
 * Manages one-off to-dos for users.
 * Uses task_persons junction table for with/for person relationships.
 */

import { getSupabase, getUserId } from "./base.js";
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
function toEntity(row: TaskWithPersons): TaskEntity {
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
    actualDurationMinutes: row.actual_duration_minutes ?? undefined,
    dueDate: row.due_date ?? undefined,
    completedAt: row.completed_at ?? undefined,
    notes: row.notes ?? undefined,
    withPersonIds: withPersonIds.length > 0 ? withPersonIds : undefined,
    forPersonIds: forPersonIds.length > 0 ? forPersonIds : undefined,
    createdAt: row.created_at,
  };
}

/**
 * Create a new task.
 */
export async function createTask(data: Task): Promise<TaskEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Insert task
  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      name: data.name,
      end_id: data.endId,
      area_id: data.areaId,
      actual_duration_minutes: data.actualDurationMinutes,
      due_date: data.dueDate,
      completed_at: data.completedAt,
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
    ...toEntity(created),
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

  return data ? toEntity(data as TaskWithPersons) : undefined;
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
      | "actualDurationMinutes"
      | "dueDate"
      | "completedAt"
      | "notes"
    >
  >
): Promise<TaskEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Check existence
  const existing = await getTaskById(id);
  if (!existing) {
    return null;
  }

  // Prepare update data
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.endId !== undefined) updateData.end_id = updates.endId;
  if (updates.areaId !== undefined) updateData.area_id = updates.areaId;
  if (updates.actualDurationMinutes !== undefined)
    updateData.actual_duration_minutes = updates.actualDurationMinutes;
  if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

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

    const newWithPersonIds = updates.withPersonIds ?? existing.withPersonIds ?? [];
    const newForPersonIds = updates.forPersonIds ?? existing.forPersonIds ?? [];

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

  return (data ?? []).map((row) => toEntity(row as TaskWithPersons));
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

  return (data ?? []).map((row) => {
    const task = row as TaskWithPersons & { profiles?: { display_name: string } };
    const isOwned = task.user_id === userId;
    return {
      ...toEntity(task),
      isShared: !isOwned,
      ownerDisplayName: task.profiles?.display_name,
    };
  });
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
