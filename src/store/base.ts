/**
 * Store Base Context Module
 *
 * Provides context management for Supabase client and user authentication.
 * All store modules use this to get the current user's Supabase client.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types.js";
import {
  getSupabaseClient,
  getServiceRoleClient,
  createUserClient,
  isSupabaseConfigured,
} from "../supabase/client.js";

/**
 * Store context containing the Supabase client and current user ID.
 * Set this before performing any store operations.
 */
export interface StoreContext {
  supabase: SupabaseClient<Database>;
  userId: string;
}

// AsyncLocalStorage for concurrent multi-user context (HTTP mode)
const asyncContext = new AsyncLocalStorage<StoreContext>();

// Global context fallback for stdio mode (single user, no concurrency)
let currentContext: StoreContext | null = null;

/**
 * Set the store context for the current request.
 * Call this at the start of each MCP request after authentication.
 */
export function setStoreContext(context: StoreContext): void {
  currentContext = context;
}

/**
 * Clear the store context.
 * Call this after request completion.
 */
export function clearStoreContext(): void {
  currentContext = null;
}

/**
 * Get the current Supabase client.
 * Uses the context if set, otherwise falls back to base client.
 *
 * @throws Error if no context is set and Supabase is not configured
 */
export function getSupabase(): SupabaseClient<Database> {
  // Check AsyncLocalStorage first (HTTP multi-user mode)
  const asyncCtx = asyncContext.getStore();
  if (asyncCtx) {
    return asyncCtx.supabase;
  }

  // Fallback to global context (stdio single-user mode)
  if (currentContext) {
    return currentContext.supabase;
  }

  // Development mode: use service role client to bypass RLS
  // (anon key client has no auth.uid(), so RLS blocks everything)
  const devUserId = process.env.TLDR_DEV_USER_ID;
  if (devUserId && isSupabaseConfigured()) {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return getServiceRoleClient();
    }
    return getSupabaseClient();
  }

  throw new Error(
    "Store context not set. Call setStoreContext() with authenticated user before store operations."
  );
}

/**
 * Get the current user ID.
 *
 * @throws Error if no context is set and no dev user ID is configured
 */
export function getUserId(): string {
  // Check AsyncLocalStorage first (HTTP multi-user mode)
  const asyncCtx = asyncContext.getStore();
  if (asyncCtx) {
    return asyncCtx.userId;
  }

  // Fallback to global context (stdio single-user mode)
  if (currentContext) {
    return currentContext.userId;
  }

  // Development mode: check for dev user ID
  const devUserId = process.env.TLDR_DEV_USER_ID;
  if (devUserId) {
    return devUserId;
  }

  throw new Error(
    "Store context not set. Call setStoreContext() with authenticated user before store operations."
  );
}

/**
 * Check if a store context is currently set
 */
export function hasStoreContext(): boolean {
  return (
    asyncContext.getStore() !== undefined ||
    currentContext !== null ||
    Boolean(process.env.TLDR_DEV_USER_ID)
  );
}

/**
 * Run an async function with a store context bound via AsyncLocalStorage.
 * Use this in the HTTP server to bind per-request user context for concurrent safety.
 */
export function runWithContextAsync<T>(
  context: StoreContext,
  fn: () => Promise<T>
): Promise<T> {
  return asyncContext.run(context, fn);
}

/**
 * Create a store context from a user access token.
 * Validates the token and extracts user information.
 */
export async function createContextFromToken(
  accessToken: string
): Promise<StoreContext> {
  const supabase = createUserClient(accessToken);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(`Invalid or expired access token: ${error?.message}`);
  }

  return {
    supabase,
    userId: user.id,
  };
}

/**
 * Create a store context from an already-verified user ID (e.g., from an API token).
 *
 * Signs a short-lived JWT with a Supabase JWT signing key (ES256 via JWK)
 * so the resulting client has proper auth context and RLS works as expected.
 *
 * Requires SUPABASE_SIGNING_KEY_JWK env var — a JSON-encoded private JWK
 * from Supabase Dashboard → Authentication → JWT Keys.
 */
export async function createContextFromUserId(userId: string): Promise<StoreContext> {
  const signingKeyRaw = process.env.SUPABASE_SIGNING_KEY_JWK;
  if (!signingKeyRaw) {
    throw new Error("SUPABASE_SIGNING_KEY_JWK not configured — required for API token auth");
  }

  const { SignJWT, importJWK } = await import("jose");
  const url = process.env.SUPABASE_URL ?? "";
  const now = Math.floor(Date.now() / 1000);

  type JwkWithExtras = Record<string, unknown> & { kid?: string; alg?: string };
  const rawJwk = JSON.parse(signingKeyRaw) as JwkWithExtras;
  const kid = rawJwk.kid;
  const alg = (rawJwk.alg as string) || "ES256";

  // Strip non-signing fields that some Supabase CLI exports include.
  // `use`, `key_ops`, and `verify` can restrict what the key is allowed to do.
  // We're signing, so we remove these restrictions.
  const { use: _use, key_ops: _keyOps, verify: _verify, ...signingJwk } = rawJwk as JwkWithExtras & {
    use?: unknown;
    key_ops?: unknown;
    verify?: unknown;
  };
  void _use;
  void _keyOps;
  void _verify;

  const privateKey = await importJWK(signingJwk as Parameters<typeof importJWK>[0], alg);

  const token = await new SignJWT({
    role: "authenticated",
    aal: "aal1",
    session_id: randomSessionId(),
    is_anonymous: false,
  })
    .setProtectedHeader({ alg, ...(kid ? { kid } : {}), typ: "JWT" })
    .setIssuer(`${url}/auth/v1`)
    .setAudience("authenticated")
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + 2100) // 35 minutes — covers MCP session TTL (30 min)
    .sign(privateKey);

  const supabase = createUserClient(token);
  return { supabase, userId };
}

function randomSessionId(): string {
  // Simple UUID v4 via crypto
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Execute a function with a temporary store context.
 * Useful for operations that need a specific user context.
 */
export async function withContext<T>(
  context: StoreContext,
  fn: () => Promise<T>
): Promise<T> {
  const previousContext = currentContext;
  try {
    currentContext = context;
    return await fn();
  } finally {
    currentContext = previousContext;
  }
}

/**
 * Helper to run an operation with development user context.
 * Only works when TLDR_DEV_USER_ID is set.
 */
export function withDevContext<T>(fn: () => T): T {
  const devUserId = process.env.TLDR_DEV_USER_ID;
  if (!devUserId) {
    throw new Error(
      "Development user context not available. Set TLDR_DEV_USER_ID environment variable."
    );
  }

  const previousContext = currentContext;
  try {
    currentContext = {
      supabase: getSupabaseClient(),
      userId: devUserId,
    };
    return fn();
  } finally {
    currentContext = previousContext;
  }
}
