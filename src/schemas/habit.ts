import { z } from "zod";

/**
 * Habit - a recurring behavior that serves an end. Generates actions that can be tracked.
 */
export const HabitSchema = z.object({
  name: z.string().min(1, "Habit name is required"),
  endId: z.string().describe("End this habit serves"),
  areaId: z.string().optional(),
  teamId: z.string().optional(),
  personIds: z.array(z.string()).optional().describe("People who participate in the habit"),
  recurrence: z.string().optional().describe("e.g. daily, weekly, 3x/week"),
  preferredDays: z.string().optional().describe("Natural language preferred days within recurrence cycle, e.g. 'M,W,F', 'weekdays', 'last Friday of the month'"),
  durationMinutes: z.number().int().positive().optional().describe("Estimated time in minutes to perform the habit"),
});

export type Habit = z.infer<typeof HabitSchema>;

export interface HabitEntity extends Habit {
  id: string;
  createdAt: string;
}
