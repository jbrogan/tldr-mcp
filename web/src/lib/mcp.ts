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
