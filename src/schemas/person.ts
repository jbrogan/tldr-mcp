import { z } from "zod";

export const RelationshipTypeSchema = z.enum([
  "spouse",
  "child",
  "parent",
  "sibling",
  "friend",
  "colleague",
  "mentor",
  "client",
  "other",
]);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

/**
 * Person entity schema.
 * Used for validation when creating a person via the MCP tool.
 */
export const PersonSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  groupIds: z.array(z.string()).optional().default([]),
  relationshipType: RelationshipTypeSchema.optional(),
});

export type Person = z.infer<typeof PersonSchema>;

/**
 * Person entity with generated id and createdAt.
 * Returned after creation.
 */
export interface PersonEntity extends Person {
  id: string;
  createdAt: string;
}
