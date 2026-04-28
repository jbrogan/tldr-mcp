/**
 * tldr MCP Server — Cloudflare Worker + McpAgent DO
 *
 * The Worker handles auth (JWT / API token validation), OAuth discovery,
 * CORS, API token management, and delegates MCP requests to McpAgent.serve()
 * which routes to per-session Durable Objects.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools/index.js";
import { setStoreContext } from "./store/base.js";
import { setConfig } from "./config.js";
import { createClient } from "@supabase/supabase-js";
import skillContent from "../SKILL.md";

interface Env {
  McpAgent: DurableObjectNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_SIGNING_KEY_JWK: string;
  ANTHROPIC_API_KEY: string;
}

type Props = {
  userId: string;
  accessToken: string;
  [key: string]: unknown;
};

// SKILL.md imported as a string at build time by wrangler's bundler
const skillInstructions: string | undefined = skillContent;

/**
 * Per-session MCP Agent Durable Object.
 * Maintains the MCP session (SSE streams, tool state) across requests.
 */
export class TldrMcpAgent extends McpAgent<Env, unknown, Props> {
  server = new McpServer(
    { name: "tldr-mcp", version: "1.0.0" },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: skillInstructions,
    },
  );

  async init() {
    setConfig({
      supabaseUrl: this.env.SUPABASE_URL,
      supabaseAnonKey: this.env.SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseSigningKeyJwk: this.env.SUPABASE_SIGNING_KEY_JWK,
      anthropicApiKey: this.env.ANTHROPIC_API_KEY,
    });

    const userId = this.props?.userId;
    const accessToken = this.props?.accessToken;

    if (userId && accessToken) {
      let supabase;
      if (accessToken.startsWith("tldr_live_")) {
        supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      } else {
        supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
        });
      }
      setStoreContext({ supabase, userId });
    }

    registerTools(this.server);
  }
}

/**
 * Validate a Bearer token — either a Supabase JWT or a tldr API token.
 * Returns null if invalid.
 */
async function validateToken(
  token: string,
  env: Env,
): Promise<{ userId: string; accessToken: string } | null> {
  setConfig({
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseSigningKeyJwk: env.SUPABASE_SIGNING_KEY_JWK,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  });

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
 * Set up store context for authenticated API token requests.
 */
function setupStoreContext(auth: { userId: string; accessToken: string }, env: Env): void {
  let supabase;
  if (auth.accessToken.startsWith("tldr_live_")) {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } else {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${auth.accessToken}` } },
    });
  }
  setStoreContext({ supabase, userId: auth.userId });
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, mcp-protocol-version, mcp-session-id",
};

// MCP handler — routes to per-session DOs via McpAgent.serve()
const mcpHandler = TldrMcpAgent.serve("/mcp", { binding: "McpAgent" });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // --- CORS preflight ---
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

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
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "application/json",
            ...CORS_HEADERS,
          },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Upstream fetch failed" }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    }

    // --- MCP endpoint — delegate to McpAgent.serve() (per-session DOs) ---
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

      // Pass user credentials via ctx.props — McpAgent.serve() forwards
      // these to the DO, where TldrMcpAgent.init() reads them.
      (ctx as any).props = { userId: auth.userId, accessToken: auth.accessToken };
      return mcpHandler.fetch(request, env, ctx);
    }

    // --- API token management ---
    if (url.pathname.startsWith("/api/tokens")) {
      const bearer = request.headers.get("Authorization");
      if (!bearer?.startsWith("Bearer ")) {
        return unauthorizedResponse(url.origin);
      }
      const token = bearer.slice(7);
      const auth = await validateToken(token, env);
      if (!auth) {
        return unauthorizedResponse(url.origin);
      }
      setupStoreContext(auth, env);

      const { listApiTokens, createApiToken, deleteApiToken } = await import("./store/apiTokens.js");

      try {
        if (url.pathname === "/api/tokens" && request.method === "GET") {
          const tokens = await listApiTokens();
          return Response.json({ tokens }, { headers: CORS_HEADERS });
        }

        if (url.pathname === "/api/tokens" && request.method === "POST") {
          const body = await request.json() as { name?: string };
          if (!body.name?.trim()) {
            return Response.json({ error: "name is required" }, { status: 400, headers: CORS_HEADERS });
          }
          const created = await createApiToken(body.name.trim());
          return Response.json({ token: created }, { status: 201, headers: CORS_HEADERS });
        }

        const deleteMatch = url.pathname.match(/^\/api\/tokens\/([^/]+)$/);
        if (deleteMatch && request.method === "DELETE") {
          await deleteApiToken(deleteMatch[1]);
          return Response.json({ ok: true }, { headers: CORS_HEADERS });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        return Response.json({ error: message }, { status: 500, headers: CORS_HEADERS });
      }

      return Response.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
    }

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
