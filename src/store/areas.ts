/**
 * Areas Store
 *
 * Manages Wheel of Life areas for users.
 * Areas are auto-seeded when a user signs up via database trigger.
 */

import { getSupabase, getUserId } from "./base.js";
import { getUserTimezone, formatInstantForUser } from "../utils/timezone.js";
import type { AreaEntity } from "../schemas/area.js";
import type { Area as DbArea } from "../supabase/types.js";

async function toEntity(row: DbArea): Promise<AreaEntity> {
  const tz = await getUserTimezone();
  return {
    id: row.id,
    name: row.name,
    createdAt: formatInstantForUser(row.created_at, tz),
  };
}

/**
 * List all areas for the current user.
 * Areas are automatically seeded when a user profile is created.
 */
export async function listAreas(): Promise<AreaEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("areas")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw new Error(`Failed to list areas: ${error.message}`);
  }

  return Promise.all((data ?? []).map(toEntity));
}

/**
 * Get an area by ID.
 * Returns undefined if not found or not owned by current user.
 */
export async function getAreaById(id: string): Promise<AreaEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Don't filter by user_id — areas are standard categories and shared ends
  // reference the owner's area ID, which needs to be resolvable by shared users
  const { data, error } = await supabase
    .from("areas")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return undefined;
    }
    throw new Error(`Failed to get area: ${error.message}`);
  }

  return data ? await toEntity(data) : undefined;
}

/**
 * Create a custom area for the current user.
 * Note: Default areas are seeded automatically on signup.
 */
export async function createArea(name: string): Promise<AreaEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("areas")
    .insert({
      user_id: userId,
      name,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create area: ${error.message}`);
  }

  return toEntity(data);
}

/**
 * Update an area's name.
 */
export async function updateArea(
  id: string,
  name: string
): Promise<AreaEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("areas")
    .update({ name })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to update area: ${error.message}`);
  }

  return data ? await toEntity(data) : null;
}

/**
 * Delete an area.
 */
export async function deleteArea(id: string): Promise<AreaEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // First get the area to return it
  const existing = await getAreaById(id);
  if (!existing) {
    return null;
  }

  const { error } = await supabase
    .from("areas")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete area: ${error.message}`);
  }

  return existing;
}
