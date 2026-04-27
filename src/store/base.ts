/**
 * Store Base Context Module
 *
 * Provides context management for Supabase client and user authentication.
 * All store modules use this to get the current user's Supabase client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types.js";

/**
 * Store context containing the Supabase client and current user ID.
 * Set this before performing any store operations.
 */
export interface StoreContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  /** IANA timezone, lazily populated on first lookup per request. */
  timezone?: string;
}

// Global context — set by the Worker/DO before tool execution.
// In the DO model, each user has their own DO, so no concurrency risk.
let currentContext: StoreContext | null = null;

/**
 * Set the store context for the current request.
 */
export function setStoreContext(context: StoreContext): void {
  currentContext = context;
}

/**
 * Clear the store context.
 */
export function clearStoreContext(): void {
  currentContext = null;
}

/**
 * Get the current Supabase client.
 * @throws Error if no context is set
 */
export function getSupabase(): SupabaseClient<Database> {
  if (currentContext) {
    return currentContext.supabase;
  }

  throw new Error(
    "Store context not set. Call setStoreContext() with authenticated user before store operations."
  );
}

/**
 * Get the current user ID.
 * @throws Error if no context is set
 */
export function getUserId(): string {
  if (currentContext) {
    return currentContext.userId;
  }

  throw new Error(
    "Store context not set. Call setStoreContext() with authenticated user before store operations."
  );
}

/**
 * Get the active store context (for mutation of lazy-cached fields like timezone).
 * Returns null if no context is set.
 */
export function getActiveContext(): StoreContext | null {
  return currentContext;
}

/**
 * Check if a store context is currently set
 */
export function hasStoreContext(): boolean {
  return currentContext !== null;
}
