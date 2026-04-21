import { z } from "zod";

/**
 * Task - a to-do item, either one-off or recurring.
 *
 * One-off tasks complete once and stay completed.
 * Recurring tasks (with `recurrence`) persist as a single record:
 * on completion, `last_completed_at` is set, `next_due_at` is recomputed
 * from the recurrence interval, and `completedAt` is cleared (reopened).
 *
 * Actual time is tracked via task_time entries, not on the task itself.
 */
export const TaskSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  endId: z.string().optional().describe("End this task supports"),
  areaId: z.string().optional().describe("Area this task belongs to"),
  withPersonIds: z.array(z.string()).optional().describe("Person IDs - did it with (shared experience)"),
  forPersonIds: z.array(z.string()).optional().describe("Person IDs - did it for (acts of service)"),
  dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
  scheduledDate: z.string().optional().describe("Scheduled work date (YYYY-MM-DD)"),
  estimatedDurationMinutes: z.number().int().positive().optional().describe("Estimated time to complete (minutes)"),
  completedAt: z.string().nullable().optional().describe("When completed (ISO string). Omit if open. Pass null to reopen."),
  recurrence: z.string().optional().describe("Natural language frequency (e.g. 'weekly', 'every 6 weeks', 'monthly')"),
  nextDueAt: z.string().optional().describe("Next due date for recurring tasks (ISO). Computed from recurrence; user-settable for one-cycle overrides."),
  notes: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export interface TaskEntity extends Task {
  id: string;
  lastCompletedAt?: string;
  createdAt: string;
}
