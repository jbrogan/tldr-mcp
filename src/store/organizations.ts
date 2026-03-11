/**
 * Organizations Store
 *
 * Manages organizations for users.
 */

import { getSupabase, getUserId } from "./base.js";
import type { Organization } from "../schemas/organization.js";
import type { OrganizationEntity } from "../schemas/organization.js";
import type { Organization as DbOrganization } from "../supabase/types.js";

/**
 * Convert database row to entity format
 */
function toEntity(row: DbOrganization): OrganizationEntity {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

/**
 * Create a new organization.
 */
export async function createOrganization(
  data: Organization
): Promise<OrganizationEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data: created, error } = await supabase
    .from("organizations")
    .insert({
      user_id: userId,
      name: data.name,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create organization: ${error.message}`);
  }

  return toEntity(created);
}

/**
 * Get an organization by ID.
 */
export async function getOrganizationById(
  id: string
): Promise<OrganizationEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get organization: ${error.message}`);
  }

  return data ? toEntity(data) : undefined;
}

/**
 * List all organizations for the current user.
 */
export async function listOrganizations(): Promise<OrganizationEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw new Error(`Failed to list organizations: ${error.message}`);
  }

  return (data ?? []).map(toEntity);
}

/**
 * Delete an organization.
 * Note: Teams will be cascade deleted by database FK constraint.
 */
export async function deleteOrganization(
  id: string
): Promise<OrganizationEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // First get the organization to return it
  const existing = await getOrganizationById(id);
  if (!existing) {
    return null;
  }

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete organization: ${error.message}`);
  }

  return existing;
}
