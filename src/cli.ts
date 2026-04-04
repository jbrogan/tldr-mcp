#!/usr/bin/env node
/**
 * CLI for calling the tldr-mcp server.
 * Spawns the MCP server and connects to it via stdio.
 */

import "dotenv/config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getServerPath(): string {
  // When running from dist/cli.js, server is at dist/index.js
  return join(__dirname, "index.js");
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [getServerPath()],
    cwd: join(__dirname, ".."),
  });

  const client = new Client(
    { name: "tldr-mcp-cli", version: "0.1.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

const program = new Command();

program
  .name("tldr-mcp")
  .description("CLI for the tldr-mcp MCP server")
  .version("0.1.0");

program
  .command("list-tools")
  .description("List available MCP tools")
  .action(async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools();
      if (tools.length === 0) {
        console.log("No tools available.");
        return;
      }
      console.log("Available tools:\n");
      for (const tool of tools) {
        console.log(`  ${tool.name}`);
        if (tool.description) console.log(`    ${tool.description}`);
        const required = tool.inputSchema?.required ?? [];
        if (required.length > 0) {
          console.log(`    Required: ${required.join(", ")}`);
        }
        console.log();
      }
    });
  });

program
  .command("list-areas")
  .description("List Wheel of Life areas")
  .action(async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_areas",
        arguments: {},
      });
      printToolResult(result);
    });
  });

program
  .command("list-ends-and-habits")
  .description("List ends and habits. Use -a for area or -c for portfolio (mutually exclusive). Omit both for all areas.")
  .option("-a, --areaId <id>", "Filter to a specific area")
  .option("-c, --portfolioId <id>", "Filter to a specific portfolio")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.areaId) args.areaId = opts.areaId;
      if (opts.portfolioId) args.portfolioId = opts.portfolioId;
      const result = await client.callTool({
        name: "list_ends_and_habits",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("create-organization")
  .description("Create an organization (container for teams and people)")
  .requiredOption("-n, --name <name>", "Organization name")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "create_organization",
        arguments: { name: opts.name },
      });
      printToolResult(result);
    });
  });

program
  .command("delete-organization")
  .description("Delete an organization by ID")
  .requiredOption("-i, --id <id>", "Organization ID to delete")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "delete_organization",
        arguments: { id: opts.id },
      });
      printToolResult(result);
    });
  });

program
  .command("list-organizations")
  .description("List all organizations. Use -e to show teams and people.")
  .option("-e, --expand", "Show teams and people under each organization")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_organizations",
        arguments: opts.expand ? { expand: true } : {},
      });
      printToolResult(result);
    });
  });

program
  .command("create-team")
  .description("Create a team within an organization")
  .requiredOption("-n, --name <name>", "Team name")
  .requiredOption("-o, --organizationId <id>", "Organization ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "create_team",
        arguments: { name: opts.name, organizationId: opts.organizationId },
      });
      printToolResult(result);
    });
  });

program
  .command("list-teams")
  .description("List teams, optionally by organization or person")
  .option("-o, --organizationId <id>", "Filter by organization ID")
  .option("-p, --personId <id>", "Filter to teams this person belongs to")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.organizationId) args.organizationId = opts.organizationId;
      if (opts.personId) args.personId = opts.personId;
      const result = await client.callTool({
        name: "list_teams",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("delete-team")
  .description("Delete a team by ID")
  .requiredOption("-i, --id <id>", "Team ID to delete")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "delete_team",
        arguments: { id: opts.id },
      });
      printToolResult(result);
    });
  });

program
  .command("create-portfolio")
  .description("Create a portfolio (grouping of ends under org, team, or person)")
  .requiredOption("-n, --name <name>", "Portfolio name")
  .requiredOption("-o, --ownerType <type>", "Owner type: organization, team, or person")
  .requiredOption("-i, --ownerId <id>", "Owner ID (org, team, or person)")
  .option("-t, --portfolioType <type>", "Portfolio type: goals, projects, quarterly, backlog, operations, other")
  .option("-d, --description <desc>", "Optional description")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {
        name: opts.name,
        ownerType: opts.ownerType,
        ownerId: opts.ownerId,
      };
      if (opts.portfolioType) args.portfolioType = opts.portfolioType;
      if (opts.description) args.description = opts.description;
      const result = await client.callTool({
        name: "create_portfolio",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("list-portfolios")
  .description("List portfolios, optionally by owner or type")
  .option("-o, --ownerType <type>", "Filter by owner type: organization, team, person")
  .option("-i, --ownerId <id>", "Filter by owner ID")
  .option("-t, --portfolioType <type>", "Filter by portfolio type")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.ownerType) args.ownerType = opts.ownerType;
      if (opts.ownerId) args.ownerId = opts.ownerId;
      if (opts.portfolioType) args.portfolioType = opts.portfolioType;
      const result = await client.callTool({
        name: "list_portfolios",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("update-portfolio")
  .description("Update a portfolio by ID")
  .requiredOption("-i, --id <id>", "Portfolio ID")
  .option("-n, --name <name>", "Portfolio name")
  .option("-t, --portfolioType <type>", "Portfolio type")
  .option("-d, --description <desc>", "Description")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = { id: opts.id };
      if (opts.name) args.name = opts.name;
      if (opts.portfolioType) args.portfolioType = opts.portfolioType;
      if (opts.description !== undefined) args.description = opts.description;
      const result = await client.callTool({
        name: "update_portfolio",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("delete-portfolio")
  .description("Delete a portfolio by ID")
  .requiredOption("-i, --id <id>", "Portfolio ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "delete_portfolio",
        arguments: { id: opts.id },
      });
      printToolResult(result);
    });
  });

program
  .command("create-end")
  .description("Create an end (ongoing aspiration)")
  .requiredOption("-n, --name <name>", "End name")
  .option("-a, --areaId <id>", "Area ID")
  .option("-c, --portfolioId <id>", "Portfolio ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = { name: opts.name };
      if (opts.areaId) args.areaId = opts.areaId;
      if (opts.portfolioId) args.portfolioId = opts.portfolioId;
      const result = await client.callTool({
        name: "create_end",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("update-end")
  .description("Update an end by ID (add to portfolio, change area, rename)")
  .requiredOption("-i, --id <id>", "End ID to update")
  .option("-n, --name <name>", "End name")
  .option("-a, --areaId <id>", "Area ID")
  .option("-c, --portfolioId <id>", "Portfolio ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = { id: opts.id };
      if (opts.name) args.name = opts.name;
      if (opts.areaId !== undefined) args.areaId = opts.areaId;
      if (opts.portfolioId !== undefined) args.portfolioId = opts.portfolioId;
      const result = await client.callTool({
        name: "update_end",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("list-ends")
  .description("List ends, optionally by area or portfolio")
  .option("-a, --areaId <id>", "Filter by area ID")
  .option("-c, --portfolioId <id>", "Filter by portfolio ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.areaId) args.areaId = opts.areaId;
      if (opts.portfolioId) args.portfolioId = opts.portfolioId;
      const result = await client.callTool({
        name: "list_ends",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("delete-end")
  .description("Delete an end by ID")
  .requiredOption("-i, --id <id>", "End ID to delete")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "delete_end",
        arguments: { id: opts.id },
      });
      printToolResult(result);
    });
  });

program
  .command("create-habit")
  .description("Create a habit that serves ends")
  .requiredOption("-n, --name <name>", "Habit name")
  .requiredOption("-e, --ends <ids>", "Comma-separated end IDs")
  .option("-a, --areaId <id>", "Area ID")
  .option("-t, --teamId <id>", "Team ID")
  .option("-p, --personIds <ids>", "Comma-separated person IDs who participate in the habit")
  .option("-f, --frequency <freq>", "e.g. daily, weekly, 3x/week")
  .option("-m, --durationMinutes <min>", "Estimated time in minutes")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {
        name: opts.name,
        endIds: opts.ends.split(",").map((s: string) => s.trim()),
      };
      if (opts.areaId) args.areaId = opts.areaId;
      if (opts.teamId) args.teamId = opts.teamId;
      if (opts.personIds) args.personIds = opts.personIds.split(",").map((s: string) => s.trim());
      if (opts.frequency) args.frequency = opts.frequency;
      const mins = opts.durationMinutes != null ? parseInt(String(opts.durationMinutes), 10) : NaN;
      if (!isNaN(mins)) args.durationMinutes = mins;
      const result = await client.callTool({
        name: "create_habit",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("list-habits")
  .description("List habits, optionally filtered")
  .option("-e, --endId <id>", "Filter by end ID")
  .option("-a, --areaId <id>", "Filter by area ID")
  .option("-g, --teamId <id>", "Filter by team ID")
  .option("-p, --personId <id>", "Filter by person who performs the habit")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.endId) args.endId = opts.endId;
      if (opts.areaId) args.areaId = opts.areaId;
      if (opts.teamId) args.teamId = opts.teamId;
      if (opts.personId) args.personId = opts.personId;
      const result = await client.callTool({
        name: "list_habits",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("delete-habit")
  .description("Delete a habit by ID (also deletes its actions)")
  .requiredOption("-i, --id <id>", "Habit ID to delete")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "delete_habit",
        arguments: { id: opts.id },
      });
      printToolResult(result);
    });
  });

program
  .command("create-action")
  .description("Record a completed habit action")
  .requiredOption("-h, --habitId <id>", "Habit ID")
  .requiredOption("-d, --date <date>", "Date completed (YYYY-MM-DD)")
  .option("-m, --actualDurationMinutes <min>", "Actual time spent in minutes")
  .option("-n, --notes <notes>", "Optional notes")
  .option("-w, --with <ids>", "Person IDs (with) - comma-separated")
  .option("-F, --for <ids>", "Person IDs (for) - comma-separated")
  .action(async (opts) => {
    await withClient(async (client) => {
      const completedAt = opts.date.includes("T") ? opts.date : `${opts.date}T12:00:00.000Z`;
      const args: Record<string, unknown> = {
        habitId: opts.habitId,
        completedAt,
      };
      const mins = opts.actualDurationMinutes != null ? parseInt(String(opts.actualDurationMinutes), 10) : NaN;
      if (!isNaN(mins)) args.actualDurationMinutes = mins;
      if (opts.notes) args.notes = opts.notes;
      if (opts.with) args.withPersonIds = String(opts.with).split(",").map((s) => s.trim()).filter(Boolean);
      if (opts.for) args.forPersonIds = String(opts.for).split(",").map((s) => s.trim()).filter(Boolean);
      const result = await client.callTool({
        name: "create_action",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("list-actions")
  .description("List actions, optionally filtered")
  .option("-h, --habitId <id>", "Filter by habit ID")
  .option("-p, --period <period>", "today, yesterday, or this-week")
  .option("-f, --from <date>", "From date (YYYY-MM-DD)")
  .option("-t, --to <date>", "To date (YYYY-MM-DD)")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.habitId) args.habitId = opts.habitId;
      if (opts.period) {
        const p = String(opts.period).toLowerCase().replace(/-/g, "_");
        if (["today", "yesterday", "this_week"].includes(p)) args.period = p;
      }
      if (opts.from) args.fromDate = opts.from;
      if (opts.to) args.toDate = opts.to;
      const result = await client.callTool({
        name: "list_actions",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("delete-action")
  .description("Delete an action by ID")
  .requiredOption("-i, --id <id>", "Action ID to delete")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "delete_action",
        arguments: { id: opts.id },
      });
      printToolResult(result);
    });
  });

program
  .command("create-task")
  .description("Create an ad-hoc task")
  .requiredOption("-n, --name <name>", "Task name")
  .option("-e, --endId <id>", "End this task supports")
  .option("-a, --areaId <id>", "Area this task belongs to")
  .option("-w, --with <ids>", "Person IDs (with) - comma-separated")
  .option("-F, --for <ids>", "Person IDs (for) - comma-separated")
  .option("-d, --dueDate <date>", "Due date (YYYY-MM-DD)")
  .option("--notes <notes>", "Notes")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = { name: opts.name };
      if (opts.endId) args.endId = opts.endId;
      if (opts.areaId) args.areaId = opts.areaId;
      if (opts.with) args.withPersonIds = String(opts.with).split(",").map((s) => s.trim()).filter(Boolean);
      if (opts.for) args.forPersonIds = String(opts.for).split(",").map((s) => s.trim()).filter(Boolean);
      if (opts.dueDate) args.dueDate = opts.dueDate;
      if (opts.notes) args.notes = opts.notes;
      const result = await client.callTool({
        name: "create_task",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("list-tasks")
  .description("List tasks, optionally filtered")
  .option("-e, --endId <id>", "Filter by end ID")
  .option("-a, --areaId <id>", "Filter by area ID")
  .option("-c, --completed", "Completed tasks only")
  .option("-o, --open", "Open tasks only")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.endId) args.endId = opts.endId;
      if (opts.areaId) args.areaId = opts.areaId;
      if (opts.completed) args.completed = true;
      if (opts.open) args.completed = false;
      const result = await client.callTool({
        name: "list_tasks",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("update-task")
  .description("Update a task (e.g. complete it)")
  .requiredOption("-i, --id <id>", "Task ID to update")
  .option("-n, --name <name>", "Task name")
  .option("-e, --endId <id>", "End ID")
  .option("-a, --areaId <id>", "Area ID")
  .option("-w, --with <ids>", "Person IDs (with) - comma-separated")
  .option("-F, --for <ids>", "Person IDs (for) - comma-separated")
  .option("-m, --actualDurationMinutes <min>", "Time spent when completed (minutes)")
  .option("-d, --dueDate <date>", "Due date (YYYY-MM-DD)")
  .option("-C, --complete", "Mark as completed (sets completedAt to now)")
  .option("--notes <notes>", "Notes")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = { id: opts.id };
      if (opts.name) args.name = opts.name;
      if (opts.endId !== undefined) args.endId = opts.endId;
      if (opts.areaId !== undefined) args.areaId = opts.areaId;
      if (opts.with !== undefined) args.withPersonIds = String(opts.with).split(",").map((s) => s.trim()).filter(Boolean);
      if (opts.for !== undefined) args.forPersonIds = String(opts.for).split(",").map((s) => s.trim()).filter(Boolean);
      if (opts.actualDurationMinutes != null) args.actualDurationMinutes = parseInt(String(opts.actualDurationMinutes), 10);
      if (opts.dueDate !== undefined) args.dueDate = opts.dueDate;
      if (opts.complete) args.completedAt = new Date().toISOString();
      if (opts.notes !== undefined) args.notes = opts.notes;
      const result = await client.callTool({
        name: "update_task",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("delete-task")
  .description("Delete a task by ID")
  .requiredOption("-i, --id <id>", "Task ID to delete")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "delete_task",
        arguments: { id: opts.id },
      });
      printToolResult(result);
    });
  });

function printToolResult(result: unknown): void {
  if (typeof result === "object" && result !== null && "content" in result && Array.isArray((result as { content: unknown[] }).content)) {
    for (const block of (result as { content: { type: string; text?: string }[] }).content) {
      if (block.type === "text" && block.text) {
        console.log(block.text);
      }
    }
  } else if (typeof result === "object" && result !== null && "isError" in result && (result as { isError?: boolean }).isError) {
    console.error("Tool error:", result);
    process.exit(1);
  }
}

const RELATIONSHIP_TYPES = ["self", "spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"] as const;

program
  .command("create-person")
  .description("Create a new person entity")
  .requiredOption("-f, --firstName <name>", "First name")
  .requiredOption("-l, --lastName <name>", "Last name")
  .requiredOption("-e, --email <email>", "Email address")
  .option("-p, --phone <phone>", "Phone number")
  .option("--title <title>", "Job title or role")
  .option("-n, --notes <notes>", "Additional notes")
  .option("-r, --relationshipType <type>", `Relationship type: ${RELATIONSHIP_TYPES.join(", ")}`)
  .option("-t, --teams <ids>", "Comma-separated team IDs")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {
        firstName: opts.firstName,
        lastName: opts.lastName,
        email: opts.email,
        ...(opts.phone && { phone: opts.phone }),
        ...(opts.title && { title: opts.title }),
        ...(opts.notes && { notes: opts.notes }),
      };
      if (opts.teams) {
        args.teamIds = opts.teams.split(",").map((s: string) => s.trim());
      }
      if (opts.relationshipType && RELATIONSHIP_TYPES.includes(opts.relationshipType as (typeof RELATIONSHIP_TYPES)[number])) {
        args.relationshipType = opts.relationshipType;
      }
      const result = await client.callTool({
        name: "create_person",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("update-person")
  .description("Update a person by ID (only provided fields are updated)")
  .requiredOption("-i, --id <id>", "Person ID to update")
  .option("-f, --firstName <name>", "First name")
  .option("-l, --lastName <name>", "Last name")
  .option("-e, --email <email>", "Email address")
  .option("-p, --phone <phone>", "Phone number")
  .option("--title <title>", "Job title or role")
  .option("-n, --notes <notes>", "Additional notes")
  .option("-r, --relationshipType <type>", `Relationship type: ${RELATIONSHIP_TYPES.join(", ")}`)
  .option("-t, --teams <ids>", "Comma-separated team IDs (replaces entire list)")
  .option("-a, --addTeams <ids>", "Comma-separated team IDs to add (merges with existing)")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = { id: opts.id };
      if (opts.firstName) args.firstName = opts.firstName;
      if (opts.lastName) args.lastName = opts.lastName;
      if (opts.email) args.email = opts.email;
      if (opts.phone !== undefined) args.phone = opts.phone;
      if (opts.title !== undefined) args.title = opts.title;
      if (opts.notes !== undefined) args.notes = opts.notes;
      if (opts.teams) {
        args.teamIds = opts.teams.split(",").map((s: string) => s.trim());
      }
      if (opts.addTeams) {
        args.teamIdsToAdd = opts.addTeams.split(",").map((s: string) => s.trim());
      }
      if (opts.relationshipType && RELATIONSHIP_TYPES.includes(opts.relationshipType as (typeof RELATIONSHIP_TYPES)[number])) {
        args.relationshipType = opts.relationshipType;
      }
      const result = await client.callTool({
        name: "update_person",
        arguments: args,
      });
      printToolResult(result);
      if ("isError" in result && result.isError) {
        process.exit(1);
      }
    });
  });

program
  .command("delete-person")
  .description("Delete a person by ID")
  .requiredOption("-i, --id <id>", "Person ID to delete")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "delete_person",
        arguments: { id: opts.id },
      });
      printToolResult(result);
    });
  });

program
  .command("get-person")
  .description("Get a person by ID with full details")
  .requiredOption("-i, --id <id>", "Person ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "get_person",
        arguments: { id: opts.id },
      });
      printToolResult(result);
      if ("isError" in result && result.isError) {
        process.exit(1);
      }
    });
  });

program
  .command("list-users")
  .description("List users (account holders). For testing Person vs User linkage.")
  .action(async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_users",
        arguments: {},
      });
      printToolResult(result);
    });
  });

program
  .command("list-people")
  .description("List people, optionally by organization, team, or relationship type")
  .option("-o, --organizationId <id>", "Filter by organization ID")
  .option("-g, --teamId <id>", "Filter by team ID")
  .option("-r, --relationshipType <type>", `Filter by relationship: ${RELATIONSHIP_TYPES.join(", ")}`)
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.organizationId) args.organizationId = opts.organizationId;
      if (opts.teamId) args.teamId = opts.teamId;
      if (opts.relationshipType && RELATIONSHIP_TYPES.includes(opts.relationshipType as (typeof RELATIONSHIP_TYPES)[number])) {
        args.relationshipType = opts.relationshipType;
      }
      const result = await client.callTool({
        name: "list_people",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("nl <text>")
  .description("Natural language command - e.g. nl \"I went to the gym today for 60 minutes\"")
  .action(async (text: string) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "natural_language_command",
        arguments: { text },
      });
      printToolResult(result);
      if ("isError" in result && result.isError) {
        process.exit(1);
      }
    });
  });

program
  .command("call <toolName> [argsJson]")
  .description("Call any tool with JSON arguments")
  .action(async (toolName: string, argsJson?: string) => {
    await withClient(async (client) => {
      let args: Record<string, unknown> = {};
      if (argsJson) {
        try {
          args = JSON.parse(argsJson);
        } catch {
          console.error("Invalid JSON arguments");
          process.exit(1);
        }
      }

      const result = await client.callTool({ name: toolName, arguments: args });

      if ("content" in result && Array.isArray(result.content)) {
        for (const block of result.content) {
          if (block.type === "text") {
            console.log(block.text);
          }
        }
      } else if ("isError" in result && result.isError) {
        console.error("Tool error:", result);
        process.exit(1);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    });
  });

// ============================================================================
// SHARING COMMANDS
// ============================================================================

program
  .command("share-end")
  .description("Share an end (aspiration) with another user")
  .requiredOption("-i, --endId <id>", "End ID to share")
  .requiredOption("-u, --userId <id>", "User ID to share with")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "share_end",
        arguments: { endId: opts.endId, sharedWithUserId: opts.userId },
      });
      printToolResult(result);
    });
  });

program
  .command("unshare-end")
  .description("Remove sharing of an end with a user")
  .requiredOption("-i, --endId <id>", "End ID to unshare")
  .requiredOption("-u, --userId <id>", "User ID to remove sharing for")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "unshare_end",
        arguments: { endId: opts.endId, userId: opts.userId },
      });
      printToolResult(result);
    });
  });

program
  .command("list-shared-ends")
  .description("List ends shared with you by other users")
  .action(async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_shared_ends",
        arguments: {},
      });
      printToolResult(result);
    });
  });

program
  .command("list-my-shares")
  .description("List ends you have shared with other users")
  .action(async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_my_shares",
        arguments: {},
      });
      printToolResult(result);
    });
  });

// ============================================================================
// AUTH COMMANDS
// ============================================================================

program
  .command("login")
  .description("Login to tldr-mcp via Supabase (saves token to ~/.tldr-mcp/auth.json)")
  .action(async () => {
    console.log("Login is handled via Supabase Auth.");
    console.log("");
    console.log("For development, set TLDR_DEV_USER_ID in your .env file.");
    console.log("For production, integrate with your Supabase Auth flow.");
    console.log("");
    console.log("Steps for development:");
    console.log("1. Create a test user in your Supabase dashboard");
    console.log("2. Copy the user's UUID from the Authentication > Users page");
    console.log("3. Add TLDR_DEV_USER_ID=<uuid> to your .env file");
    console.log("4. Restart the server/CLI");
  });

program
  .command("whoami")
  .description("Show current user info")
  .action(async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_users",
        arguments: {},
      });
      printToolResult(result);
    });
  });

program.parse();
