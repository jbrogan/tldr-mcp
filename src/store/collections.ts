/**
 * Collections Store
 *
 * Manages collections (groupings of ends) for users.
 */

import { getSupabase, getUserId } from "./base.js";
import type { Collection, CollectionOwnerType, CollectionType } from "../schemas/collection.js";
import type { CollectionEntity } from "../schemas/collection.js";
import type { Collection as DbCollection } from "../supabase/types.js";

/**
 * Convert database row to entity format
 */
function toEntity(row: DbCollection): CollectionEntity {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    ownerType: row.owner_type as CollectionOwnerType,
    ownerId: row.owner_id,
    collectionType: (row.collection_type ?? undefined) as CollectionType | undefined,
    createdAt: row.created_at,
  };
}

/**
 * Create a new collection.
 */
export async function createCollection(
  data: Collection
): Promise<CollectionEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data: created, error } = await supabase
    .from("collections")
    .insert({
      user_id: userId,
      name: data.name,
      description: data.description,
      owner_type: data.ownerType,
      owner_id: data.ownerId,
      collection_type: data.collectionType,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create collection: ${error.message}`);
  }

  return toEntity(created);
}

/**
 * Get a collection by ID.
 */
export async function getCollectionById(
  id: string
): Promise<CollectionEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get collection: ${error.message}`);
  }

  return data ? toEntity(data) : undefined;
}

/**
 * List collections with optional filters.
 */
export async function listCollections(options?: {
  ownerType?: string;
  ownerId?: string;
  collectionType?: string;
}): Promise<CollectionEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  let query = supabase
    .from("collections")
    .select("*")
    .eq("user_id", userId);

  if (options?.ownerType) {
    query = query.eq("owner_type", options.ownerType as "organization" | "team" | "person");
  }
  if (options?.ownerId) {
    query = query.eq("owner_id", options.ownerId);
  }
  if (options?.collectionType) {
    query = query.eq("collection_type", options.collectionType);
  }

  const { data, error } = await query.order("name");

  if (error) {
    throw new Error(`Failed to list collections: ${error.message}`);
  }

  return (data ?? []).map(toEntity);
}

/**
 * Update a collection.
 */
export async function updateCollection(
  id: string,
  updates: Partial<Collection>
): Promise<CollectionEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Check existence
  const existing = await getCollectionById(id);
  if (!existing) {
    return null;
  }

  // Prepare update data
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.ownerType !== undefined) updateData.owner_type = updates.ownerType;
  if (updates.ownerId !== undefined) updateData.owner_id = updates.ownerId;
  if (updates.collectionType !== undefined) updateData.collection_type = updates.collectionType;

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  const { data, error } = await supabase
    .from("collections")
    .update(updateData as Partial<import("../supabase/types.js").CollectionInsert>)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update collection: ${error.message}`);
  }

  return data ? toEntity(data) : null;
}

/**
 * Delete a collection.
 */
export async function deleteCollection(
  id: string
): Promise<CollectionEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  // Get collection to return it
  const existing = await getCollectionById(id);
  if (!existing) {
    return null;
  }

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete collection: ${error.message}`);
  }

  return existing;
}
