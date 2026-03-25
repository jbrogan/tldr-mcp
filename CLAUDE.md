# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode compilation
npm start            # Run MCP server on stdio
npm run cli -- ...   # Run CLI client (mirrors all tool capabilities)
npm run inspector    # Start MCP Inspector UI at http://localhost:6274
```

## Architecture Overview

**tldr-mcp** is a Model Context Protocol (MCP) server implementing a "Wheel of Life" productivity system. It provides tools for managing life aspirations, habits, tasks, and relationships via JSON-RPC over stdio.

### Multi-User Architecture

The system uses **Supabase** (Postgres + Auth + RLS) for multi-user support:

- **Authentication**: Supabase Auth with Google OAuth and email/password
- **Authorization**: Row Level Security (RLS) ensures users only access their own data
- **Sharing**: Users can share ends (aspirations) with others for collaborative tracking

### Data Model

```
User (Supabase Auth profile)
├── Areas (10 Wheel of Life categories: Career, Family, Health, etc.)
├── Ends (ongoing aspirations/goals) - shareable with other users
│   └── Habits (recurring behaviors) - visible to users sharing the end
│       └── Actions (tracked completions) - group visibility on shared ends
├── Tasks (one-off to-dos)
├── Organizations
│   └── Teams
│       └── People (with relationship types: spouse, child, colleague, etc.)
└── Collections (goals, projects, quarterly, backlog, operations)
```

**Sharing Model**:
- **Ends**: Owner has full control; shared users get read-only access
- **Habits**: Visible to everyone sharing the end (creator can edit)
- **Actions**: Visible to everyone sharing the end (group visibility)
- **Tasks**: User-owned only, linkable to shared ends

### Code Organization

- `src/schemas/` - Zod validation schemas for all entities
- `src/supabase/client.ts` - Supabase client initialization
- `src/supabase/types.ts` - Generated TypeScript types for database
- `src/store/base.ts` - Store context management (user + Supabase client)
- `src/store/*.ts` - Supabase-based persistence for each entity type
- `src/tools/index.ts` - All 40+ MCP tool registrations (largest file)
- `src/services/naturalLanguage.ts` - Intent routing & LLM orchestration
- `src/llm/` - Pluggable LLM provider abstraction (Anthropic/OpenAI)
- `src/cli.ts` - Commander.js CLI client
- `supabase/migrations/` - SQL migration files for database schema

### Key Patterns

**Logging**: Always use `console.error()` for logs. `console.log()` breaks the JSON-RPC protocol since stdout is reserved for MCP communication.

**Adding tools**: Register in `src/tools/index.ts` following the existing CRUD pattern (create_*, update_*, delete_*, get_*, list_*).

**Store pattern**: Each store module uses `getSupabase()` and `getUserId()` from `base.ts` for context. RLS automatically filters results to the current user's data.

**Junction tables**: Array fields (teamIds, endIds, withPersonIds, forPersonIds) are normalized into junction tables (person_teams, habit_ends, action_persons, task_persons).

### Configuration

Set via `.env` (see `.env.example`):

**LLM Configuration**:
- `LLM_PROVIDER`: anthropic or openai
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`

**Supabase Configuration**:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Public anon key for client operations
- `SUPABASE_SERVICE_ROLE_KEY`: Admin key (optional, bypasses RLS)
- `TLDR_DEV_USER_ID`: Development user UUID (bypasses auth)

### Development Setup

1. Create a Supabase project at https://supabase.com
2. Run the migration: `supabase db push` or apply `supabase/migrations/*.sql`
3. Create a test user in the Supabase Auth dashboard
4. Copy the user UUID to `.env` as `TLDR_DEV_USER_ID`
5. Run `npm run build && npm start`

### MCP Client Integration

Add to Cursor (`~/.cursor/mcp.json`) or Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "tldr": {
      "command": "node",
      "args": ["/path/to/tldr-mcp/dist/index.js"]
    }
  }
}
```

### Database Schema

Core tables with RLS policies:
- `profiles` - User accounts (extends auth.users)
- `areas` - Wheel of Life segments (auto-seeded on signup)
- `organizations`, `teams` - Org hierarchy
- `persons` - People representations
- `collections` - Groupings of ends
- `ends` - Aspirations (shareable)
- `habits`, `actions` - Habit tracking
- `tasks` - One-off to-dos

Junction tables:
- `person_teams` - Person ↔ Team membership
- `habit_ends` - Habit ↔ End relationships
- `action_persons` - Action with/for person relationships
- `task_persons` - Task with/for person relationships
- `end_shares` - End sharing between users
