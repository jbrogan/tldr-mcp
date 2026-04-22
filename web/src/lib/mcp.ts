import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const MCP_URL = import.meta.env.VITE_MCP_URL || "http://localhost:3000/mcp";

let client: Client | null = null;
let transport: StreamableHTTPClientTransport | null = null;

export async function connect(getAccessToken: () => Promise<string>): Promise<void> {
  if (client) {
    await disconnect();
  }

  // Custom fetch that always uses a fresh token
  const authFetch: typeof globalThis.fetch = async (input, init) => {
    const token = await getAccessToken();
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return globalThis.fetch(input, { ...init, headers });
  };

  transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    fetch: authFetch,
  });

  client = new Client(
    { name: "tldr-web", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
}

export async function disconnect(): Promise<void> {
  if (transport) {
    await transport.close();
  }
  client = null;
  transport = null;
}

export function isConnected(): boolean {
  return client !== null;
}

export interface ToolResult {
  text: string;
  isError: boolean;
}

/**
 * Call an MCP tool and return the raw text result.
 * For JSON responses, use callToolJson() instead.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  if (!client) {
    throw new Error("Not connected to MCP server");
  }

  const result = await client.request(
    { method: "tools/call", params: { name, arguments: args } },
    CallToolResultSchema
  );

  const text = result.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");

  return { text, isError: result.isError ?? false };
}

/**
 * Call an MCP tool and parse the JSON response.
 * Falls back to { text } if the response isn't valid JSON.
 */
export async function callToolJson<T = unknown>(
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ data: T; isError: boolean }> {
  const result = await callTool(name, args);
  if (result.isError) {
    return { data: { error: result.text } as T, isError: true };
  }
  try {
    return { data: JSON.parse(result.text) as T, isError: false };
  } catch {
    return { data: { text: result.text } as T, isError: false };
  }
}
