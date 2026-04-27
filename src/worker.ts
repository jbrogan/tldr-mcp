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
import { setStoreContext, clearStoreContext } from "./store/base.js";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Env {
  McpAgent: DurableObjectNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_SIGNING_KEY_JWK: string;
}

type Props = {
  userId: string;
  accessToken: string;
  [key: string]: unknown;
};

// Load SKILL.md as MCP instructions
let skillInstructions: string | undefined;
try {
  skillInstructions = readFileSync(resolve(import.meta.dirname ?? ".", "../SKILL.md"), "utf8");
} catch {
  console.error("Warning: SKILL.md not found");
}

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
    // Set up the store context so tool handlers can access Supabase
    // with the authenticated user's RLS scope.
    const userId = this.props?.userId;
    const accessToken = this.props?.accessToken;

    if (userId && accessToken) {
      const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
      setStoreContext({ supabase, userId });
    }

    // Register all tools — same function as the Railway server
    registerTools(this.server);
  }
}

/**
 * Validate a Supabase JWT and extract the user ID.
 * Returns null if invalid.
 */
async function validateJwt(
  token: string,
  env: Env,
): Promise<{ userId: string } | null> {
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { userId: user.id };
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- OAuth discovery endpoints (no auth) ---
    if (url.pathname === "/.well-known/oauth-protected-resource") {
      const publicUrl = url.origin;
      return Response.json({
        resource: publicUrl,
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
      } catch (error) {
        return Response.json(
          { error: "Failed to fetch auth server metadata" },
          { status: 502 },
        );
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
        return new Response(JSON.stringify({ error: "Missing Authorization" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource"`,
          },
        });
      }

      const isPost = request.method === "POST";
      const pathSuffix = isPost ? "/consent" : "";
      const supabaseUrl = `${env.SUPABASE_URL}/auth/v1/oauth/authorizations/${encodeURIComponent(authorizationId!)}${pathSuffix}`;

      const headers: Record<string, string> = {
        Authorization: bearer,
        apikey: env.SUPABASE_ANON_KEY,
      };
      if (isPost) headers["Content-Type"] = "application/json";

      const init: RequestInit = {
        method: request.method,
        headers,
        ...(isPost ? { body: await request.text() } : {}),
      };

      try {
        const upstream = await fetch(supabaseUrl, init);
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
        });
      } catch {
        return Response.json({ error: "Upstream fetch failed" }, { status: 502 });
      }
    }

    // --- API token management (requires auth) ---
    // TODO: Port /api/tokens endpoints

    // --- MCP endpoint (requires auth) ---
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      const bearer = request.headers.get("Authorization");
      if (!bearer?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Missing Authorization" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource"`,
          },
        });
      }

      const token = bearer.slice(7);
      const auth = await validateJwt(token, env);
      if (!auth) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": `Bearer resource_metadata="${url.origin}/.well-known/oauth-protected-resource"`,
          },
        });
      }

      // Route to per-user MCP DO with user context as props
      const id = env.McpAgent.idFromName(auth.userId);
      const agent = env.McpAgent.get(id);
      // TODO: Pass props (userId, accessToken) to the DO
      return agent.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
