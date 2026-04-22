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

**tldr-mcp** is a Model Context Protocol (MCP) server implementing a "Wheel of Life" productivity system. It provides ~60 tools for managing life aspirations, habits, tasks, and relationships via JSON-RPC over HTTP.

### Multi-User Architecture

The system uses **Supabase** (Postgres + Auth + RLS) for multi-user support:

- **Authentication**: OAuth 2.1 via Supabase (Claude Desktop/Code/Web connectors) + API tokens (dev fallback)
- **Authorization**: Row Level Security (RLS) ensures users only access their own data
- **Sharing**: Users can share ends with others for collaborative tracking

### Data Model

```
User (Supabase Auth profile, with timezone)
├── Beliefs (core values, e.g. "Family comes first")
├── Areas (10 Wheel of Life categories: Career, Family, Health, etc.)
├── Ends (aspirations/goals/investigations) - shareable with other users
│   ├── end_type: journey (ongoing) | destination (bounded goal) | inquiry (hypothesis)
│   ├── state: type-specific state machine (active/paused/archived/completed/abandoned/resolved)
│   ├── due_date, thesis (inquiry), resolution_notes (inquiry)
│   └── Habits (recurring behaviors) - visible to users sharing the end
│       └── Actions (tracked completions) - group visibility on shared ends
├── Tasks (one-off to-dos, with scheduledDate, estimatedDurationMinutes)
│   └── Task Time (work sessions logged against tasks)
├── Organizations
│   └── Teams
│       └── People (with relationship types: spouse, child, colleague, etc.)
└── Portfolios (groupings of ends)
```

**End Types & State Machines**:
- **Journey**: `active ↔ paused → archived` (ongoing aspirations, no finish line)
- **Destination**: `active → completed | abandoned` (bounded goals)
- **Inquiry**: `active → resolved | abandoned` (hypotheses; thesis + resolution_notes)

**Sharing Model**:
- **Ends**: Owner has full control; shared users get read-only access
- **Habits**: Visible to everyone sharing the end (creator can edit)
- **Actions**: Visible to everyone sharing the end (group visibility)
- **Tasks**: User-owned only, linkable to shared ends

**Timezone Contract**:
- TIMESTAMPTZ columns stored as UTC, serialized to clients with user's TZ offset (e.g. `-04:00`)
- DATE columns and bare `YYYY-MM-DD` inputs interpreted in the user's IANA timezone
- `completedAt` fields accept `"today"` / `"yesterday"` / `YYYY-MM-DD` / full ISO; resolved server-side via `resolveCompletedAt()` in `src/utils/timezone.ts`

### Code Organization

- `src/schemas/` - Zod validation schemas for all entities
- `src/supabase/client.ts` - Supabase client initialization
- `src/supabase/types.ts` - Generated TypeScript types for database
- `src/store/base.ts` - Store context management (user + Supabase client)
- `src/store/*.ts` - Supabase-based persistence for each entity type
- `src/tools/index.ts` - All ~60 MCP tool registrations (largest file)
- `src/services/ask.ts` - Agent SDK chat (web app, uses same registerTools() as MCP server)
- `src/utils/timezone.ts` - TZ helpers: resolveCompletedAt, formatInstantForUser, localDateToUtcRange
- `src/cli.ts` - Commander.js CLI client
- `supabase/migrations/` - SQL migration files for database schema

## MCP Tool Design Principle: Belts and Suspenders for LLM-Computed Fields

When a tool involves fields that require LLM interpretation or computation (e.g. computing a date from a natural language recurrence string), apply the following pattern:

**1. Tool description instructs the calling LLM.**
Include explicit computation instructions in the tool's description field. Example:
> "When `recurrence` is provided and `nextDueAt` is not, compute `nextDueAt` from the recurrence string and `completedAt` (or today if not provided) before calling this tool."

**2. Server enforces the same invariant as a fallback.**
The MCP server independently computes or validates the field if not provided by the caller. This ensures correctness regardless of which LLM, client, or direct API call is used.

This pattern makes invariants robust to caller variability without trusting any single caller. Apply it to all tools where computed, interpreted, or validated fields exist — including end_type state machine validation, recurrence-based date computation, and any future LLM-interpreted fields.

### Key Patterns

**Logging**: Always use `console.error()` for logs. `console.log()` breaks the JSON-RPC protocol since stdout is reserved for MCP communication.

**Adding tools**: Register in `src/tools/index.ts` following the existing CRUD pattern (create_*, update_*, delete_*, get_*, list_*).

**Tool response format**: All tool responses return structured JSON via `jsonResponse()` helper. List tools return `{ <entity>s: [...], count: N }`. Single-entity tools return `{ <entity>: {...} }`. Related entities are included inline with id and name. Errors stay as plain text with `isError: true`. The LLM handles presentation; tools are the data layer.

**Store pattern**: Each store module uses `getSupabase()` and `getUserId()` from `base.ts` for context. RLS automatically filters results to the current user's data.

**Junction tables**: Array fields (teamIds, endIds, withPersonIds, forPersonIds) are normalized into junction tables (person_teams, habit_ends, action_persons, task_persons).

### Configuration

Set via `.env` (see `.env.example`):

**LLM Configuration**:
- `ANTHROPIC_API_KEY`: Powers the Agent SDK chat on the web app

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

**OAuth (preferred)**: Add as a connector in Claude Desktop/Code/Web pointing at `https://tldr-mcp-production.up.railway.app/mcp`. OAuth 2.1 with dynamic client registration — no API tokens needed.

**API token (dev fallback)**: Create a `tldr_live_*` token via the web app Settings page, pass via `--header "Authorization: Bearer ..."`.

**Claude Code**:
```bash
claude mcp add --transport http tldr https://tldr-mcp-production.up.railway.app/mcp --scope user
```

### Database Schema

Core tables with RLS policies:
- `profiles` - User accounts (extends auth.users, includes timezone)
- `areas` - Wheel of Life segments (auto-seeded on signup)
- `organizations`, `teams` - Org hierarchy
- `persons` - People representations
- `portfolios` - Groupings of ends
- `ends` - Aspirations/goals/investigations (end_type, state, due_date, thesis, resolution_notes; shareable)
- `beliefs` - Core values, linked to ends via belief_ends
- `habits`, `actions` - Habit tracking
- `tasks` - One-off to-dos (scheduledDate, estimatedDurationMinutes, completedAt)
- `task_time` - Work sessions logged against tasks
- `api_tokens` - Long-lived tokens for MCP client auth (hashed, 90-day expiry)

Junction tables:
- `person_teams` - Person ↔ Team membership
- `habit_ends` - Habit ↔ End relationships
- `action_persons` - Action with/for person relationships
- `task_persons` - Task with/for person relationships
- `task_time_persons` - Task time with/for person relationships
- `end_shares` - End sharing between users
- `belief_ends` - Belief ↔ End relationships
