/**
 * Supabase Client Module
 *
 * Provides Supabase client initialization and access.
 * Reads config from the AppConfig singleton, not process.env.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";
import { getConfig } from "../config.js";

let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get Supabase configuration from the app config.
 */
export function getSupabaseConfig() {
  const config = getConfig();
  return {
    url: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
    serviceRoleKey: config.supabaseServiceRoleKey,
  };
}

/**
 * Check if Supabase is configured (has required config values)
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

/**
 * Get or create the Supabase client.
 * Uses the anon key for regular operations (RLS applies).
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseClient) return supabaseClient;

  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured.");
  }

  supabaseClient = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

/**
 * Create a Supabase client with a user's access token.
 */
export function createUserClient(accessToken: string): SupabaseClient<Database> {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured.");
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Create a Supabase client with service role key (bypasses RLS).
 */
export function getServiceRoleClient(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey) {
    throw new Error("Service role client not configured.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Reset the cached client (useful for testing)
 */
export function resetClient(): void {
  supabaseClient = null;
}
