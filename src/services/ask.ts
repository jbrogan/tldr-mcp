/**
 * Ask service — conversational agent for open-ended queries.
 *
 * Uses Claude Agent SDK to wrap a subset of store operations as in-process
 * MCP tools, giving the agent access to the user's data with proper RLS.
 *
 * The agent runs within the existing store context (AsyncLocalStorage),
 * so all tool calls respect the authenticated user's scope.
 */

import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { listEnds, getEndById } from "../store/ends.js";
import { listHabitsWithShared, getHabitById } from "../store/habits.js";
import { listActions } from "../store/actions.js";
import { listTasks, getTaskById } from "../store/tasks.js";
import { listBeliefs } from "../store/beliefs.js";
import { listAreas, getAreaById } from "../store/areas.js";
import { listPortfolios } from "../store/portfolios.js";
import { listTaskTime } from "../store/taskTime.js";
import { listPersons, getPersonById } from "../store/persons.js";

const SYSTEM_PROMPT = `You are a thoughtful productivity assistant helping the user reflect on and manage their life through the tldr system.

The system organizes life into this hierarchy:
- Beliefs: core values that motivate everything (e.g. "Family comes first")
- Areas: 10 life domains (Career, Family, Health, etc.)
- Ends: ongoing aspirations within an area (e.g. "Be a great father")
- Habits: recurring behaviors that serve ends (e.g. "Weekly family dinner")
- Actions: logged completions of habits
- Tasks: one-off to-dos, optionally linked to ends
- Task Time: work sessions logged against tasks
- Portfolios: groupings of ends by organizational owner

Your role:
- Answer questions about the user's data using the tools available
- Help them reflect on patterns and progress
- Connect activities to higher-level beliefs and ends when relevant
- Be concise and practical — avoid lecturing
- When you don't have enough information, ask clarifying questions
- Never make up data — only report what you find via tools

Important guidelines for tool usage:
- When listing actions or task time without a specific date range from the user,
  default to the last 30 days. Use today's date to calculate the fromDate.
- For weekly reflection, use the last 7 days.
- Only query wider ranges when the user explicitly asks (e.g., "all time", "this year", "since I started").
- Date format: YYYY-MM-DD. Today's date is available in the conversation.

You have read-only access to the user's data. For actions like creating or updating entities,
tell the user to use commands like "create habit X" or "I did X for 30 minutes".`;

/**
 * Build the in-process MCP server exposing read-only tools to the agent.
 */
function buildToolsServer() {
  return createSdkMcpServer({
    name: "tldr",
    version: "1.0.0",
    tools: [
      tool(
        "list_ends",
        "List aspirations/ends. Optionally filter by area ID.",
        { areaId: z.string().optional() },
        async (args) => {
          const ends = await listEnds({ areaId: args.areaId, includeShared: true });
          return { content: [{ type: "text", text: JSON.stringify(ends, null, 2) }] };
        }
      ),
      tool(
        "get_end",
        "Get full details of a specific end by ID.",
        { id: z.string() },
        async (args) => {
          const end = await getEndById(args.id);
          return { content: [{ type: "text", text: JSON.stringify(end, null, 2) }] };
        }
      ),
      tool(
        "list_habits",
        "List habits. Optionally filter by end ID.",
        { endId: z.string().optional() },
        async (args) => {
          const habits = await listHabitsWithShared({ endId: args.endId });
          return { content: [{ type: "text", text: JSON.stringify(habits, null, 2) }] };
        }
      ),
      tool(
        "get_habit",
        "Get full details of a specific habit by ID.",
        { id: z.string() },
        async (args) => {
          const habit = await getHabitById(args.id);
          return { content: [{ type: "text", text: JSON.stringify(habit, null, 2) }] };
        }
      ),
      tool(
        "list_actions",
        "List habit actions (completions) within a date range. Dates in YYYY-MM-DD.",
        {
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
          habitId: z.string().optional(),
        },
        async (args) => {
          const actions = await listActions(args);
          return { content: [{ type: "text", text: JSON.stringify(actions, null, 2) }] };
        }
      ),
      tool(
        "list_tasks",
        "List tasks. Optionally filter by end ID, area ID, or completion status.",
        {
          endId: z.string().optional(),
          areaId: z.string().optional(),
          completed: z.boolean().optional(),
        },
        async (args) => {
          const tasks = await listTasks(args);
          return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
        }
      ),
      tool(
        "get_task",
        "Get full details of a specific task by ID.",
        { id: z.string() },
        async (args) => {
          const task = await getTaskById(args.id);
          return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
        }
      ),
      tool(
        "list_task_time",
        "List task time entries within a date range.",
        {
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
          taskId: z.string().optional(),
        },
        async (args) => {
          const entries = await listTaskTime(args);
          return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
        }
      ),
      tool(
        "list_beliefs",
        "List all core beliefs with their linked ends.",
        {},
        async () => {
          const beliefs = await listBeliefs();
          return { content: [{ type: "text", text: JSON.stringify(beliefs, null, 2) }] };
        }
      ),
      tool(
        "list_areas",
        "List all life areas (Wheel of Life categories).",
        {},
        async () => {
          const areas = await listAreas();
          return { content: [{ type: "text", text: JSON.stringify(areas, null, 2) }] };
        }
      ),
      tool(
        "get_area",
        "Get full details of a specific area by ID.",
        { id: z.string() },
        async (args) => {
          const area = await getAreaById(args.id);
          return { content: [{ type: "text", text: JSON.stringify(area, null, 2) }] };
        }
      ),
      tool(
        "list_portfolios",
        "List all portfolios (groupings of ends by organizational owner).",
        {},
        async () => {
          const portfolios = await listPortfolios();
          return { content: [{ type: "text", text: JSON.stringify(portfolios, null, 2) }] };
        }
      ),
      tool(
        "list_persons",
        "List all persons (people in the user's life).",
        {},
        async () => {
          const persons = await listPersons();
          return { content: [{ type: "text", text: JSON.stringify(persons, null, 2) }] };
        }
      ),
      tool(
        "get_person",
        "Get full details of a specific person by ID.",
        { id: z.string() },
        async (args) => {
          const person = await getPersonById(args.id);
          return { content: [{ type: "text", text: JSON.stringify(person, null, 2) }] };
        }
      ),
    ],
  });
}

/**
 * Run the agent on a user message and return the final response text.
 */
export async function ask(userMessage: string): Promise<string> {
  const toolsServer = buildToolsServer();
  const today = new Date().toISOString().slice(0, 10);
  const systemPromptWithDate = `${SYSTEM_PROMPT}\n\nToday's date: ${today}`;

  const responseParts: string[] = [];

  for await (const message of query({
    prompt: userMessage,
    options: {
      mcpServers: { tldr: toolsServer },
      allowedTools: [
        "mcp__tldr__list_ends",
        "mcp__tldr__get_end",
        "mcp__tldr__list_habits",
        "mcp__tldr__get_habit",
        "mcp__tldr__list_actions",
        "mcp__tldr__list_tasks",
        "mcp__tldr__get_task",
        "mcp__tldr__list_task_time",
        "mcp__tldr__list_beliefs",
        "mcp__tldr__list_areas",
        "mcp__tldr__get_area",
        "mcp__tldr__list_portfolios",
        "mcp__tldr__list_persons",
        "mcp__tldr__get_person",
      ],
      systemPrompt: systemPromptWithDate,
      // Disable all built-in tools
      tools: [],
      persistSession: false,
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      responseParts.push(message.result);
    }
  }

  return responseParts.join("\n") || "I couldn't process your question.";
}
