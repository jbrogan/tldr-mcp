/**
 * Supabase Client Module
 *
 * Provides Supabase client initialization and access.
 * The client is created lazily on first use to avoid initialization errors
 * when environment variables are not set.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Environment variables for Supabase configuration
 */
export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return { url, anonKey, serviceRoleKey };
}

/**
 * Check if Supabase is configured (has required environment variables)
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

/**
 * Get or create the Supabase client.
 * Uses the anon key for regular operations (RLS applies).
 *
 * @throws Error if Supabase is not configured
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseClient) return supabaseClient;

  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
    );
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
 * This allows operations to be performed as that user with RLS.
 */
export function createUserClient(accessToken: string): SupabaseClient<Database> {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
    );
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
 * Use only for admin operations like user creation, migrations, etc.
 */
export function getServiceRoleClient(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Service role client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
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
