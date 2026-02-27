import { z } from "zod";

/**
 * Group - a sub-group within an organization (e.g., Engineering, Leadership, Kids).
 * People can belong to one or more groups.
 */
export const GroupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  organizationId: z.string().min(1, "Organization is required"),
});

export type Group = z.infer<typeof GroupSchema>;

export interface GroupEntity extends Group {
  id: string;
  createdAt: string;
}
