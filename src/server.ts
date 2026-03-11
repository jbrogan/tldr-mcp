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
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:3001"];
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

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
  })
);

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", sessions: sessions.size });
});

// MCP endpoint — all methods (POST for messages, GET for SSE, DELETE for session close)
app.all(
  "/mcp",
  authMiddleware,
  express.json(),
  async (req: express.Request, res: express.Response) => {
    const context = req.storeContext!;

    // Check for existing session via header
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      // Existing session — update activity and handle request
      const session = sessions.get(sessionId)!;
      session.lastActivity = Date.now();

      await runWithContextAsync(session.context, () =>
        session.transport.handleRequest(req, res, req.body)
      );
      return;
    }

    if (sessionId && !sessions.has(sessionId)) {
      // Session ID provided but not found — expired or invalid
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    // New session — create per-session MCP server and transport
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

    // Handle the initialization request within the user's context
    await runWithContextAsync(context, () =>
      transport.handleRequest(req, res, req.body)
    );
  }
);

// --- Start ---

app.listen(PORT, () => {
  console.error(`tldr-mcp HTTP server listening on port ${PORT}`);
  console.error(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.error(`Session TTL: ${SESSION_TTL_MS / 1000}s`);
});
