# Spec: tldr Web App Rearchitecture

## Overview

Replace the current Railway-hosted, stateless POC with a scalable, multi-user architecture built on Cloudflare Pages (frontend) and the Cloudflare Agents SDK with the `Think` base class (agent layer). The tldr MCP server is treated as an external dependency accessed via a single authenticated URL endpoint — its deployment location is out of scope and can be migrated independently.

---

## Problems with Current Architecture

| Problem | Description |
|---|---|
| Stateless conversation | Every message starts a fresh `query()` call with no history |
| Global context race condition | `AsyncLocalStorage` workaround with a global store context risks bleeding between concurrent users |
| No streaming | User waits for the full agentic loop to complete before seeing any response |
| Tight coupling | Railway server owns HTTP handling, auth, and tool execution in a single process |
| No cost visibility | No per-user tracking of Anthropic API usage |
| Single point of failure | One Railway server serves all users |

---

## Target Architecture

```
┌─────────────────────────────────┐
│   Cloudflare Pages              │
│   React SPA                     │
│   - Chat interface (primary)    │
│   - Data views / dashboards     │
└──────────────┬──────────────────┘
               │ WebSocket (streaming chat)
               │ HTTP (data views / REST)
               ▼
┌─────────────────────────────────┐
│   Cloudflare Worker             │
│   - Auth middleware             │
│   - Request routing             │
│   - Durable Object dispatch     │
└──────────────┬──────────────────┘
               │ One Durable Object per user
               ▼
┌─────────────────────────────────┐
│   User Agent (Durable Object)   │
│   Think base class              │
│   - Persistent conversation     │
│   - Agentic loop                │
│   - Streaming via WebSocket     │
│   - SQLite message store        │
│   - MCP client                  │
└──────────────┬──────────────────┘
               │ MCP over HTTP
               ▼
┌─────────────────────────────────┐
│   tldr MCP Server               │
│   (Railway or Cloudflare —      │
│    location TBD, independent)   │
│   - Authenticated endpoint      │
│   - All tldr tools              │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│   Supabase                      │
│   - User data                   │
│   - Application database        │
└─────────────────────────────────┘
```

---

## Component Specifications

### 1. Frontend — Cloudflare Pages (React SPA)

**Responsibilities:**
- Chat interface as the primary UI
- Data views and dashboards (ends hierarchy, habit tracker, activity feed, etc.)
- Authentication via Supabase Auth (JWT issued by Supabase, validated at Worker)
- WebSocket connection management for streaming chat
- REST calls for non-chat data views

**Key design decisions:**
- React remains the framework — no change required, well-supported on Cloudflare Pages
- Chat and data views are two modes of the same SPA, not separate apps
- WebSocket connection is established per chat session, not per message
- JWT is passed in the WebSocket upgrade request and on all HTTP calls

**Chat interface requirements:**
- Streaming — tokens render as they arrive, not after full response
- Message history displayed in session (loaded from agent on connect)
- Typing indicator while agent is processing
- Error states with retry

**Data view requirements:**
- Ends hierarchy visualization
- Activity feed / time log
- Habit tracker (streak, cadence)
- Dashboard (daily summary, week at a glance)
- These views call the Worker REST API, which proxies to the tldr MCP server — they do not go through the agent or Anthropic API

---

### 2. API Worker — Cloudflare Worker

**Responsibilities:**
- Validate Supabase JWT on every request
- Route WebSocket upgrades to the correct User Agent Durable Object
- Route REST requests to data endpoints
- Enforce rate limits per user
- Pass requests through Cloudflare AI Gateway for cost tracking

**Auth flow:**
1. Client sends request with `Authorization: Bearer <supabase_jwt>`
2. Worker validates JWT signature against Supabase public key
3. Extracts `user_id` from JWT claims
4. Routes to the User Agent Durable Object named by `user_id`

**Routing:**
```
WS  /chat          → User Agent Durable Object (chat)
GET /api/ends      → Worker REST handler → tldr MCP server
GET /api/activity  → Worker REST handler → tldr MCP server
GET /api/habits    → Worker REST handler → tldr MCP server
```

Data view REST endpoints proxy to the tldr MCP server using the user's OAuth token — they do not involve the agent or Anthropic API. The MCP server path is preferred over Supabase direct because the tools already return enriched, structured JSON with hierarchy, area resolution, and habits inline; querying Supabase directly would mean reimplementing that logic in the Worker.

---

### 3. User Agent — Durable Object (Think base class)

**Responsibilities:**
- One instance per user, globally unique by `user_id`
- Persistent conversation history in SQLite
- Full agentic loop: receives message → calls Anthropic API → executes MCP tools → streams response
- Hibernates when idle, wakes on incoming message (zero idle cost)
- Maintains MCP client connection to tldr MCP server

**Key characteristics:**
- Conversation history is persistent across sessions — user resumes where they left off
- No global state — each Durable Object is fully isolated per user
- Streaming via WebSocket — tokens streamed to client as generated
- `maxTurns` configurable per request (default: 10, can be raised for complex queries)
- System prompt and domain knowledge loaded at DO initialization by fetching the MCP server's instructions endpoint — the same mechanism used by Claude Desktop; this keeps agent domain knowledge in one place (the MCP server) and avoids duplication or drift

**MCP integration:**
- Agent holds an MCP client configured with the tldr MCP server URL
- Authentication to MCP server uses OAuth — the same protocol used by LLM clients like Claude
- The SPA handles the OAuth consent dance in the browser; the DO cannot open a browser and does not participate in the authorization flow directly
- OAuth token handoff: on first WebSocket connect, the SPA sends an `init` message containing the OAuth access token and refresh token before any chat messages are exchanged; the DO stores both in SQLite and uses them for all MCP calls
- The MCP server issues tokens scoped to that user and validates them independently — no trust delegation, no service keys, no identity assertion from the agent layer
- Supabase RLS is preserved — the MCP server knows the authenticated user from the token and scopes all queries accordingly
- Token refresh is handled automatically by the Durable Object when the access token expires
- If the user revokes access, the MCP server invalidates the token and the DO receives a 401, triggering re-authorization via the SPA
- Security note: Durable Object SQLite is not encrypted at rest by default; token storage security requirements should be evaluated before production deployment

**Conversation management:**
- SQLite-backed message store (provided by Durable Object)
- Messages stored as: `role`, `content`, `timestamp`, `tool_calls`, `tool_results`
- Conversation compaction handled by Think's native non-destructive summarization overlays — older messages are summarized rather than deleted, preserving full scrollback for the user while keeping the context window manageable; this is Think's responsibility, not ours

---

### 4. AI Gateway — Cloudflare AI Gateway

**Responsibilities:**
- Sits between the User Agent and the Anthropic API
- Per-user cost tracking (keyed by `user_id`)
- Rate limiting per user
- Request logging for debugging and auditing
- Single place to rotate or update the Anthropic API key

**Configuration:**
- One AI Gateway per environment (dev, prod)
- Rate limits: TBD based on usage patterns
- Logging: enabled for prod, with appropriate data retention policy

---

### 5. tldr MCP Server (External Dependency)

**Contract (from this architecture's perspective):**
- Single HTTPS endpoint (URL provided via environment variable)
- Authenticated via OAuth — issues and validates tokens for user sessions
- Exposes all tldr tools as defined by the MCP server implementation
- Exposes an instructions endpoint consumed by the DO at initialization for system prompt / domain knowledge
- Deployment location (Railway, Cloudflare Workers, etc.) is out of scope

**Environment variables:**
```
TLDR_MCP_URL=https://...
```

---

## Data Flow: Chat Message

```
1. User types message in React SPA
2. SPA sends message over open WebSocket
3. Cloudflare Worker validates JWT, routes to User Agent DO
4. User Agent appends message to SQLite history
5. User Agent calls Anthropic API (via AI Gateway) with:
   - System prompt
   - Full conversation history
   - Available MCP tools
6. Anthropic returns tool call(s)
7. User Agent executes tool(s) against tldr MCP server
8. Tool results returned to Anthropic
9. Steps 6-8 repeat up to maxTurns
10. Anthropic generates final response
11. Tokens streamed back to SPA via WebSocket as generated
12. User Agent appends assistant response to SQLite history
13. SPA renders streamed response
```

---

## Data Flow: Data View (e.g. Ends Hierarchy)

```
1. User navigates to Ends view in SPA
2. SPA calls GET /api/ends with JWT
3. Cloudflare Worker validates JWT
4. Worker calls tldr MCP server with user's OAuth token
5. Returns JSON to SPA
6. SPA renders visualization
```

Data views bypass the agent and Anthropic API entirely — no LLM cost for read-only UI.

---

## Environment Strategy

| Environment | Frontend | Worker | Agent | MCP Server |
|---|---|---|---|---|
| Dev | Localhost / Pages preview | `wrangler dev` | Local DO emulation | Railway dev |
| Staging | Pages preview branch | Workers staging | DO staging | Railway staging |
| Prod | Pages production | Workers production | DO production | Railway prod |

---

## Migration Path from Current Architecture

The migration can be executed incrementally:

**Phase 1 — Agent layer (highest value)**
Deploy the Cloudflare Worker + User Agent Durable Object. Connect to existing tldr MCP server. New chat endpoint replaces Railway `/api/chat`. Frontend continues to work with minimal changes — swap endpoint URL, add WebSocket support.

**Phase 2 — Frontend**
Add streaming support, session history display, and data view UI. Deploy to Cloudflare Pages replacing Vercel.

**Phase 3 — Data views**
Build out the REST data endpoints and corresponding UI views (ends hierarchy, activity feed, dashboards).

**Phase 4 — Cleanup**
Decommission Railway server once all traffic has migrated. MCP server remains on Railway until a separate migration is planned.

---

## Open Questions

1. **Session model** — does a user have one continuous conversation, or can they start fresh sessions? If multiple sessions, how are they surfaced in the UI?
2. **Rate limits** — what are the right per-user limits at launch?
3. **React vs. alternative framework** — React stays for now, but worth evaluating if a lighter framework (e.g. SvelteKit) would be more appropriate as the UI matures.
4. **DO SQLite encryption** — Durable Object SQLite is not encrypted at rest by default; evaluate whether OAuth token storage requires encryption before production deployment.

## Pre-Implementation Verification — Results

### PoC completed 2026-04-24 (`~/Projects/tldr-web/`)

- **AIChatAgent + Anthropic API — PASS.** AIChatAgent (from `@cloudflare/ai-chat`, the implementation behind "Project Think") works with Anthropic Claude Sonnet via `@ai-sdk/anthropic`. The Cloudflare Agent SDK uses the Vercel AI SDK (`ai` package) as its model abstraction layer — both are used directly in the code. MCP tool calling works natively via `this.mcp.connect()` and `this.mcp.getAITools()` — no custom wiring needed. All 61 tldr MCP tools discovered and callable.
- **Conversation persistence — PASS.** SQLite message storage works across messages. `this.messages` accumulates correctly when the client sends full history on each request.
- **OAuth token handoff — NOT YET TESTED.** PoC used a hardcoded API token (`tldr_live_*`). Deferred to Phase 1.

### Key technical findings

- wrangler.toml: use `new_sqlite_classes` (not `new_classes`) in migrations
- `routeAgentRequest` doesn't discover DO bindings in local dev — use `getAgentByName` as manual routing fallback
- Client must send full message history on each WebSocket request (not just the new message)
- `toUIMessageStreamResponse()` required for message persistence (not `toTextStreamResponse`)
- `stopWhen: stepCountIs(10)` enables multi-step tool loops (replaces deprecated `maxSteps`)
- MCP headers go inside `transport.requestInit.headers`, not directly on transport
- `canUseTool` handler must return `{ behavior: "allow", updatedInput: input, toolUseID }` — minimal `{ behavior: "allow" }` fails Zod validation

---

## Next Steps — Phase 1

Phase 1 is greenlit. Scope:

1. **OAuth token handoff** — SPA performs OAuth consent, passes tokens to DO via WebSocket `init`, DO stores in SQLite and uses for MCP calls
2. **React SPA on Cloudflare Pages** — streaming chat with proper token rendering, session history display
3. **AI Gateway** — wire Anthropic calls through Cloudflare AI Gateway for per-user cost tracking
4. **Deploy and cut over** — new chat endpoint replaces Railway `/api/chat`; MCP server stays on Railway unchanged
