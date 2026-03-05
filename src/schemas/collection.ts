import { z } from "zod";

export const CollectionOwnerTypeSchema = z.enum([
  "organization",
  "team",
  "person",
]);
export type CollectionOwnerType = z.infer<typeof CollectionOwnerTypeSchema>;

export const CollectionTypeSchema = z.enum([
  "goals",
  "projects",
  "quarterly",
  "backlog",
  "operations",
  "other",
]);
export type CollectionType = z.infer<typeof CollectionTypeSchema>;

/**
 * Collection - a grouping of ends under an org, team, or person.
 * Enables the view: (org/team/person) -> collection -> ends -> habits.
 */
export const CollectionSchema = z.object({
  name: z.string().min(1, "Collection name is required"),
  ownerType: CollectionOwnerTypeSchema,
  ownerId: z.string().min(1, "Owner ID is required"),
  collectionType: CollectionTypeSchema.optional(),
  description: z.string().optional(),
});

export type Collection = z.infer<typeof CollectionSchema>;

export interface CollectionEntity extends Collection {
  id: string;
  createdAt: string;
}
