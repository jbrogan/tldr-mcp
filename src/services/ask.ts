/**
 * Ask service — conversational agent for the web app chat.
 *
 * Uses Claude Agent SDK with the full MCP tool set registered in-process.
 * The same registerTools() function that powers the HTTP MCP server is
 * reused here, so tool parity is guaranteed — any new tool added to the
 * MCP server is immediately available to the agent.
 *
 * The agent runs within the existing store context (AsyncLocalStorage),
 * so all tool calls respect the authenticated user's scope via RLS.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools/index.js";
import { getUserTimezone, todayInTz } from "../utils/timezone.js";

const SYSTEM_PROMPT = `You are a thoughtful productivity assistant helping the user manage and reflect on their life through the tldr system.

The system organizes life into this hierarchy:
- Beliefs: core values that motivate everything (e.g. "Family comes first")
- Areas: 10 life domains (Career, Family, Health, etc.)
- Ends: ongoing aspirations within an area (e.g. "Be a great father")
- Habits: recurring behaviors that serve ends (e.g. "Weekly family dinner")
- Actions: logged completions of habits
- Tasks: one-off to-dos, optionally linked to ends
- Task Time: work sessions logged against tasks
- Portfolios: groupings of ends
- People: persons in the user's life, organized into teams and organizations

Your role:
- Answer questions about the user's data using the tools available
- Create, update, and track entities when the user asks
- Help them reflect on patterns and progress
- Connect activities to higher-level beliefs and ends when relevant
- Be concise and practical — avoid lecturing
- When you don't have enough information, ask clarifying questions
- Never make up data — only report what you find via tools

Guidelines for dates and time ranges:
- When listing actions or task time without a specific date range, default to the last 30 days.
- For weekly reflection, use the last 7 days.
- Only query wider ranges when the user explicitly asks.
- For completedAt fields, prefer "today" or "yesterday" over bare dates when appropriate.
- Date format: YYYY-MM-DD.`;

/**
 * Build an in-process MCP server with the full tool set.
 * Returns the config shape the Agent SDK expects.
 */
function buildToolsServer() {
  const server = new McpServer(
    { name: "tldr", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  registerTools(server);
  return { type: "sdk" as const, name: "tldr", instance: server };
}

/**
 * Run the agent on a user message and return the final response text.
 */
export async function ask(userMessage: string): Promise<string> {
  console.error(`[ask] starting: "${userMessage.slice(0, 80)}"`);

  const toolsServer = buildToolsServer();
  console.error(`[ask] tools server built: type=${toolsServer.type} name=${toolsServer.name}`);

  const tz = await getUserTimezone();
  const today = todayInTz(tz);
  const systemPromptWithDate = `${SYSTEM_PROMPT}\n\nToday's date: ${today} (user timezone: ${tz})`;

  const responseParts: string[] = [];

  try {
    for await (const message of query({
      prompt: userMessage,
      options: {
        mcpServers: { tldr: toolsServer },
        systemPrompt: systemPromptWithDate,
        canUseTool: async (toolName) => {
          console.error(`[ask] canUseTool called for: ${toolName}`);
          return { behavior: "allow" as const };
        },
        persistSession: false,
        model: "claude-sonnet-4-6",
        maxTurns: 10,
        effort: "medium",
      },
    })) {
      const subtype = "subtype" in message ? message.subtype : "n/a";
      console.error(`[ask] message: type=${message.type} subtype=${subtype}`);
      if (message.type === "result" && message.subtype === "success") {
        console.error(`[ask] result text: ${message.result.slice(0, 200)}`);
        responseParts.push(message.result);
      }
      if (message.type === "user") {
        const content = "content" in message ? JSON.stringify(message.content).slice(0, 300) : "n/a";
        console.error(`[ask] user message (tool result): ${content}`);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ask] error: ${msg}`);
    throw error;
  }

  const result = responseParts.join("\n") || "I couldn't process your question.";
  console.error(`[ask] done: ${result.slice(0, 100)}...`);
  return result;
}
