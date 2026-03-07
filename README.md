# tldr-mcp

MCP (Model Context Protocol) server boilerplate for your app. This provides the foundational structure for exposing **tools**, **resources**, and **prompts** to AI clients like Claude Desktop, Cursor, and others.

## Project Structure

```
src/
├── index.ts          # Server entry point, transport setup
├── cli.ts            # CLI client
├── schemas/          # Entity schemas (Person, Area, Organization)
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

- **Areas** – Life areas (Career, Family, Health, Spiritual, etc.), seeded on first use
- **Organizations** – Top-level containers for teams and people (e.g., "Smith Family", "Acme Corp")
- **People** – Members of organizations
- **Collections** – Groupings of ends under an org, team, or person (e.g., "Q1 Goals", "Personal")
- **Ends** – Ongoing aspirations you work toward (e.g., "Be a better father", "Practice guitar"); can belong to an area and/or collection
- **Habits** – Recurring behaviors that serve ends; can link to area, team, or person
- **Actions** – Tracked completions of habits (e.g., "Practiced guitar on Feb 24")

## CLI

A CLI is included to call the MCP server from the command line. It spawns the server and connects via stdio.

```bash
# List available tools
npm run cli -- list-tools

# Areas & organizations
npm run cli -- list-areas
npm run cli -- create-organization -n "Smith Family"
npm run cli -- list-organizations
npm run cli -- list-organizations -e
npm run cli -- create-team -n "Engineering" -o <organizationId>
npm run cli -- list-teams
npm run cli -- list-teams -o <organizationId>
npm run cli -- list-teams -p <personId>
npm run cli -- create-collection -n "Q1 Goals" -p organization -i <organizationId>
npm run cli -- list-collections -p organization -i <organizationId>
npm run cli -- list-ends-and-habits
npm run cli -- list-ends-and-habits -a <areaId>
npm run cli -- list-ends-and-habits -c <collectionId>

# People
npm run cli -- create-person -f Jane -l Doe -e jane@example.com -t <teamId>
npm run cli -- list-people
npm run cli -- list-people -o <organizationId>
npm run cli -- list-people -t <teamId>

# Ends, habits, actions
npm run cli -- create-end -n "Be a better father" -a <areaId> -c <collectionId>
npm run cli -- list-ends -a <areaId> -c <collectionId>
npm run cli -- create-habit -n "Family dinner" -e <endId1>,<endId2> -f daily -a <areaId>
npm run cli -- list-habits -e <endId>
npm run cli -- create-action -h <habitId> -d 2026-02-25
npm run cli -- list-actions -h <habitId> -f 2026-02-01 -t 2026-02-28

# Call any tool with JSON arguments
npm run cli -- call create_person '{"firstName":"Bob","lastName":"Smith","email":"bob@test.com","teamIds":["<teamId>"]}'
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
