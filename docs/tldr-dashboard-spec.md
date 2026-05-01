# tldr Dashboard Spec

**Version:** 0.1
**Date:** April 29, 2026
**Status:** Draft

---

## 1. Purpose and Philosophy

The tldr dashboard is a **read-only orientation surface** — a window into the user's life system, not a replacement for the LLM interface. It answers the question: "Where am I right now across my life?" at a glance, without requiring a conversation.

**The LLM is where you shape the system. The dashboard is where you see it.**

The dashboard does not replicate LLM capabilities. It does not create, edit, or delete anything. It surfaces the state of the system visually, in ways that are genuinely better as visuals than as conversational responses — scanning, comparing, tracking trends.

---

## 2. Design Principles

**Orientation over interaction.** Every element exists to help the user understand their current state, not to prompt action directly.

**Area-first organization.** Life areas are the primary navigation frame. The user should be able to scan their whole life at a glance, then drill into any area.

**Signal over noise.** The dashboard surfaces what needs attention — overdue tasks, neglected ends, habit gaps, valuation flags — without overwhelming with data.

**Lightweight.** The dashboard is a companion to the LLM conversation, not a full application. It should feel fast and focused.

**Read-only by default; minimal exceptions.** The only write operations considered are lightweight capture shortcuts (quick habit log, quick task completion) implemented as direct MCP tool calls — no LLM involvement, no token cost. These are constrained CRUD operations, not conversational interactions.

---

## 3. Navigation Structure

The dashboard is organized into five primary views, accessible via top-level navigation:

```
Home  |  Life Areas  |  Ends  |  Activity  |  Upcoming
```

---

## 4. Views

### 4.1 Home — Life at a Glance

**Purpose:** Single-screen summary of the user's whole life system. The first thing they see when they open the dashboard.

**Sections:**

**Life Area Health Strip**
A horizontally scrollable row of all life areas, each showing:
- Area name
- Active ends count
- Time invested in the selected period (from activity log)

Health indicators (on track / habit gap / overdue) are deferred to Phase 2. Phase 1 surfaces the raw data and lets the user draw their own conclusions.

**Today's Focus**
- Tasks due today or overdue
- Habits not yet logged today (for daily habits)
- Quick summary: "3 items need attention today"

**This Week Summary**
- Total time logged this week
- Breakdown by area (small bar chart or proportional strip)
- Habits logged vs. expected this week

**Recent Activity Feed**
- Last 5–7 activity records (habit actions + task completions)
- Each showing: what, when, how long, which end

**Upcoming Flags**
- Tasks due in the next 7 days
- Overdue items
- Valuation assessments due (when valuation feature is active)

---

### 4.2 Life Areas — Domain Deep Dive

**Purpose:** Explore any life area in detail — ends, habits, tasks, and recent activity within that domain.

**Layout:** Area selector on the left (list of all life areas); selected area detail on the right.

**Area Detail Panel:**

*Ends in this area*
- List of all active ends, grouped by type (journey / destination / inquiry)
- Each end shows: name, type badge, supporting end count, attached habit count, open task count
- Destination ends show: due date, days remaining
- Inquiry ends show: thesis snippet if defined

*Habits in this area*
- Each habit: name, recurrence, last logged date, current streak or gap
- Visual cadence indicator: small calendar heatmap or streak dots for the last 30 days

*Open Tasks in this area*
- Sorted by due date
- Overdue tasks flagged
- Estimated duration shown

*Recent Activity*
- Last 10 activity records for this area
- Total time this month in this area

---

### 4.3 Ends — Hierarchy Browser

**Purpose:** See the full end hierarchy — all ends across all areas, organized by belief and supporting end relationships.

**Layout:** Two modes, toggleable:

*Hierarchy View*
- Tree structure: Beliefs at top, Ends beneath each belief, Supporting ends as children
- Each node shows: name, type badge, state badge, area tag
- Expandable/collapsable
- Ends not linked to a belief shown in an "Unlinked Ends" section (data quality signal)

*List View*
- Flat list of all ends, filterable by: area, type, state, portfolio
- Sortable by: name, due date, area, last activity date
- Each row: name, type, state, area, open tasks, last activity

**End Detail Panel (slide-in on click)**
- End name, type, state, purpose
- Linked belief(s)
- Supporting ends (with links)
- Attached habits (name, recurrence, last logged)
- Open tasks (name, due date, estimate)
- Recent activity (last 5 records)
- Valuation summary (if enabled): input estimate, output estimate, active flags

---

### 4.4 Activity — The Log

**Purpose:** Review what has been done, across any time period and any filter combination.

**Filters:**
- Date range (presets: today, this week, this month, last month, custom)
- Life area
- End
- Activity type (habit action / task completion / task time entry)
- Person (with / for)

**Views:**

*Timeline View* (default)
- Chronological list of all activity records
- Each record: date/time, habit or task name, end name, area, duration, notes preview, people tagged
- Grouped by day

*Summary View*
- Aggregated by area and end
- Total time per area (bar chart)
- Total time per end (sorted by most invested)
- People invested in (time logged with/for each person)

*Heatmap View*
- Calendar heatmap (GitHub-style) showing activity intensity by day
- Filterable by area or end

---

### 4.5 Upcoming — Forward View

**Purpose:** See what's coming — tasks, habit cadence expectations, and projected time load for the next period.

**Sections:**

*Overdue*
- All tasks past their due date, sorted by how overdue
- Each: task name, end, area, days overdue, estimate

*Due This Week*
- Tasks due in the next 7 days
- Grouped by day

*Due This Month*
- Tasks due beyond this week but within the month

*Habit Cadence Expectations*
- For each active habit: expected occurrences in the next 7 days based on recurrence
- Last logged date shown
- Gap flag if last logged is already behind expected cadence

*Projected Time Load*
- Estimated total time commitment for the next 7 days based on:
  - Open task estimates (due this week)
  - Expected habit occurrences × average duration
- Broken down by area
- Simple bar showing projected load vs. a reference (e.g., user's typical week)

---

## 5. Global Elements

### 5.1 Header
- tldr wordmark
- User name / avatar
- Link to open LLM chat interface
- Last activity timestamp ("Last logged: 2 hours ago")

### 5.2 Quick Capture (Optional — Phase 2)
A minimal floating action accessible from any dashboard view:
- Log a habit (select habit → duration → done)
- Mark a task complete
- Implemented as a thin UI over the LLM, not direct database writes
- Clearly labeled as a shortcut, not a replacement for the full interface

### 5.3 Notification / Flag Strip
A persistent strip below the header showing active flags:
- Overdue tasks count
- Habit gaps count
- Valuation flags count (when feature is active)
- Orphaned habits/tasks (data quality)
- Clicking any flag navigates to the relevant view

---

## 6. Data Sources

All dashboard data is read from the tldr MCP server via the same tool layer used by the LLM. No separate data pipeline. Key tools used:

| Dashboard Section | Primary Tools |
|---|---|
| Home health strip | list_areas, list_ends, list_tasks, list_activity |
| Life area detail | list_ends, list_habits, list_tasks, list_activity |
| End hierarchy | list_ends (with beliefs, supporting ends, habits) |
| Activity log | list_activity |
| Upcoming | list_tasks (due date filtering), list_habits |
| Valuation signals | get_end_valuation, list_valuation_flags |

---

## 7. Technical Approach

### 7.1 Deployment Architecture

The dashboard is part of the existing `tldr-web` application (`app.tldr4.ai`), not a separate deployment. It shares the same Cloudflare Worker, authentication, and domain.

```
app.tldr4.ai
├── / (or /dashboard)     → Dashboard views (React SPA)
├── /chat                 → LLM conversation (existing)
└── /oauth/consent/*      → OAuth consent (existing)

Data flow:
  Dashboard (browser) → mcp.tldr4.ai/mcp → McpAgent DO → Supabase
  Chat (browser) → WebSocket → UserAgent DO → McpAgent DO → Supabase
```

**The dashboard and chat share the same SPA** — navigation between dashboard views and the chat is client-side routing (React Router), not separate page loads. This enables the "embedding" open question: the chat can be a side panel within the dashboard, or the dashboard can be a side panel within the chat.

### 7.2 Data Fetching

The dashboard uses the browser-side MCP client (`src/lib/mcp.ts`) already implemented for the sidebar data views. This client:

- Connects directly to `mcp.tldr4.ai/mcp` via `StreamableHTTPClientTransport`
- Authenticates with the user's Supabase JWT (same token used for chat)
- Calls MCP tools via JSON-RPC (`tools/call`)
- Returns structured JSON responses

No separate API layer, no BFF (backend-for-frontend), no GraphQL. The MCP server IS the API. The dashboard is a read-only consumer of the same 61 tools the LLM uses.

**Data aggregation** happens client-side. The MCP tools return entity-level data; the dashboard aggregates (time per area, habit streaks, overdue counts) in the browser. If aggregation becomes expensive, dedicated summary tools can be added to the MCP server later.

### 7.3 Authentication

Same OAuth 2.1 / Supabase Auth model as the existing web app. The user logs in once and both the chat and dashboard share the session. Per-user data isolation is enforced by Supabase RLS at the database layer.

### 7.4 Caching and Refresh

**Initial:** On-demand data fetching on page load and view navigation. Each view calls the MCP tools it needs and renders. No client-side cache beyond React state.

**Phase 2:** SWR (stale-while-revalidate) pattern — show cached data immediately, refresh in background. The MCP tools are fast (single Supabase queries), so stale data windows are short.

**Phase 3:** Real-time updates via polling (30-60 second interval on the Home view) or WebSocket subscription to the MCP server. This would require a new MCP capability (server-initiated notifications via SSE), which the McpAgent DO infrastructure already supports.

### 7.5 Rendering

React SPA with Tailwind CSS, consistent with the existing `tldr-web` codebase. Chart library (e.g., Recharts or Chart.js) for bar charts and heatmaps. The dashboard must be responsive:

- **Desktop:** Full multi-column layouts, hierarchy browser, side-by-side panels
- **Tablet:** Collapsed navigation, single-column detail panels
- **Mobile:** Home and Upcoming as primary views, simplified layouts, touch-friendly targets

### 7.6 Quick Capture Architecture

Quick Capture (Phase 2) should call MCP tools directly — not through the LLM. Routing a habit log through the LLM costs ~$0.18 in API tokens for a one-second interaction. The MCP tools (`create_action`, `update_task`) are simple CRUD operations that don't need LLM interpretation.

```
Quick Capture (browser) → mcp.tldr4.ai/mcp → create_action / update_task → Supabase
```

This is the one intentional exception to the "read-only dashboard" principle. The write operations are constrained to two specific actions (log habit, complete task) with minimal UI (select entity → confirm → done).

---

## 8. Phasing

**Phase 1 — Core Orientation**
- Home (Life at a Glance)
- Upcoming (task and overdue view)
- Activity (timeline and summary)
- Ends hierarchy browser with end detail panel
- People view (time invested per person, with/for breakdown)
- Belief alignment view (beliefs → ends → recent activity, gap highlighting)

**Phase 2 — Depth and Interaction**
- Life Areas deep dive
- Activity heatmap views
- Quick Capture shortcuts (direct MCP calls, not LLM)
- Projected time load

**Phase 3 — Enrichment**
- Valuation signals integration
- Real-time updates (polling or WebSocket)
- Shared ends view ("Shared with me")
- Push notifications

---

## 9. Design Review Notes

### 9.1 Phasing Decisions

The **Ends Hierarchy Browser**, **People View**, and **Belief Alignment View** have been moved to Phase 1 (see Section 8). These views represent tldr's core differentiators — the hierarchy, relationship tracking, and belief-to-action alignment — and should be visible from the first release.

The **Activity Heatmap** remains in Phase 2 as it's a known engagement driver but not structurally unique to tldr.

### 9.3 Notification Strip Count Budget

If a user has 12 overdue tasks, 5 habit gaps, 3 valuation flags, and 2 orphaned habits, that's 22 items competing for attention. Consider showing only the top 2-3 most urgent flags with a "see all" link, or grouping by severity rather than listing individual counts.

---

## 10. Open Questions

- **Notifications:** Should the dashboard support push notifications (e.g., "You have 3 overdue tasks")? Likely a Phase 3 consideration.
- **Personalization:** Should users be able to configure which sections appear on the Home view? Low priority initially — start with a well-designed default.
- **Sharing:** If ends can be shared between users, should the dashboard have a "Shared with me" section? Probably yes in Phase 2.
- **Embedding:** The dashboard and chat share the same SPA (Section 7.1), so embedding the chat as a side panel within the dashboard (or vice versa) is a client-side routing decision, not an architectural one. Worth exploring as a Phase 2 UX experiment — it would reduce context switching and let users reference dashboard data while conversing with the LLM.

---

*This spec should be read alongside the tldr Website Product Spec, the End State & Implicit Cascade Spec, and the End Resource Valuation Spec.*
