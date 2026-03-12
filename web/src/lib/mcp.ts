import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const MCP_URL = import.meta.env.VITE_MCP_URL || "http://localhost:3000/mcp";

let client: Client | null = null;
let transport: StreamableHTTPClientTransport | null = null;

export async function connect(accessToken: string): Promise<void> {
  if (client) {
    await disconnect();
  }

  transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
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
