/**
 * Persons Store
 *
 * Manages people representations for users.
 * Uses person_teams junction table for team memberships.
 */

import { getSupabase, getUserId } from "./base.js";
import type { Person, RelationshipType } from "../schemas/person.js";
import type { PersonEntity } from "../schemas/person.js";
import type { Person as DbPerson, PersonTeam } from "../supabase/types.js";
import { listTeams } from "./teams.js";

/**
 * Person row with team IDs joined
 */
interface PersonWithTeams extends DbPerson {
  person_teams?: Array<{ team_id: string }>;
}

/**
 * Convert database row to entity format
 */
function toEntity(row: PersonWithTeams): PersonEntity {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ?? undefined,
    title: row.title ?? undefined,
    notes: row.notes ?? undefined,
    relationshipType: (row.relationship_type ?? undefined) as RelationshipType | undefined,
    teamIds: row.person_teams?.map((pt) => pt.team_id) ?? [],
    userId: row.linked_user_id ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Create a new person.
 */
export async function createPerson(data: Person): Promise<PersonEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Insert person
  const { data: created, error } = await supabase
    .from("persons")
    .insert({
      user_id: userId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone,
      title: data.title,
      notes: data.notes,
      relationship_type: data.relationshipType,
      linked_user_id: data.userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create person: ${error.message}`);
  }

  // Insert team memberships
  const teamIds = data.teamIds ?? [];
  if (teamIds.length > 0) {
    const { error: teamError } = await supabase.from("person_teams").insert(
      teamIds.map((teamId) => ({
        person_id: created.id,
        team_id: teamId,
      }))
    );

    if (teamError) {
      throw new Error(`Failed to create person team memberships: ${teamError.message}`);
    }
  }

  return {
    ...toEntity(created),
    teamIds,
  };
}

/**
 * Get a person by ID.
 */
export async function getPersonById(id: string): Promise<PersonEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("persons")
    .select(
      `
      *,
      person_teams (*)
    `
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get person: ${error.message}`);
  }

  return data ? toEntity(data as PersonWithTeams) : undefined;
}

/**
 * Returns the person with relationshipType "self" (the current user).
 * Used to resolve "me"/"I" in NL.
 */
export async function getSelfPerson(): Promise<PersonEntity | undefined> {
  const persons = await listPersons({ relationshipType: "self" });
  return persons[0];
}

/**
 * Removes a team from all persons' membership.
 * Call before deleting a team.
 * Note: With Supabase, the FK cascade handles this, but we keep the function
 * for compatibility.
 */
export async function removeTeamFromAllPersons(teamId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("person_teams")
    .delete()
    .eq("team_id", teamId);

  if (error) {
    throw new Error(`Failed to remove team from persons: ${error.message}`);
  }
}

export type PersonUpdate = Partial<Omit<Person, "teamIds">> & {
  teamIds?: string[];
  /** When provided, merges these team IDs with existing (add-only). Ignored if teamIds is also set. */
  teamIdsToAdd?: string[];
};

/**
 * Update a person.
 */
export async function updatePerson(
  id: string,
  updates: PersonUpdate
): Promise<PersonEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get existing person
  const existing = await getPersonById(id);
  if (!existing) {
    return null;
  }

  // Prepare update data (only include defined fields)
  const updateData: Record<string, unknown> = {};
  if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
  if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
  if (updates.email !== undefined) updateData.email = updates.email;
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  if (updates.relationshipType !== undefined) updateData.relationship_type = updates.relationshipType;
  if (updates.userId !== undefined) updateData.linked_user_id = updates.userId;

  // Update person if there are changes
  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("persons")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to update person: ${error.message}`);
    }
  }

  // Handle team ID updates
  let newTeamIds: string[];
  if (updates.teamIds !== undefined) {
    // Replace all team memberships
    newTeamIds = updates.teamIds;

    // Delete existing
    const { error: deleteError } = await supabase
      .from("person_teams")
      .delete()
      .eq("person_id", id);

    if (deleteError) {
      throw new Error(`Failed to update person teams: ${deleteError.message}`);
    }

    // Insert new
    if (newTeamIds.length > 0) {
      const { error: insertError } = await supabase.from("person_teams").insert(
        newTeamIds.map((teamId) => ({
          person_id: id,
          team_id: teamId,
        }))
      );

      if (insertError) {
        throw new Error(`Failed to update person teams: ${insertError.message}`);
      }
    }
  } else if (updates.teamIdsToAdd?.length) {
    // Add to existing team memberships
    const existingTeamIds = existing.teamIds ?? [];
    const toAdd = updates.teamIdsToAdd.filter((tid) => !existingTeamIds.includes(tid));

    if (toAdd.length > 0) {
      const { error: insertError } = await supabase.from("person_teams").insert(
        toAdd.map((teamId) => ({
          person_id: id,
          team_id: teamId,
        }))
      );

      if (insertError) {
        throw new Error(`Failed to add person to teams: ${insertError.message}`);
      }
    }

    newTeamIds = [...existingTeamIds, ...toAdd];
  } else {
    newTeamIds = existing.teamIds ?? [];
  }

  // Return updated person
  return (await getPersonById(id)) ?? null;
}

/**
 * Delete a person.
 */
export async function deletePerson(id: string): Promise<PersonEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get person to return it
  const existing = await getPersonById(id);
  if (!existing) {
    return null;
  }

  // Delete person (cascade deletes person_teams)
  const { error } = await supabase
    .from("persons")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete person: ${error.message}`);
  }

  return existing;
}

/**
 * List persons with optional filters.
 */
export async function listPersons(options?: {
  organizationId?: string;
  teamId?: string;
  relationshipType?: string;
}): Promise<PersonEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Base query with team IDs
  let query = supabase
    .from("persons")
    .select(
      `
      *,
      person_teams (*)
    `
    )
    .eq("user_id", userId);

  if (options?.relationshipType) {
    query = query.eq("relationship_type", options.relationshipType);
  }

  const { data, error } = await query.order("last_name").order("first_name");

  if (error) {
    throw new Error(`Failed to list persons: ${error.message}`);
  }

  let persons = (data ?? []).map((row) => toEntity(row as PersonWithTeams));

  // Filter by organization (persons in teams belonging to the org)
  if (options?.organizationId) {
    const teamsInOrg = await listTeams(options.organizationId);
    const teamIdsInOrg = new Set(teamsInOrg.map((t) => t.id));
    persons = persons.filter((p) => (p.teamIds ?? []).some((id) => teamIdsInOrg.has(id)));
  }

  // Filter by team
  if (options?.teamId) {
    persons = persons.filter((p) => (p.teamIds ?? []).includes(options.teamId!));
  }

  return persons;
}
