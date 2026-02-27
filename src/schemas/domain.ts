import { z } from "zod";

/**
 * Domain entity - Wheel of Life segment (you at the center).
 * Used for organizing organizations and people by life area.
 */
export const DomainSchema = z.object({
  name: z.string().min(1, "Domain name is required"),
});

export type Domain = z.infer<typeof DomainSchema>;

export interface DomainEntity extends Domain {
  id: string;
  createdAt: string;
}

/** Default Wheel of Life domains (Zig Ziglar) */
export const DEFAULT_DOMAINS = [
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
