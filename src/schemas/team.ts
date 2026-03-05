import { z } from "zod";

/**
 * Team - a sub-team within an organization (e.g., Engineering, Leadership, Kids).
 * People can belong to one or more teams.
 */
export const TeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  organizationId: z.string().min(1, "Organization is required"),
});

export type Team = z.infer<typeof TeamSchema>;

export interface TeamEntity extends Team {
  id: string;
  createdAt: string;
}
