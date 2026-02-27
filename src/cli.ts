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
  .command("list-domains")
  .description("List Wheel of Life domains")
  .action(async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_domains",
        arguments: {},
      });
      printToolResult(result);
    });
  });

program
  .command("create-organization")
  .description("Create an organization within a domain")
  .requiredOption("-n, --name <name>", "Organization name")
  .requiredOption("-d, --domainId <id>", "Domain ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "create_organization",
        arguments: { name: opts.name, domainId: opts.domainId },
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
  .description("List organizations, optionally by domain")
  .option("-d, --domainId <id>", "Filter by domain ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_organizations",
        arguments: opts.domainId ? { domainId: opts.domainId } : {},
      });
      printToolResult(result);
    });
  });

program
  .command("create-group")
  .description("Create a group within an organization")
  .requiredOption("-n, --name <name>", "Group name")
  .requiredOption("-o, --organizationId <id>", "Organization ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "create_group",
        arguments: { name: opts.name, organizationId: opts.organizationId },
      });
      printToolResult(result);
    });
  });

program
  .command("list-groups")
  .description("List groups, optionally by organization")
  .option("-o, --organizationId <id>", "Filter by organization ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_groups",
        arguments: opts.organizationId ? { organizationId: opts.organizationId } : {},
      });
      printToolResult(result);
    });
  });

program
  .command("delete-group")
  .description("Delete a group by ID")
  .requiredOption("-i, --id <id>", "Group ID to delete")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "delete_group",
        arguments: { id: opts.id },
      });
      printToolResult(result);
    });
  });

program
  .command("create-end")
  .description("Create an end (ongoing aspiration)")
  .requiredOption("-n, --name <name>", "End name")
  .option("-d, --domainId <id>", "Domain ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = { name: opts.name };
      if (opts.domainId) args.domainId = opts.domainId;
      const result = await client.callTool({
        name: "create_end",
        arguments: args,
      });
      printToolResult(result);
    });
  });

program
  .command("list-ends")
  .description("List ends, optionally by domain")
  .option("-d, --domainId <id>", "Filter by domain ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "list_ends",
        arguments: opts.domainId ? { domainId: opts.domainId } : {},
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
  .option("-d, --domainId <id>", "Domain ID")
  .option("-o, --organizationId <id>", "Organization ID")
  .option("-p, --personId <id>", "Person ID")
  .option("-f, --frequency <freq>", "e.g. daily, weekly, 3x/week")
  .option("-m, --durationMinutes <min>", "Estimated time in minutes")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {
        name: opts.name,
        endIds: opts.ends.split(",").map((s: string) => s.trim()),
      };
      if (opts.domainId) args.domainId = opts.domainId;
      if (opts.organizationId) args.organizationId = opts.organizationId;
      if (opts.personId) args.personId = opts.personId;
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
  .option("-d, --domainId <id>", "Filter by domain ID")
  .option("-o, --organizationId <id>", "Filter by organization ID")
  .option("-p, --personId <id>", "Filter by person ID")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.endId) args.endId = opts.endId;
      if (opts.domainId) args.domainId = opts.domainId;
      if (opts.organizationId) args.organizationId = opts.organizationId;
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
  .option("-f, --from <date>", "From date (YYYY-MM-DD)")
  .option("-t, --to <date>", "To date (YYYY-MM-DD)")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.habitId) args.habitId = opts.habitId;
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

const RELATIONSHIP_TYPES = ["spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"] as const;

program
  .command("create-person")
  .description("Create a new person entity")
  .requiredOption("-f, --firstName <name>", "First name")
  .requiredOption("-l, --lastName <name>", "Last name")
  .requiredOption("-e, --email <email>", "Email address")
  .option("-p, --phone <phone>", "Phone number")
  .option("-t, --title <title>", "Job title or role")
  .option("-n, --notes <notes>", "Additional notes")
  .option("-r, --relationshipType <type>", `Relationship type: ${RELATIONSHIP_TYPES.join(", ")}`)
  .option("-o, --organizations <ids>", "Comma-separated organization IDs")
  .option("-g, --groups <ids>", "Comma-separated group IDs")
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
      if (opts.organizations) {
        args.organizationIds = opts.organizations.split(",").map((s: string) => s.trim());
      }
      if (opts.groups) {
        args.groupIds = opts.groups.split(",").map((s: string) => s.trim());
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
  .option("-t, --title <title>", "Job title or role")
  .option("-n, --notes <notes>", "Additional notes")
  .option("-r, --relationshipType <type>", `Relationship type: ${RELATIONSHIP_TYPES.join(", ")}`)
  .option("-o, --organizations <ids>", "Comma-separated organization IDs (replaces existing)")
  .option("-g, --groups <ids>", "Comma-separated group IDs (replaces existing)")
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = { id: opts.id };
      if (opts.firstName) args.firstName = opts.firstName;
      if (opts.lastName) args.lastName = opts.lastName;
      if (opts.email) args.email = opts.email;
      if (opts.phone !== undefined) args.phone = opts.phone;
      if (opts.title !== undefined) args.title = opts.title;
      if (opts.notes !== undefined) args.notes = opts.notes;
      if (opts.organizations) {
        args.organizationIds = opts.organizations.split(",").map((s: string) => s.trim());
      }
      if (opts.groups) {
        args.groupIds = opts.groups.split(",").map((s: string) => s.trim());
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
  .command("list-people")
  .description("List people, optionally by domain, organization, group, or relationship type")
  .option("-d, --domainId <id>", "Filter by domain ID")
  .option("-o, --organizationId <id>", "Filter by organization ID")
  .option("-g, --groupId <id>", "Filter by group ID")
  .option("-r, --relationshipType <type>", `Filter by relationship: ${RELATIONSHIP_TYPES.join(", ")}`)
  .action(async (opts) => {
    await withClient(async (client) => {
      const args: Record<string, unknown> = {};
      if (opts.domainId) args.domainId = opts.domainId;
      if (opts.organizationId) args.organizationId = opts.organizationId;
      if (opts.groupId) args.groupId = opts.groupId;
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

program.parse();
