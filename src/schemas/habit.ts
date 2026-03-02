import { z } from "zod";

/**
 * Habit - a recurring behavior that serves ends. Generates actions that can be tracked.
 */
export const HabitSchema = z.object({
  name: z.string().min(1, "Habit name is required"),
  endIds: z.array(z.string()).min(1, "At least one end is required"),
  domainId: z.string().optional(),
  groupId: z.string().optional(),
  personId: z.string().optional(),
  frequency: z.string().optional().describe("e.g. daily, weekly, 3x/week"),
  durationMinutes: z.number().int().positive().optional().describe("Estimated time in minutes to perform the habit"),
});

export type Habit = z.infer<typeof HabitSchema>;

export interface HabitEntity extends Habit {
  id: string;
  createdAt: string;
}
