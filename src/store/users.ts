/**
 * Users Store
 *
 * Manages user profiles from Supabase Auth.
 * Users are automatically created when signing up via Supabase Auth.
 */

import { getSupabase, getUserId } from "./base.js";
import { getUserTimezone, formatInstantForUser } from "../utils/timezone.js";
import type { User } from "../schemas/user.js";
import type { UserEntity } from "../schemas/user.js";
import type { ProfileRow as Profile } from "../supabase/types.js";

/**
 * Convert database profile to user entity format
 */
async function toEntity(row: Profile): Promise<UserEntity> {
  const tz = await getUserTimezone();
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: formatInstantForUser(row.created_at, tz),
  };
}

/**
 * Update the current user's timezone.
 */
export async function updateUserTimezone(timezone: string): Promise<void> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { error } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", userId);

  if (error) {
    throw new Error(`Failed to update timezone: ${error.message}`);
  }
}

/**
 * Get the current user's profile.
 */
export async function getCurrentUser(): Promise<UserEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get current user: ${error.message}`);
  }

  return data ? await toEntity(data) : undefined;
}

/**
 * Get a user by ID.
 */
export async function getUserById(id: string): Promise<UserEntity | undefined> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return data ? await toEntity(data) : undefined;
}

/**
 * Get a user by email.
 */
export async function getUserByEmail(email: string): Promise<UserEntity | undefined> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get user by email: ${error.message}`);
  }

  return data ? await toEntity(data) : undefined;
}

/**
 * List all users.
 * Note: This returns all profiles visible to the current user (RLS applies).
 */
export async function listUsers(): Promise<UserEntity[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("display_name");

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }

  return Promise.all((data ?? []).map(toEntity));
}

/**
 * Update the current user's profile.
 */
export async function updateCurrentUser(
  updates: Partial<Pick<User, "displayName">>
): Promise<UserEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const updateData: Record<string, unknown> = {};
  if (updates.displayName !== undefined) updateData.display_name = updates.displayName;

  if (Object.keys(updateData).length === 0) {
    return getCurrentUser() as Promise<UserEntity | null>;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return data ? await toEntity(data) : null;
}

// Legacy functions for compatibility - these are now managed by Supabase Auth

/**
 * @deprecated Users are created via Supabase Auth signup.
 */
export async function createUser(_data: User): Promise<UserEntity> {
  throw new Error(
    "Users are created automatically via Supabase Auth signup. Use supabase.auth.signUp() instead."
  );
}

/**
 * @deprecated Users are managed by Supabase Auth.
 */
export async function deleteUser(_id: string): Promise<UserEntity | null> {
  throw new Error(
    "User deletion is managed by Supabase Auth. Use supabase.auth.admin.deleteUser() instead."
  );
}
