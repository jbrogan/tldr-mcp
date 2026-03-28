/**
 * Beliefs Store
 *
 * Manages core beliefs and their linkages to ends.
 */

import { getSupabase, getUserId } from "./base.js";
import type { Belief } from "../schemas/belief.js";
import type { BeliefEntity } from "../schemas/belief.js";
import type { Belief as DbBelief } from "../supabase/types.js";

interface BeliefWithEnds extends DbBelief {
  belief_ends?: Array<{ end_id: string }>;
}

function toEntity(row: BeliefWithEnds): BeliefEntity {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    endIds: row.belief_ends?.map((be) => be.end_id) ?? [],
    createdAt: row.created_at,
  };
}

/**
 * Create a new belief.
 */
export async function createBelief(data: Belief): Promise<BeliefEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data: created, error } = await supabase
    .from("beliefs")
    .insert({
      user_id: userId,
      name: data.name,
      description: data.description,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create belief: ${error.message}`);
  }

  return toEntity(created);
}

/**
 * Get a belief by ID.
 */
export async function getBeliefById(id: string): Promise<BeliefEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("beliefs")
    .select(`*, belief_ends (end_id)`)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return undefined;
    throw new Error(`Failed to get belief: ${error.message}`);
  }

  return data ? toEntity(data as BeliefWithEnds) : undefined;
}

/**
 * List all beliefs.
 */
export async function listBeliefs(): Promise<BeliefEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("beliefs")
    .select(`*, belief_ends (end_id)`)
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw new Error(`Failed to list beliefs: ${error.message}`);
  }

  return (data ?? []).map((row) => toEntity(row as BeliefWithEnds));
}

/**
 * Update a belief.
 */
export async function updateBelief(
  id: string,
  updates: { name?: string; description?: string }
): Promise<BeliefEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const existing = await getBeliefById(id);
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from("beliefs")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to update belief: ${error.message}`);
    }
  }

  return (await getBeliefById(id)) ?? null;
}

/**
 * Delete a belief.
 */
export async function deleteBelief(id: string): Promise<BeliefEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const existing = await getBeliefById(id);
  if (!existing) return null;

  const { error } = await supabase
    .from("beliefs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete belief: ${error.message}`);
  }

  return existing;
}

/**
 * Link an end to a belief.
 */
export async function linkEndToBelief(beliefId: string, endId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("belief_ends")
    .insert({ belief_id: beliefId, end_id: endId });

  if (error) {
    if (error.code === "23505") return; // unique constraint — already linked
    throw new Error(`Failed to link end to belief: ${error.message}`);
  }
}

/**
 * Unlink an end from a belief.
 */
export async function unlinkEndFromBelief(beliefId: string, endId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("belief_ends")
    .delete()
    .eq("belief_id", beliefId)
    .eq("end_id", endId);

  if (error) {
    throw new Error(`Failed to unlink end from belief: ${error.message}`);
  }
}
