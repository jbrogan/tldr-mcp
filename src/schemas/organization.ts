import { z } from "zod";

/**
 * Organization entity - a group or org within a domain.
 * People are members of organizations.
 */
export const OrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  domainId: z.string().min(1, "Domain is required"),
});

export type Organization = z.infer<typeof OrganizationSchema>;

export interface OrganizationEntity extends Organization {
  id: string;
  createdAt: string;
}
