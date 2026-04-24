# PoC: Cloudflare AIChatAgent + Anthropic + MCP

**Status: COMPLETED 2026-04-24** — all core criteria passed. OAuth handoff deferred to Phase 1.

## Goal

Validate the two pre-implementation unknowns from the rearchitecture spec before committing to the full build:

1. **AIChatAgent + Anthropic API + MCP tool calling** — can an AIChatAgent Durable Object use Anthropic (Claude) as the model and execute MCP tools against our existing MCP server?
2. **OAuth token handoff** — can the SPA perform OAuth consent with the MCP server and pass tokens to the DO for authenticated tool calls?

## Success Criteria

- [x] User sends a chat message via WebSocket to a Durable Object
- [x] DO calls Anthropic API (Claude Sonnet) with the message
- [x] Sonnet calls at least one MCP tool (e.g. `list_activity`) on the live tldr MCP server
- [x] Tool result is fed back to Sonnet
- [x] Sonnet's response is delivered to the client via WebSocket
- [x] Conversation persists — a follow-up message in the same session has context from the first
- [ ] OAuth tokens obtained by the SPA are used by the DO for MCP authentication — **deferred to Phase 1, API token used instead**

## What to Build

### 1. Cloudflare Worker + Durable Object

A single Worker that:
- Accepts WebSocket connections at `/chat`
- Creates/routes to a Durable Object per user (can use a hardcoded user ID for PoC)
- The DO extends Think (or the base Agent class if Think doesn't fit)

The DO:
- Receives messages via WebSocket
- Calls Anthropic API with conversation history + MCP tool definitions
- Executes MCP tool calls against `https://tldr-mcp-production.up.railway.app/mcp`
- Streams response tokens back over WebSocket
- Stores conversation in SQLite (Think's built-in)

### 2. Minimal Client

A bare HTML page (no React, no build step) that:
- Opens a WebSocket to the Worker
- Has a text input and a message display area
- Shows streamed tokens as they arrive
- Demonstrates conversation continuity (send two messages, second one has context)

### 3. MCP Authentication

For the PoC, two options (pick the simpler one that validates the pattern):

**Option A — API token (simplest):**
- Hardcode a `tldr_live_*` API token in the DO's environment
- Validates that the DO can authenticate to the MCP server and call tools
- Defers the OAuth handoff to Phase 1

**Option B — Full OAuth handoff:**
- The minimal client performs OAuth consent with the MCP server
- Passes the access token to the DO via a WebSocket `init` message
- DO uses the token for MCP calls
- Validates the full flow from the rearchitecture spec

Recommendation: **start with Option A** to isolate the Think + Anthropic + MCP question. If that works, try Option B to validate the handoff. Two separate steps, each with a clear pass/fail.

## What NOT to Build

- No React SPA — bare HTML is sufficient
- No Supabase auth — hardcoded user for PoC
- No AI Gateway — direct Anthropic calls
- No conversation compaction — short conversations are fine
- No data view endpoints
- No production error handling
- No deployment pipeline — `wrangler dev` + `wrangler deploy` is sufficient

## Tech Stack

- `wrangler` CLI for Cloudflare Workers development
- `@cloudflare/agents` SDK (includes Think base class)
- `@anthropic-ai/sdk` for Anthropic API calls (or via AI SDK if Think requires it)
- `@modelcontextprotocol/sdk` for MCP client
- No npm build for the client — single HTML file

## Environment Variables

```
ANTHROPIC_API_KEY=...          # For Sonnet API calls
TLDR_MCP_URL=https://tldr-mcp-production.up.railway.app/mcp
TLDR_MCP_TOKEN=tldr_live_...   # Option A only
```

## Project Structure

```
cloudflare-poc/
├── src/
│   └── index.ts          # Worker + Durable Object
├── public/
│   └── index.html        # Minimal WebSocket client
├── wrangler.toml          # Cloudflare config
└── package.json
```

## Time Estimate

- Setup (wrangler, deps, config): 30 min
- Worker + DO skeleton with WebSocket: 1 hour
- Think/Agent + Anthropic integration: 1-2 hours (unknown — this is the main risk)
- MCP client integration: 1 hour
- Minimal client page: 30 min
- OAuth handoff (Option B, if A works): 1 hour

**Total: half a day**, with the Think + Anthropic integration as the wildcard.

## Decision Gate

After the PoC:

- **All criteria pass** → proceed to Phase 1 of the rearchitecture with confidence
- **Think doesn't support Anthropic or MCP natively** → evaluate whether custom wiring is acceptable or whether a different agent framework (e.g. raw Anthropic SDK + Durable Objects without Think) is better
- **OAuth handoff fails** → design alternative token management (e.g. service-to-service token, user-scoped API tokens minted by the Worker)
