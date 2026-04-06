import { z } from "zod";

/**
 * Task Time — a work session logged against a task.
 */
export const TaskTimeSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  completedAt: z.string(),
  actualDurationMinutes: z.number().optional(),
  notes: z.string().optional(),
  withPersonIds: z.array(z.string()).optional(),
  forPersonIds: z.array(z.string()).optional(),
});

export type TaskTime = z.infer<typeof TaskTimeSchema>;

export interface TaskTimeEntity extends TaskTime {
  id: string;
  createdAt: string;
}
