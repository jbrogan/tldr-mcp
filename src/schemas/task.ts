import { z } from "zod";

/**
 * Task - an ad-hoc to-do item (e.g., "Call mom this week", "Get oil changed").
 * One-off or occasional, distinct from recurring habits.
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
  notes: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export interface TaskEntity extends Task {
  id: string;
  createdAt: string;
}
