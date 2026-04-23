/**
 * Ends Store
 *
 * Manages aspirations/goals for users.
 * Supports sharing ends with other users (read-only access).
 */

import { getSupabase, getUserId } from "./base.js";
import { getUserTimezone, formatInstantForUser } from "../utils/timezone.js";
import type { End } from "../schemas/end.js";
import type { EndEntity, EndType, EndState } from "../schemas/end.js";
import { isValidState, isValidTransition, validateEndFields } from "../schemas/end.js";
import type { End as DbEnd, EndShare, Profile } from "../supabase/types.js";

/**
 * End with owner info for shared ends
 */
export interface EndWithOwner extends EndEntity {
  isShared?: boolean;
  ownerDisplayName?: string;
  ownerId?: string;
}

/**
 * Share info
 */
export interface EndShareInfo {
  id: string;
  endId: string;
  endName: string;
  sharedByUserId: string;
  sharedByDisplayName: string;
  sharedWithUserId: string;
  sharedWithEmail: string;
  createdAt: string;
}

/**
 * Convert database row to entity format
 */
async function toEntity(row: DbEnd): Promise<EndEntity> {
  const tz = await getUserTimezone();
  return {
    id: row.id,
    name: row.name,
    areaId: row.area_id ?? undefined,
    portfolioId: row.portfolio_id ?? undefined,
    endType: (row.end_type ?? "journey") as EndType,
    state: (row.state ?? "active") as EndState,
    dueDate: row.due_date ?? undefined,
    thesis: row.thesis ?? undefined,
    resolutionNotes: row.resolution_notes ?? undefined,
    purpose: row.purpose ?? undefined,
    createdAt: formatInstantForUser(row.created_at, tz),
  };
}

/**
 * Create a new end.
 */
export async function createEnd(data: End): Promise<EndEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Validate type-specific fields
  const fieldError = validateEndFields(data.endType ?? "journey", {
    thesis: data.thesis,
    resolutionNotes: data.resolutionNotes,
  });
  if (fieldError) throw new Error(fieldError);

  // Validate initial state for the type
  const endType = data.endType ?? "journey";
  const state = data.state ?? "active";
  if (!isValidState(endType as EndType, state as EndState)) {
    throw new Error(`Invalid initial state '${state}' for end type '${endType}'`);
  }

  const { data: created, error } = await supabase
    .from("ends")
    .insert({
      user_id: userId,
      name: data.name,
      area_id: data.areaId,
      portfolio_id: data.portfolioId,
      end_type: endType,
      state,
      due_date: data.dueDate,
      thesis: data.thesis,
      purpose: data.purpose,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create end: ${error.message}`);
  }

  return toEntity(created);
}

/**
 * Get an end by ID (owned or shared).
 */
export async function getEndById(id: string): Promise<EndEntity | undefined> {
  const supabase = getSupabase();

  // RLS handles both owned and shared access
  const { data, error } = await supabase
    .from("ends")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get end: ${error.message}`);
  }

  return data ? await toEntity(data) : undefined;
}

/**
 * Update an end (only owner can update).
 */
export async function updateEnd(
  id: string,
  updates: Partial<
    Pick<
      EndEntity,
      "name" | "areaId" | "portfolioId" | "endType" | "state" | "dueDate" | "thesis" | "resolutionNotes" | "purpose"
    >
  >,
): Promise<EndEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Fetch current end for state validation
  const { data: current, error: getError } = await supabase
    .from("ends")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (getError) {
    if (getError.code === "PGRST116") return null;
    throw new Error(`Failed to get end: ${getError.message}`);
  }
  if (!current) return null;

  const endType = (updates.endType ?? current.end_type) as EndType;

  // If changing end type, validate the current state is valid for the new type.
  // If not, reset to 'active'. Clear inquiry-only fields when leaving inquiry.
  if (updates.endType !== undefined && updates.endType !== current.end_type) {
    if (!isValidState(endType, current.state as EndState)) {
      updates.state = "active";
    }
    if (updates.endType !== "inquiry") {
      updates.thesis = undefined;
      updates.resolutionNotes = undefined;
    }
  }

  // Validate state transition
  if (updates.state !== undefined) {
    const fromState = current.state as EndState;
    const toState = updates.state as EndState;

    if (!isValidState(endType, toState)) {
      throw new Error(
        `State '${toState}' is not valid for ${endType} ends`,
      );
    }
    if (!isValidTransition(endType, fromState, toState)) {
      throw new Error(
        `Cannot transition ${endType} end from '${fromState}' to '${toState}'`,
      );
    }
  }

  // Validate type-specific fields
  const fieldError = validateEndFields(endType, {
    thesis: updates.thesis ?? current.thesis ?? undefined,
    resolutionNotes: updates.resolutionNotes ?? current.resolution_notes ?? undefined,
  });
  if (fieldError) throw new Error(fieldError);

  // Prepare update data
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.areaId !== undefined) updateData.area_id = updates.areaId;
  if (updates.portfolioId !== undefined) updateData.portfolio_id = updates.portfolioId;
  if (updates.endType !== undefined) updateData.end_type = updates.endType;
  if (updates.state !== undefined) updateData.state = updates.state;
  if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
  if (updates.thesis !== undefined) updateData.thesis = updates.thesis;
  if (updates.resolutionNotes !== undefined) updateData.resolution_notes = updates.resolutionNotes;
  if (updates.purpose !== undefined) updateData.purpose = updates.purpose;

  if (Object.keys(updateData).length === 0) {
    return getEndById(id) as Promise<EndEntity | null>;
  }

  const { data, error } = await supabase
    .from("ends")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to update end: ${error.message}`);
  }

  return data ? await toEntity(data) : null;
}

/**
 * List ends with optional filters.
 * Can include shared ends.
 */
export async function listEnds(options?: {
  areaId?: string;
  portfolioId?: string;
  endType?: string;
  state?: string;
  includeShared?: boolean;
}): Promise<EndWithOwner[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get owned ends
  let query = supabase.from("ends").select("*").eq("user_id", userId);

  if (options?.areaId) {
    query = query.eq("area_id", options.areaId);
  }
  if (options?.portfolioId) {
    query = query.eq("portfolio_id", options.portfolioId);
  }
  if (options?.endType) {
    query = query.eq("end_type", options.endType);
  }
  if (options?.state) {
    query = query.eq("state", options.state);
  }

  const { data: ownedEnds, error: ownedError } = await query.order("name");

  if (ownedError) {
    throw new Error(`Failed to list ends: ${ownedError.message}`);
  }

  const results: EndWithOwner[] = await Promise.all((ownedEnds ?? []).map(async (row) => ({
    ...(await toEntity(row)),
    isShared: false,
  })));

  // Get shared ends if requested
  if (options?.includeShared) {
    const { data: shares, error: sharesError } = await supabase
      .from("end_shares")
      .select(
        `
        end_id,
        ends!inner (
          id,
          name,
          area_id,
          portfolio_id,
          end_type,
          state,
          due_date,
          thesis,
          resolution_notes,
          purpose,
          created_at,
          user_id,
          profiles!ends_user_id_fkey (display_name)
        )
      `
      )
      .eq("shared_with_user_id", userId);

    if (sharesError) {
      throw new Error(`Failed to list shared ends: ${sharesError.message}`);
    }

    for (const share of shares ?? []) {
      const end = share.ends as unknown as DbEnd & { profiles: Profile };
      if (!end) continue;

      // Apply filters to shared ends too
      if (options?.areaId && end.area_id !== options.areaId) continue;
      if (options?.portfolioId && end.portfolio_id !== options.portfolioId) continue;
      if (options?.endType && end.end_type !== options.endType) continue;
      if (options?.state && end.state !== options.state) continue;

      results.push({
        ...(await toEntity(end)),
        isShared: true,
        ownerId: end.user_id,
        ownerDisplayName: end.profiles?.display_name,
      });
    }
  }

  return results;
}

/**
 * Delete an end (only owner can delete).
 */
export async function deleteEnd(id: string): Promise<EndEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get end to return it (must be owner)
  const { data: existing, error: getError } = await supabase
    .from("ends")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (getError) {
    if (getError.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get end: ${getError.message}`);
  }

  if (!existing) return null;

  // Delete (cascade deletes shares, habit_ends)
  const { error } = await supabase
    .from("ends")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete end: ${error.message}`);
  }

  return await toEntity(existing);
}

// ============================================================================
// SHARING FUNCTIONS
// ============================================================================

/**
 * Share an end with another user by email.
 * Only the owner can share.
 */
export async function shareEnd(
  endId: string,
  sharedWithUserId: string
): Promise<EndShareInfo> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Verify ownership
  const end = await getEndById(endId);
  if (!end) {
    throw new Error("End not found");
  }

  const { data: owned } = await supabase
    .from("ends")
    .select("id")
    .eq("id", endId)
    .eq("user_id", userId)
    .single();

  if (!owned) {
    throw new Error("You can only share ends you own");
  }

  if (sharedWithUserId === userId) {
    throw new Error("Cannot share with yourself");
  }

  // Look up target profile for display info
  const { data: targetUser, error: userError } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .eq("id", sharedWithUserId)
    .single();

  if (userError || !targetUser) {
    throw new Error(`User not found with ID: ${sharedWithUserId}`);
  }

  // Create share
  const { data: share, error } = await supabase
    .from("end_shares")
    .insert({
      end_id: endId,
      shared_by_user_id: userId,
      shared_with_user_id: sharedWithUserId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("End is already shared with this user");
    }
    throw new Error(`Failed to share end: ${error.message}`);
  }

  const { data: sharer } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  const tz = await getUserTimezone();
  return {
    id: share.id,
    endId: endId,
    endName: end.name,
    sharedByUserId: userId,
    sharedByDisplayName: sharer?.display_name ?? "Unknown",
    sharedWithUserId: targetUser.id,
    sharedWithEmail: targetUser.email,
    createdAt: formatInstantForUser(share.created_at, tz),
  };
}

/**
 * Remove sharing of an end with a user.
 * Owner can unshare, or the shared user can remove themselves.
 */
export async function unshareEnd(
  endId: string,
  sharedWithUserId: string
): Promise<boolean> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Either the owner or the shared user can remove the share
  const { data: share } = await supabase
    .from("end_shares")
    .select("id, shared_by_user_id")
    .eq("end_id", endId)
    .eq("shared_with_user_id", sharedWithUserId)
    .single();

  if (!share) {
    return false;
  }

  // Check permission: must be owner or the shared user
  if (share.shared_by_user_id !== userId && sharedWithUserId !== userId) {
    throw new Error("You can only remove shares you created or that were shared with you");
  }

  const { error } = await supabase
    .from("end_shares")
    .delete()
    .eq("id", share.id);

  if (error) {
    throw new Error(`Failed to unshare end: ${error.message}`);
  }

  return true;
}

/**
 * List ends shared with the current user.
 */
export async function listSharedEnds(): Promise<EndWithOwner[]> {
  return listEnds({ includeShared: true }).then((ends) =>
    ends.filter((e) => e.isShared)
  );
}

/**
 * List shares the current user has created.
 */
export async function listMyShares(): Promise<EndShareInfo[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("end_shares")
    .select(
      `
      id,
      end_id,
      shared_with_user_id,
      created_at,
      ends!inner (name),
      profiles!end_shares_shared_with_user_id_fkey (email, display_name)
    `
    )
    .eq("shared_by_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list shares: ${error.message}`);
  }

  // Get current user's display name
  const { data: me } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  const tz = await getUserTimezone();
  return (data ?? []).map((row) => {
    const end = row.ends as unknown as { name: string };
    const sharedWith = row.profiles as unknown as { email: string; display_name: string };

    return {
      id: row.id,
      endId: row.end_id,
      endName: end?.name ?? "Unknown",
      sharedByUserId: userId,
      sharedByDisplayName: me?.display_name ?? "You",
      sharedWithUserId: row.shared_with_user_id,
      sharedWithEmail: sharedWith?.email ?? "Unknown",
      createdAt: formatInstantForUser(row.created_at, tz),
    };
  });
}

/**
 * Check if an end is accessible by the current user.
 */
export async function canAccessEnd(endId: string): Promise<boolean> {
  const end = await getEndById(endId);
  return end !== undefined;
}

/**
 * Check if the current user owns an end.
 */
export async function isEndOwner(endId: string): Promise<boolean> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data } = await supabase
    .from("ends")
    .select("id")
    .eq("id", endId)
    .eq("user_id", userId)
    .single();

  return data !== null;
}
