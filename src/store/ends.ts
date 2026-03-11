/**
 * Ends Store
 *
 * Manages aspirations/goals for users.
 * Supports sharing ends with other users (read-only access).
 */

import { getSupabase, getUserId } from "./base.js";
import type { End } from "../schemas/end.js";
import type { EndEntity } from "../schemas/end.js";
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
function toEntity(row: DbEnd): EndEntity {
  return {
    id: row.id,
    name: row.name,
    areaId: row.area_id ?? undefined,
    collectionId: row.collection_id ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Create a new end.
 */
export async function createEnd(data: End): Promise<EndEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data: created, error } = await supabase
    .from("ends")
    .insert({
      user_id: userId,
      name: data.name,
      area_id: data.areaId,
      collection_id: data.collectionId,
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

  return data ? toEntity(data) : undefined;
}

/**
 * Update an end (only owner can update).
 */
export async function updateEnd(
  id: string,
  updates: Partial<Pick<EndEntity, "name" | "areaId" | "collectionId">>
): Promise<EndEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Prepare update data
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.areaId !== undefined) updateData.area_id = updates.areaId;
  if (updates.collectionId !== undefined) updateData.collection_id = updates.collectionId;

  if (Object.keys(updateData).length === 0) {
    return getEndById(id) as Promise<EndEntity | null>;
  }

  const { data, error } = await supabase
    .from("ends")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId) // Only owner can update
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to update end: ${error.message}`);
  }

  return data ? toEntity(data) : null;
}

/**
 * List ends with optional filters.
 * Can include shared ends.
 */
export async function listEnds(options?: {
  areaId?: string;
  collectionId?: string;
  includeShared?: boolean;
}): Promise<EndWithOwner[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get owned ends
  let query = supabase.from("ends").select("*").eq("user_id", userId);

  if (options?.areaId) {
    query = query.eq("area_id", options.areaId);
  }
  if (options?.collectionId) {
    query = query.eq("collection_id", options.collectionId);
  }

  const { data: ownedEnds, error: ownedError } = await query.order("name");

  if (ownedError) {
    throw new Error(`Failed to list ends: ${ownedError.message}`);
  }

  const results: EndWithOwner[] = (ownedEnds ?? []).map((row) => ({
    ...toEntity(row),
    isShared: false,
  }));

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
          collection_id,
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
      if (options?.collectionId && end.collection_id !== options.collectionId) continue;

      results.push({
        ...toEntity(end),
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

  return toEntity(existing);
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
  sharedWithEmail: string
): Promise<EndShareInfo> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Verify ownership
  const end = await getEndById(endId);
  if (!end) {
    throw new Error("End not found");
  }

  // Check we own this end
  const { data: owned } = await supabase
    .from("ends")
    .select("id")
    .eq("id", endId)
    .eq("user_id", userId)
    .single();

  if (!owned) {
    throw new Error("You can only share ends you own");
  }

  // Find user to share with
  const { data: targetUser, error: userError } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .eq("email", sharedWithEmail)
    .single();

  if (userError || !targetUser) {
    throw new Error(`User not found with email: ${sharedWithEmail}`);
  }

  if (targetUser.id === userId) {
    throw new Error("Cannot share with yourself");
  }

  // Create share
  const { data: share, error } = await supabase
    .from("end_shares")
    .insert({
      end_id: endId,
      shared_by_user_id: userId,
      shared_with_user_id: targetUser.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation
      throw new Error("End is already shared with this user");
    }
    throw new Error(`Failed to share end: ${error.message}`);
  }

  // Get sharer info
  const { data: sharer } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  return {
    id: share.id,
    endId: endId,
    endName: end.name,
    sharedByUserId: userId,
    sharedByDisplayName: sharer?.display_name ?? "Unknown",
    sharedWithUserId: targetUser.id,
    sharedWithEmail: targetUser.email,
    createdAt: share.created_at,
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
      createdAt: row.created_at,
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
