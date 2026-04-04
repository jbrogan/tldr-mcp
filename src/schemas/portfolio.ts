import { z } from "zod";

export const PortfolioOwnerTypeSchema = z.enum([
  "organization",
  "team",
  "person",
]);
export type PortfolioOwnerType = z.infer<typeof PortfolioOwnerTypeSchema>;

export const PortfolioTypeSchema = z.enum([
  "goals",
  "projects",
  "quarterly",
  "backlog",
  "operations",
  "other",
]);
export type PortfolioType = z.infer<typeof PortfolioTypeSchema>;

/**
 * Portfolio - a grouping of ends under an org, team, or person.
 * Enables the view: (org/team/person) -> portfolio -> ends -> habits.
 */
export const PortfolioSchema = z.object({
  name: z.string().min(1, "Portfolio name is required"),
  ownerType: PortfolioOwnerTypeSchema,
  ownerId: z.string().min(1, "Owner ID is required"),
  portfolioType: PortfolioTypeSchema.optional(),
  description: z.string().optional(),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;

export interface PortfolioEntity extends Portfolio {
  id: string;
  createdAt: string;
}
