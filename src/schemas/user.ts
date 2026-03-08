import { z } from "zod";

/**
 * User - an account holder who can log in and collaborate.
 * Distinct from Person: Person is a representation/context; User has an account.
 * When Person.userId is set, that Person is linked to this User.
 */
export const UserSchema = z.object({
  email: z.string().email("Invalid email address"),
  displayName: z.string().min(1, "Display name is required"),
});

export type User = z.infer<typeof UserSchema>;

export interface UserEntity extends User {
  id: string;
  createdAt: string;
}
