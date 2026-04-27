/**
 * tldr MCP Server — Cloudflare Worker + Durable Object
 *
 * Each user gets their own MCP agent DO, keyed by Supabase user ID.
 * The Worker handles auth (JWT validation), OAuth discovery, and
 * routes MCP requests to the per-user DO.
 *
 * The DO extends McpAgent, registering all 61 tools via the same
 * registerTools() function used by the Railway Express server.
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
 * Per-user MCP Agent Durable Object.
 * Extends McpAgent — handles MCP protocol, tool discovery, and sessions.
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
    // Initialize app config from Worker env bindings
    setConfig({
      supabaseUrl: this.env.SUPABASE_URL,
      supabaseAnonKey: this.env.SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseSigningKeyJwk: this.env.SUPABASE_SIGNING_KEY_JWK,
      anthropicApiKey: this.env.ANTHROPIC_API_KEY,
    });

    // Set up the store context so tool handlers can access Supabase
    // with the authenticated user's RLS scope.
    // Props may come from McpAgent props or URL params set by the Worker.
    const userId = this.props?.userId;
    const accessToken = this.props?.accessToken;

    if (userId && accessToken) {
      let supabase;
      if (accessToken.startsWith("tldr_live_")) {
        // API token — use service role client (RLS bypassed, filtered by userId in queries)
        supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      } else {
        // Supabase JWT — user-scoped client with RLS
        supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
        });
      }
      setStoreContext({ supabase, userId });
    }

    // Register all tools — same function as the Railway server
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
      // For API tokens, we use the service role client — the token itself
      // doesn't carry a JWT, so we pass it through as the accessToken
      // and the DO will create a service-role Supabase client.
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

// Use McpAgent.serve() for MCP protocol routing — handles session
// management, transport negotiation, and DO lifecycle automatically.
const mcpHandler = TldrMcpAgent.serve("/mcp", {
  binding: "McpAgent",
  corsOptions: {
    origin: "*",
    methods: "GET, POST, DELETE, OPTIONS",
    headers: "*",
  },
});

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

    // --- MCP endpoint — delegate to McpAgent.serve() handler ---
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      // Validate auth before passing to the MCP handler
      const bearer = request.headers.get("Authorization");
      if (!bearer?.startsWith("Bearer ")) {
        return unauthorizedResponse(url.origin);
      }
      const token = bearer.slice(7);
      // Clone request before auth validation — validateToken may consume resources,
      // and the MCP handler needs the original request body intact.
      const mcpRequest = request.clone();
      const auth = await validateToken(token, env);
      if (!auth) {
        return unauthorizedResponse(url.origin);
      }

      // McpAgent.serve() handles DO creation, session management, and transport
      return mcpHandler.fetch(mcpRequest, env, ctx);
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
