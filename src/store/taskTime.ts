/**
 * Task Time Store
 *
 * Manages work sessions logged against tasks.
 */

import { getSupabase, getUserId } from "./base.js";
import { getUserTimezone, localDateToUtcRange } from "../utils/timezone.js";
import type { TaskTime } from "../schemas/taskTime.js";
import type { TaskTimeEntity } from "../schemas/taskTime.js";

interface TaskTimeWithPersons {
  id: string;
  user_id: string;
  task_id: string;
  completed_at: string;
  actual_duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  task_time_persons?: Array<{
    person_id: string;
    relation_type: string;
  }>;
}

function toEntity(row: TaskTimeWithPersons): TaskTimeEntity {
  const withPersonIds: string[] = [];
  const forPersonIds: string[] = [];
  for (const p of row.task_time_persons ?? []) {
    if (p.relation_type === "with") withPersonIds.push(p.person_id);
    if (p.relation_type === "for") forPersonIds.push(p.person_id);
  }
  return {
    id: row.id,
    taskId: row.task_id,
    completedAt: row.completed_at,
    actualDurationMinutes: row.actual_duration_minutes ?? undefined,
    notes: row.notes ?? undefined,
    withPersonIds: withPersonIds.length > 0 ? withPersonIds : undefined,
    forPersonIds: forPersonIds.length > 0 ? forPersonIds : undefined,
    createdAt: row.created_at,
  };
}

/**
 * Create a task time record.
 */
export async function createTaskTime(data: TaskTime): Promise<TaskTimeEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data: created, error } = await supabase
    .from("task_time")
    .insert({
      user_id: userId,
      task_id: data.taskId,
      completed_at: data.completedAt,
      actual_duration_minutes: data.actualDurationMinutes,
      notes: data.notes,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task time: ${error.message}`);
  }

  // Insert person relationships
  const personRelations: Array<{
    task_time_id: string;
    person_id: string;
    relation_type: "with" | "for";
  }> = [];

  for (const personId of data.withPersonIds ?? []) {
    personRelations.push({
      task_time_id: created.id,
      person_id: personId,
      relation_type: "with",
    });
  }

  for (const personId of data.forPersonIds ?? []) {
    personRelations.push({
      task_time_id: created.id,
      person_id: personId,
      relation_type: "for",
    });
  }

  if (personRelations.length > 0) {
    const { error: personError } = await supabase
      .from("task_time_persons")
      .insert(personRelations);

    if (personError) {
      throw new Error(`Failed to create task time person relationships: ${personError.message}`);
    }
  }

  return {
    ...toEntity(created as TaskTimeWithPersons),
    withPersonIds: data.withPersonIds,
    forPersonIds: data.forPersonIds,
  };
}

/**
 * List task time records with optional filters.
 */
export async function listTaskTime(options?: {
  taskId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<TaskTimeEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  let query = supabase
    .from("task_time")
    .select(`
      *,
      task_time_persons (*)
    `)
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  if (options?.taskId) {
    query = query.eq("task_id", options.taskId);
  }

  if (options?.fromDate || options?.toDate) {
    const tz = await getUserTimezone();
    if (options?.fromDate) {
      query = query.gte("completed_at", localDateToUtcRange(options.fromDate, tz).startUtc);
    }
    if (options?.toDate) {
      query = query.lt("completed_at", localDateToUtcRange(options.toDate, tz).endUtc);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list task time: ${error.message}`);
  }

  return (data ?? []).map((row) => toEntity(row as TaskTimeWithPersons));
}

/**
 * Delete a task time record.
 */
export async function deleteTaskTime(id: string): Promise<TaskTimeEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data: existing, error: getError } = await supabase
    .from("task_time")
    .select(`*, task_time_persons (*)`)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (getError) {
    if (getError.code === "PGRST116") return null;
    throw new Error(`Failed to get task time: ${getError.message}`);
  }

  if (!existing) return null;

  const { error } = await supabase
    .from("task_time")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete task time: ${error.message}`);
  }

  return toEntity(existing as TaskTimeWithPersons);
}
