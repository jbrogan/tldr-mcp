/**
 * API Tokens Store
 *
 * Manages long-lived API tokens for programmatic access to tldr-mcp.
 * Tokens are hashed before storage; the raw token is only returned once on creation.
 *
 * Uses the user-context Supabase client for user operations (list, create, delete)
 * and the service role client for auth lookups (findByHash) which must bypass RLS.
 */

import { randomBytes, createHash } from "node:crypto";
import { getSupabase, getUserId } from "./base.js";
import { getServiceRoleClient } from "../supabase/client.js";

export interface ApiTokenEntity {
  id: string;
  name: string;
  lastFour: string;
  expiresAt: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface ApiTokenCreated extends ApiTokenEntity {
  token: string; // Only returned on creation
}

const TOKEN_PREFIX = "tldr_live_";
const DEFAULT_EXPIRY_DAYS = 90;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("hex");
}

/**
 * Create a new API token. Returns the raw token (only time it's visible).
 */
export async function createApiToken(
  name: string,
  expiryDays: number = DEFAULT_EXPIRY_DAYS
): Promise<ApiTokenCreated> {
  const supabase = getSupabase();
  const userId = getUserId();

  const token = generateToken();
  const tokenHash = hashToken(token);
  const lastFour = token.slice(-4);
  const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString();

  const { data, error } = await supabase
    .from("api_tokens")
    .insert({
      user_id: userId,
      name,
      token_hash: tokenHash,
      last_four: lastFour,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create API token: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    lastFour: data.last_four,
    expiresAt: data.expires_at,
    lastUsedAt: data.last_used_at ?? undefined,
    createdAt: data.created_at,
    token,
  };
}

/**
 * List the current user's API tokens (without hashes).
 */
export async function listApiTokens(): Promise<ApiTokenEntity[]> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { data, error } = await supabase
    .from("api_tokens")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list API tokens: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    lastFour: row.last_four,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at ?? undefined,
    createdAt: row.created_at,
  }));
}

/**
 * Delete an API token by ID.
 */
export async function deleteApiToken(id: string): Promise<boolean> {
  const supabase = getSupabase();
  const userId = getUserId();

  const { error } = await supabase
    .from("api_tokens")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete API token: ${error.message}`);
  }

  return true;
}

/**
 * Look up an API token by raw token string. Used by auth middleware.
 * Bypasses RLS via service role client since no user context is set yet.
 * Returns the user_id if valid and not expired, otherwise null.
 */
export async function findUserIdByToken(rawToken: string): Promise<string | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const supabase = getServiceRoleClient();

  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, user_id, expires_at")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !data) {
    return null;
  }

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Update last_used_at (fire and forget)
  supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return data.user_id;
}

/**
 * Check if a string looks like an API token (vs a JWT).
 */
export function isApiToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}
