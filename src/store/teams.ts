/**
 * Teams Store
 *
 * Manages teams within organizations for users.
 */

import { getSupabase, getUserId } from "./base.js";
import type { Team } from "../schemas/team.js";
import type { TeamEntity } from "../schemas/team.js";
import type { Team as DbTeam } from "../supabase/types.js";

/**
 * Convert database row to entity format
 */
function toEntity(row: DbTeam): TeamEntity {
  return {
    id: row.id,
    name: row.name,
    organizationId: row.organization_id,
    createdAt: row.created_at,
  };
}

/**
 * Create a new team.
 */
export async function createTeam(data: Team): Promise<TeamEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data: created, error } = await supabase
    .from("teams")
    .insert({
      user_id: userId,
      name: data.name,
      organization_id: data.organizationId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create team: ${error.message}`);
  }

  return toEntity(created);
}

/**
 * Get a team by ID.
 */
export async function getTeamById(id: string): Promise<TeamEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get team: ${error.message}`);
  }

  return data ? toEntity(data) : undefined;
}

/**
 * List teams, optionally filtered by organization.
 */
export async function listTeams(organizationId?: string): Promise<TeamEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  let query = supabase
    .from("teams")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list teams: ${error.message}`);
  }

  return (data ?? []).map(toEntity);
}

/**
 * List teams by organization ID (alias for listTeams with organizationId).
 */
export async function listTeamsByOrganizationId(
  organizationId: string
): Promise<TeamEntity[]> {
  return listTeams(organizationId);
}

/**
 * Update a team.
 */
export async function updateTeam(
  id: string,
  updates: { name?: string }
): Promise<TeamEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const existing = await getTeamById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("teams")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to update team: ${error.message}`);
    }
  }

  return (await getTeamById(id)) ?? null;
}

/**
 * Delete a team.
 * Note: Person-team associations will be cascade deleted by database FK constraint.
 */
export async function deleteTeam(id: string): Promise<TeamEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // First get the team to return it
  const existing = await getTeamById(id);
  if (!existing) {
    return null;
  }

  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete team: ${error.message}`);
  }

  return existing;
}

/**
 * Delete all teams for an organization.
 * Returns the count of deleted teams.
 */
export async function deleteTeamsByOrganizationId(
  organizationId: string
): Promise<number> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get teams to count before deletion
  const teams = await listTeamsByOrganizationId(organizationId);
  if (teams.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("teams")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete teams: ${error.message}`);
  }

  return teams.length;
}
