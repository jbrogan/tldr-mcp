/**
 * Portfolios Store
 *
 * Manages portfolios (groupings of ends) for users.
 */

import { getSupabase, getUserId } from "./base.js";
import type { Portfolio, PortfolioOwnerType, PortfolioType } from "../schemas/portfolio.js";
import type { PortfolioEntity } from "../schemas/portfolio.js";
import type { Portfolio as DbPortfolio } from "../supabase/types.js";

/**
 * Convert database row to entity format
 */
function toEntity(row: DbPortfolio): PortfolioEntity {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    ownerType: row.owner_type as PortfolioOwnerType,
    ownerId: row.owner_id,
    portfolioType: (row.portfolio_type ?? undefined) as PortfolioType | undefined,
    createdAt: row.created_at,
  };
}

/**
 * Create a new portfolio.
 */
export async function createPortfolio(
  data: Portfolio
): Promise<PortfolioEntity> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data: created, error } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name: data.name,
      description: data.description,
      owner_type: data.ownerType,
      owner_id: data.ownerId,
      portfolio_type: data.portfolioType,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create portfolio: ${error.message}`);
  }

  return toEntity(created);
}

/**
 * Get a portfolio by ID.
 */
export async function getPortfolioById(
  id: string
): Promise<PortfolioEntity | undefined> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return undefined;
    }
    throw new Error(`Failed to get portfolio: ${error.message}`);
  }

  return data ? toEntity(data) : undefined;
}

/**
 * List portfolios with optional filters.
 */
export async function listPortfolios(options?: {
  ownerType?: string;
  ownerId?: string;
  portfolioType?: string;
}): Promise<PortfolioEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  let query = supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", userId);

  if (options?.ownerType) {
    query = query.eq("owner_type", options.ownerType as "organization" | "team" | "person");
  }
  if (options?.ownerId) {
    query = query.eq("owner_id", options.ownerId);
  }
  if (options?.portfolioType) {
    query = query.eq("portfolio_type", options.portfolioType);
  }

  const { data, error } = await query.order("name");

  if (error) {
    throw new Error(`Failed to list portfolios: ${error.message}`);
  }

  return (data ?? []).map(toEntity);
}

/**
 * Update a portfolio.
 */
export async function updatePortfolio(
  id: string,
  updates: Partial<Portfolio>
): Promise<PortfolioEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const existing = await getPortfolioById(id);
  if (!existing) {
    return null;
  }

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.ownerType !== undefined) updateData.owner_type = updates.ownerType;
  if (updates.ownerId !== undefined) updateData.owner_id = updates.ownerId;
  if (updates.portfolioType !== undefined) updateData.portfolio_type = updates.portfolioType;

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  const { data, error } = await supabase
    .from("portfolios")
    .update(updateData as Partial<import("../supabase/types.js").PortfolioInsert>)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update portfolio: ${error.message}`);
  }

  return data ? toEntity(data) : null;
}

/**
 * Delete a portfolio.
 */
export async function deletePortfolio(
  id: string
): Promise<PortfolioEntity | null> {
  const supabase = getSupabase();
  const userId = getUserId();

  const existing = await getPortfolioById(id);
  if (!existing) {
    return null;
  }

  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete portfolio: ${error.message}`);
  }

  return existing;
}
