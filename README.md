# tldr-mcp

MCP (Model Context Protocol) server boilerplate for your app. This provides the foundational structure for exposing **tools**, **resources**, and **prompts** to AI clients like Claude Desktop, Cursor, and others.

## Project Structure

```
src/
├── index.ts          # Server entry point, transport setup
├── cli.ts            # CLI client
├── schemas/          # Entity schemas (Person, Domain, Organization)
├── store/            # Persistence (JSON files in data/)
├── tools/            # MCP tools
├── resources/        # MCP resources (read-only data)
└── prompts/          # MCP prompts
```

## Quick Start

```bash
# Install dependencies (already done)
npm install

# Build
npm run build

# Run the server (stdio transport - for Claude Desktop, Cursor, etc.)
npm start
```

## Data Model (Wheel of Life)

- **Domains** – Life areas (Career, Family, Health, Spiritual, etc.), seeded on first use
- **Organizations** – Groups within a domain (e.g., "Smith Family", "First Baptist Church")
- **People** – Members of organizations
- **Ends** – Ongoing aspirations you work toward (e.g., "Be a better father", "Practice guitar")
- **Habits** – Recurring behaviors that serve ends; can link to domain, organization, or person
- **Actions** – Tracked completions of habits (e.g., "Practiced guitar on Feb 24")

## CLI

A CLI is included to call the MCP server from the command line. It spawns the server and connects via stdio.

```bash
# List available tools
npm run cli -- list-tools

# Domains & organizations
npm run cli -- list-domains
npm run cli -- create-organization -n "Smith Family" -d <domainId>
npm run cli -- list-organizations
npm run cli -- list-organizations -d <domainId>

# People
npm run cli -- create-person -f Jane -l Doe -e jane@example.com -o <orgId1>,<orgId2>
npm run cli -- list-people
npm run cli -- list-people -d <domainId>
npm run cli -- list-people -o <organizationId>

# Ends, habits, actions
npm run cli -- create-end -n "Be a better father" -d <domainId>
npm run cli -- list-ends
npm run cli -- create-habit -n "Family dinner" -e <endId1>,<endId2> -f daily
npm run cli -- list-habits -e <endId>
npm run cli -- create-action -h <habitId> -d 2026-02-25
npm run cli -- list-actions -h <habitId> -f 2026-02-01 -t 2026-02-28

# Call any tool with JSON arguments
npm run cli -- call create_person '{"firstName":"Bob","lastName":"Smith","email":"bob@test.com","organizationIds":["<orgId>"]}'
```

After `npm link`, you can run `tldr-mcp-cli` directly.

## Adding Capabilities

### Tools

Edit `src/tools/index.ts`. Tools are functions the LLM can call:

```typescript
import { z } from "zod";

server.registerTool(
  "my_tool",
  {
    description: "What your tool does",
    inputSchema: {
      param: z.string().describe("Parameter description"),
    },
  },
  async ({ param }) => ({
    content: [{ type: "text", text: `Result: ${param}` }],
  })
);
```

### Resources

Edit `src/resources/index.ts`. Resources expose read-only data via URIs:

- **Static**: Fixed URI (e.g. `app://config`)
- **Dynamic**: Template (e.g. `app://item/{id}`)

### Prompts

Edit `src/prompts/index.ts`. Prompts are pre-written templates that guide users:

```typescript
server.registerPrompt(
  "my_prompt",
  {
    description: "Prompt description",
    argsSchema: { topic: z.string().describe("Topic") },
  },
  async ({ topic }) => ({
    messages: [{ role: "user", content: { type: "text", text: `...${topic}...` } }],
  })
);
```

## MCP Inspector (Development)

Use [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) to test and debug tools interactively:

```bash
npm run build
npm run inspector
```

Then open http://localhost:6274 in your browser. You can call tools with custom inputs, inspect schemas, and view resources and prompts.

## Connecting to Clients

### Cursor

Add to Cursor MCP settings (e.g. `~/.cursor/mcp.json` or project config):

```json
{
  "mcpServers": {
    "tldr-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/tldr-mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "tldr-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/tldr-mcp/dist/index.js"]
    }
  }
}
```

Replace the path with your actual project path (use `pwd` in the project directory).

## Important Notes

- **Logging**: Use `console.error()` for logs. Never use `console.log()` — stdout is reserved for JSON-RPC.
- **Zod**: The SDK uses [Zod](https://zod.dev) for schema validation. Install with `npm install zod` if not present.

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
