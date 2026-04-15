/**
 * tldr-mcp - HTTP Server Entry Point
 *
 * Express server exposing the MCP protocol over StreamableHTTP transport.
 * Each authenticated session gets its own transport with user context
 * bound via AsyncLocalStorage for concurrent multi-user safety.
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { authMiddleware } from "./middleware/auth.js";
import { runWithContextAsync, type StoreContext } from "./store/base.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:5173"];
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const PUBLIC_URL = process.env.PUBLIC_URL ?? "https://tldr-mcp-production.up.railway.app";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

// --- Per-session MCP server factory ---
// McpServer only supports one transport at a time, so each session gets its own instance.

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "tldr-mcp", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
  registerTools(server);
  registerResources(server);
  registerPrompts(server);
  return server;
}

// --- Session management ---

interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  context: StoreContext;
  lastActivity: number;
}

const sessions = new Map<string, Session>();

function cleanupSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      console.error(`Cleaning up expired session ${id}`);
      session.transport.close().catch(() => {});
      sessions.delete(id);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupSessions, 5 * 60 * 1000).unref();

// --- Express app ---

const app = express();

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    exposedHeaders: ["mcp-session-id"],
  })
);

// Parse JSON bodies for all routes
app.use(express.json());

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", sessions: sessions.size });
});

// --- OAuth discovery (no auth) ---
// RFC 9728: tells clients which authorization server(s) protect this resource.
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: PUBLIC_URL,
    authorization_servers: [`${SUPABASE_URL}/auth/v1`],
    bearer_methods_supported: ["header"],
  });
});

// RFC 8414: advertises the authorization server's OAuth capabilities.
// We proxy Supabase's metadata so Claude always sees whatever endpoints
// Supabase currently advertises (registration_endpoint in particular).
let cachedAuthMetadata: unknown | null = null;
app.get("/.well-known/oauth-authorization-server", async (_req, res) => {
  try {
    if (!cachedAuthMetadata) {
      const upstream = await fetch(
        `${SUPABASE_URL}/.well-known/oauth-authorization-server/auth/v1`,
      );
      if (!upstream.ok) {
        throw new Error(`Supabase metadata fetch returned ${upstream.status}`);
      }
      cachedAuthMetadata = await upstream.json();
    }
    res.json(cachedAuthMetadata);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(502).json({ error: `Failed to fetch auth server metadata: ${message}` });
  }
});

// Helper to handle MCP requests (shared by POST, GET, DELETE)
async function handleMcpRequest(req: express.Request, res: express.Response) {
  console.error(`[MCP] ${req.method} session=${req.headers["mcp-session-id"] || "none"} body=${JSON.stringify(req.body?.method || req.body)}`);
  const context = req.storeContext!;

  // Check for existing session via header
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    session.lastActivity = Date.now();

    // Use the fresh context from this request (handles token refresh for API tokens)
    await runWithContextAsync(context, () =>
      session.transport.handleRequest(req, res, req.body)
    );
    return;
  }

  if (sessionId && !sessions.has(sessionId)) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  // New session — only allowed for POST (initialize)
  // GET without session returns 405 so the MCP SDK client knows
  // standalone SSE streams aren't supported (it expects this per spec).
  if (req.method !== "POST") {
    res.status(405).set("Allow", "POST").json({ error: "Method not allowed" });
    return;
  }

  const sessionServer = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId) => {
      sessions.set(newSessionId, {
        transport,
        server: sessionServer,
        context,
        lastActivity: Date.now(),
      });
      console.error(`New session ${newSessionId} for user ${context.userId}`);
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
      console.error(`Session ${transport.sessionId} closed`);
    }
  };

  await sessionServer.connect(transport);

  await runWithContextAsync(context, () =>
    transport.handleRequest(req, res, req.body)
  );
}

// MCP endpoint — separate route registrations for each method
app.post("/mcp", authMiddleware, handleMcpRequest);
app.get("/mcp", authMiddleware, handleMcpRequest);
app.delete("/mcp", authMiddleware, handleMcpRequest);

// --- OAuth consent proxy ---
// Supabase's OAuth consent endpoints reject browser-side calls on
// origin/referer mismatch (documented limitation). We proxy from the server
// with explicit Origin/Referer headers matching the configured Site URL,
// forwarding the caller's Bearer (Supabase JWT) through unchanged.
async function proxyOAuthConsent(req: express.Request, res: express.Response) {
  const rawId = req.params.authorizationId;
  const authorizationId = Array.isArray(rawId) ? rawId[0] : rawId;
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: "Supabase env not configured" });
    return;
  }

  const isPost = req.method === "POST";
  const pathSuffix = isPost ? "/consent" : "";
  const url = `${SUPABASE_URL}/auth/v1/oauth/authorizations/${encodeURIComponent(authorizationId)}${pathSuffix}`;

  // Supabase's validateRequestOrigin accepts empty Origin as a backend-
  // originated request and only enforces the allow-list if Origin is present.
  // Do NOT set Origin/Referer here — they'd be validated against the Redirect
  // URLs allow-list (which is for OAuth client callbacks, not this domain).
  const headers: Record<string, string> = {
    Authorization: bearer,
    apikey: SUPABASE_ANON_KEY,
  };
  if (isPost) headers["Content-Type"] = "application/json";

  const init: RequestInit = {
    method: req.method,
    headers,
    ...(isPost && req.body ? { body: JSON.stringify(req.body) } : {}),
  };

  try {
    const upstream = await fetch(url, init);
    const body = await upstream.text();
    res
      .status(upstream.status)
      .type(upstream.headers.get("content-type") ?? "application/json")
      .send(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream fetch failed";
    res.status(502).json({ error: message });
  }
}

app.get("/oauth/consent/:authorizationId", proxyOAuthConsent);
app.post("/oauth/consent/:authorizationId", proxyOAuthConsent);

// --- API token management ---
// These endpoints require Supabase JWT auth (not API tokens, to prevent
// tokens from creating or deleting themselves).
app.get("/api/tokens", authMiddleware, async (req, res) => {
  try {
    const { listApiTokens } = await import("./store/apiTokens.js");
    const tokens = await runWithContextAsync(req.storeContext!, () => listApiTokens());
    res.json({ tokens });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list tokens";
    res.status(500).json({ error: message });
  }
});

app.post("/api/tokens", authMiddleware, async (req, res) => {
  try {
    const { name, expiryDays } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const { createApiToken } = await import("./store/apiTokens.js");
    const token = await runWithContextAsync(req.storeContext!, () =>
      createApiToken(name, typeof expiryDays === "number" ? expiryDays : undefined)
    );
    res.json({ token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create token";
    res.status(500).json({ error: message });
  }
});

app.delete("/api/tokens/:id", authMiddleware, async (req, res) => {
  try {
    const { deleteApiToken } = await import("./store/apiTokens.js");
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await runWithContextAsync(req.storeContext!, () => deleteApiToken(id));
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete token";
    res.status(500).json({ error: message });
  }
});

// --- Start ---

app.listen(PORT, () => {
  console.error(`tldr-mcp HTTP server listening on port ${PORT}`);
  console.error(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.error(`Session TTL: ${SESSION_TTL_MS / 1000}s`);
});
