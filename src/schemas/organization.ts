import { z } from "zod";

/**
 * Organization entity - a container for groups and people.
 * Top-level; not linked to an area.
 */
export const OrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
});

export type Organization = z.infer<typeof OrganizationSchema>;

export interface OrganizationEntity extends Organization {
  id: string;
  createdAt: string;
}
