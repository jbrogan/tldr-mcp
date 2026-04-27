/**
 * tldr MCP Server — Stateless Cloudflare Worker
 *
 * Each request creates a fresh McpServer, registers tools, and handles the
 * MCP JSON-RPC message. No Durable Objects, no session state — every tool
 * call is self-contained (auth + Supabase query + response).
 *
 * The Worker handles auth (JWT / API token validation), OAuth discovery,
 * and delegates MCP requests to createMcpHandler from the Agents SDK.
 */

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { setStoreContext } from "./store/base.js";
import { setConfig } from "./config.js";
import { createClient } from "@supabase/supabase-js";
import skillContent from "../SKILL.md";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_SIGNING_KEY_JWK: string;
  ANTHROPIC_API_KEY: string;
}

// SKILL.md imported as a string at build time by wrangler's bundler
const skillInstructions: string | undefined = skillContent;

/**
 * Validate a Bearer token — either a Supabase JWT or a tldr API token.
 * Returns null if invalid.
 */
async function validateToken(
  token: string,
  env: Env,
): Promise<{ userId: string; accessToken: string } | null> {
  // Initialize config for store functions
  setConfig({
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseSigningKeyJwk: env.SUPABASE_SIGNING_KEY_JWK,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  });

  // API token path (tldr_live_*)
  if (token.startsWith("tldr_live_")) {
    try {
      const { findUserIdByToken } = await import("./store/apiTokens.js");
      const userId = await findUserIdByToken(token);
      if (!userId) return null;
      return { userId, accessToken: token };
    } catch {
      return null;
    }
  }

  // Supabase JWT path
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { userId: user.id, accessToken: token };
  } catch {
    return null;
  }
}

/**
 * Set up store context for an authenticated user so tool handlers
 * can access Supabase with the correct RLS scope.
 */
function setupStoreContext(auth: { userId: string; accessToken: string }, env: Env): void {
  let supabase;
  if (auth.accessToken.startsWith("tldr_live_")) {
    // API token — use service role client (RLS bypassed, filtered by userId in queries)
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } else {
    // Supabase JWT — user-scoped client with RLS
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${auth.accessToken}` } },
    });
  }
  setStoreContext({ supabase, userId: auth.userId });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // --- OAuth discovery endpoints (no auth) ---
    if (url.pathname === "/.well-known/oauth-protected-resource") {
      return Response.json({
        resource: url.origin,
        authorization_servers: [`${env.SUPABASE_URL}/auth/v1`],
        bearer_methods_supported: ["header"],
      });
    }

    if (url.pathname === "/.well-known/oauth-authorization-server") {
      try {
        const upstream = await fetch(
          `${env.SUPABASE_URL}/.well-known/oauth-authorization-server/auth/v1`,
        );
        if (!upstream.ok) throw new Error(`${upstream.status}`);
        const metadata = await upstream.json();
        return Response.json(metadata);
      } catch {
        return Response.json({ error: "Failed to fetch auth server metadata" }, { status: 502 });
      }
    }

    // --- Health check ---
    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    // --- OAuth consent proxy (requires auth) ---
    if (url.pathname.startsWith("/oauth/consent/")) {
      const authorizationId = url.pathname.split("/").pop();
      const bearer = request.headers.get("Authorization");
      if (!bearer?.startsWith("Bearer ")) {
        return unauthorizedResponse(url.origin);
      }

      const isPost = request.method === "POST";
      const pathSuffix = isPost ? "/consent" : "";
      const supabaseUrl = `${env.SUPABASE_URL}/auth/v1/oauth/authorizations/${encodeURIComponent(authorizationId!)}${pathSuffix}`;

      const headers: Record<string, string> = {
        Authorization: bearer,
        apikey: env.SUPABASE_ANON_KEY,
      };
      if (isPost) headers["Content-Type"] = "application/json";

      try {
        const upstream = await fetch(supabaseUrl, {
          method: request.method,
          headers,
          ...(isPost ? { body: await request.text() } : {}),
        });
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
        });
      } catch {
        return Response.json({ error: "Upstream fetch failed" }, { status: 502 });
      }
    }

    // --- MCP endpoint — stateless handler, fresh server per request ---
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      const bearer = request.headers.get("Authorization");
      if (!bearer?.startsWith("Bearer ")) {
        return unauthorizedResponse(url.origin);
      }
      const token = bearer.slice(7);
      const auth = await validateToken(token, env);
      if (!auth) {
        return unauthorizedResponse(url.origin);
      }

      // Set up store context for this request
      setupStoreContext(auth, env);

      // Fresh McpServer per request — stateless, no session tracking
      const server = new McpServer(
        { name: "tldr-mcp", version: "1.0.0" },
        {
          capabilities: { tools: {}, resources: {}, prompts: {} },
          instructions: skillInstructions,
        },
      );
      registerTools(server);

      const handler = createMcpHandler(server, { route: "/mcp" });
      return handler(request, env, ctx);
    }

    // --- API token management ---
    // TODO: Port /api/tokens endpoints

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function unauthorizedResponse(origin: string): Response {
  return new Response(JSON.stringify({ error: "Missing or invalid Authorization" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}
