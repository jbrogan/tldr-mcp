import { z } from "zod";

/**
 * Action - a tracked completion of a habit (e.g., "Practiced guitar on Feb 24").
 */
export const ActionSchema = z.object({
  habitId: z.string().min(1, "Habit ID is required"),
  completedAt: z.string().describe("ISO date when the habit was completed"),
  actualDurationMinutes: z.number().int().positive().optional().describe("Actual time spent in minutes"),
  notes: z.string().optional(),
});

export type Action = z.infer<typeof ActionSchema>;

export interface ActionEntity extends Action {
  id: string;
  createdAt: string;
}
