/**
 * tldr-mcp - MCP Server
 *
 * Multi-user MCP server with Supabase authentication.
 * Supports development mode via TLDR_DEV_USER_ID environment variable.
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import {
  setStoreContext,
  clearStoreContext,
  createContextFromToken,
} from "./store/base.js";
import {
  isSupabaseConfigured,
  getSupabaseClient,
  getServiceRoleClient,
} from "./supabase/client.js";

const server = new McpServer(
  {
    name: "tldr-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Register capabilities (add your implementations in each module)
registerTools(server);
registerResources(server);
registerPrompts(server);

/**
 * Initialize store context for requests.
 *
 * In development mode (TLDR_DEV_USER_ID set), uses the dev user ID.
 * In production, expects an auth token to be passed via request context.
 */
async function initializeContext(meta?: Record<string, unknown>): Promise<void> {
  const devUserId = process.env.TLDR_DEV_USER_ID;

  // Development mode: use dev user ID
  // Use service role client to bypass RLS (anon key has no auth.uid())
  if (devUserId) {
    if (isSupabaseConfigured()) {
      setStoreContext({
        supabase: process.env.SUPABASE_SERVICE_ROLE_KEY
          ? getServiceRoleClient()
          : getSupabaseClient(),
        userId: devUserId,
      });
    }
    return;
  }

  // Production mode: extract token from request meta
  const token = meta?.userToken as string | undefined;
  if (token) {
    const context = await createContextFromToken(token);
    setStoreContext(context);
    return;
  }

  // Check if Supabase is configured but no auth provided
  if (isSupabaseConfigured()) {
    console.error(
      "Warning: Supabase is configured but no auth token or TLDR_DEV_USER_ID provided. " +
        "Store operations may fail."
    );
  }
}

async function main() {
  const transport = new StdioServerTransport();

  // Log startup info
  console.error("tldr-mcp server starting...");

  // Check configuration
  if (isSupabaseConfigured()) {
    console.error("Supabase: configured");
    if (process.env.TLDR_DEV_USER_ID) {
      console.error(`Dev user: ${process.env.TLDR_DEV_USER_ID}`);
    }
  } else {
    console.error(
      "Warning: Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY."
    );
  }

  // Initialize context for development mode
  await initializeContext();

  await server.connect(transport);
  console.error("tldr-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
