import { z } from "zod";

/**
 * Area - Wheel of Life segment (you at the center).
 * Life areas for organizing ends, habits, and focus (e.g. Career, Family, Health).
 */
export const AreaSchema = z.object({
  name: z.string().min(1, "Area name is required"),
});

export type Area = z.infer<typeof AreaSchema>;

export interface AreaEntity extends Area {
  id: string;
  createdAt: string;
}

/** Default Wheel of Life areas (Zig Ziglar) */
export const DEFAULT_AREAS = [
  "Career",
  "Family",
  "Health",
  "Finances",
  "Spiritual",
  "Relationships",
  "Personal Growth",
  "Fun & Recreation",
  "Community",
  "Physical Environment",
] as const;
