/**
 * MCP Resources - Read-only data accessible to clients
 *
 * Resources expose file-like data (URIs) that clients can read.
 * Use static URIs or ResourceTemplate for dynamic patterns.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerResources(server: McpServer): void {
  // Example: static resource
  // server.registerResource(
  //   "example",
  //   "example://static",
  //   { description: "Example static resource", mimeType: "text/plain" },
  //   async () => ({
  //     contents: [{ type: "text", text: "Static resource content" }],
  //   })
  // );

  // Example: dynamic resource with template (e.g. example://item/{id})
  // server.registerResource(
  //   "example-item",
  //   { uriTemplate: "example://item/{id}" },
  //   { description: "Example dynamic resource" },
  //   async (uri, { id }) => ({
  //     contents: [{ type: "text", text: `Content for id: ${id}` }],
  //   })
  // );

  // Add your resources here
}
