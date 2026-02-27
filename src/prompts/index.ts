/**
 * MCP Prompts - Reusable templates for user interactions
 *
 * Prompts are pre-written templates that help users accomplish
 * specific tasks in a consistent way.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  // Example: simple prompt
  // server.registerPrompt(
  //   "example",
  //   {
  //     description: "Example prompt template",
  //     argsSchema: {
  //       topic: z.string().describe("Topic for the prompt"),
  //     },
  //   },
  //   async ({ topic }) => ({
  //     messages: [
  //       {
  //         role: "user",
  //         content: {
  //           type: "text",
  //           text: `Generate content about: ${topic}`,
  //         },
  //       },
  //     ],
  //   })
  // );

  // Add your prompts here
}
