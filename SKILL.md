# tldr MCP Server — Skill Context

You are connected to the tldr MCP server, a productivity system organized around beliefs, aspirations, habits, tasks, and relationships. This document defines how to use the tools correctly.

## Data Model

```
Beliefs (core values)
Areas (10 life domains: Career, Family, Health, etc.)
Ends (aspirations/goals/investigations)
  ├── end_type: journey (ongoing) | destination (bounded goal) | inquiry (hypothesis)
  ├── state: per-type state machine (see below)
  └── Habits (recurring behaviors serving ends)
      └── Actions (logged habit completions)
Tasks (work items — one-off or recurring)
  └── Task Time (work sessions logged against tasks)
Organizations → Teams → People
Portfolios (groupings of ends by owner)
```

### End Types and State Machines

| Type | Valid States | Transitions |
|------|-------------|-------------|
| journey | active, paused, archived | active ↔ paused → archived |
| destination | active, completed, abandoned | active → completed \| abandoned |
| inquiry | active, resolved, abandoned | active → resolved \| abandoned |

- `purpose` — optional on all end types. Captures why the end exists. Distinct from `thesis` (inquiry question), `rationale` (support link context), and `beliefs` (philosophical values). When creating or updating an end, set `purpose` to give the LLM richer context for recommendations and reflection.
- `thesis` and `resolutionNotes` are inquiry-only fields. For inquiry ends, `purpose` (why it matters) and `thesis` (what's being investigated) coexist.
- State transitions are server-validated. Invalid transitions return errors.
- Changing `endType` resets state to `active` if the current state is invalid for the new type.

## Critical Distinctions

### Habits vs Recurring Tasks

| | Habit | Recurring Task |
|---|---|---|
| Purpose | Identity-level behavioral commitment | Periodic maintenance/work item |
| Track via | `create_action` (log completions) | `update_task` with `completedAt` (marks complete, auto-reopens) |
| Recurrence | Descriptive only — no computed `nextDueAt` | Drives `next_due_at` computation and query filtering |
| Projection weight | High (surfaced first — identity gaps) | Medium (surfaced second — practical gaps) |

**Rule:** "I went to the gym" → `create_action`. "Check tire pressure" → `update_task` with `completedAt`.

### Preferred Days

Both habits and recurring tasks support an optional `preferredDays` field — a natural language expression of which days the user prefers to perform the behavior (e.g., "M,W,F", "weekdays", "Thursday", "1st of the month").

**When to set:** When a user describes when they do a habit or recurring task (e.g., "I go to the gym on Tuesdays and Thursdays", "I do badge fabrication on Monday and Thursday"), extract and set `preferredDays` alongside the creation or update. Don't wait for the user to explicitly say "set preferred days."

**Relationship to recurrence:** `recurrence` defines *how often* (e.g., "3x week"). `preferredDays` defines *which days* (e.g., "M,W,F"). When `preferredDays` specifies more candidate days than `recurrence` allows, treat `preferredDays` as a candidate pool and `recurrence` as the frequency constraint.

**Recurring task nextDueAt:** When computing `nextDueAt` for a recurring task with `preferredDays`, the recurrence defines the cycle boundary and `preferredDays` determines placement within the next cycle. Example: "weekly" + "Thursday" completed on Tuesday → next Thursday of next week.

### list_activity vs list_actions vs list_task_time

| | list_activity | list_actions | list_task_time |
|---|---|---|---|
| Returns | Both habit actions + task time, merged | Habit actions only | Task time only |
| Use for | "What did I do today?" | Filter by specific habit | Filter by specific task |
| Grouping | area, end, portfolio | No | No |

**Rule:** Default to `list_activity` for general "what did I do" queries. Use `list_actions` or `list_task_time` only when filtering by a specific habit or task.

### Summarizing list_activity results

When presenting `list_activity` results, **include every item returned**. Don't omit items based on perceived significance, duration, type (action vs. task_time), or category — the user already chose the period and grouping when they asked. Filtering at the presentation layer hides data and erodes trust in the totals.

The only acceptable reason to drop an item is if the user explicitly asks for it ("just gym actions", "skip anything under 15 minutes"). Same rule applies to `list_actions`, `list_task_time`, and `list_tasks` summaries.

### create_action vs log_task_time

| | create_action | log_task_time |
|---|---|---|
| Records | Habit completion | Time spent working on a task |
| Input | `habitId` | `taskId` |
| Effect | Creates action record | Creates time entry; does NOT complete the task |

**Rule:** Habit done → `create_action`. Worked on a task → `log_task_time`. Finished a task → `update_task` with `completedAt`.

## Recurring Task Lifecycle

Recurring tasks are single persistent records, not copies.

**On completion of a recurring task:**
1. `last_completed_at` = completion timestamp
2. `next_due_at` = recomputed from recurrence + completion date
3. `completedAt` = null (auto-reopened)

**Your responsibility when completing a recurring task:**
Compute `nextDueAt` from the `recurrence` string and `completedAt` before calling `update_task`. Example: recurrence "weekly", completedAt "2026-04-21" → nextDueAt "2026-04-28". The server computes as fallback, but you should provide it.

**Your responsibility when creating a recurring task:**
If `recurrence` is set and `nextDueAt` is not provided, compute `nextDueAt` from the recurrence string and `completedAt` (or today). Pass it in the `create_task` call.

**Your responsibility when changing recurrence:**
Recompute `nextDueAt` from the new recurrence string and `lastCompletedAt` (or `createdAt` if never completed).

**nextDueAt override:** When `nextDueAt` is provided directly by the user, pass as-is — it's a one-cycle override. Recurrence logic resumes on next completion.

**Query behavior:** All open tasks (including recurring tasks not yet due) appear in default `list_tasks` queries. Use `dueBy` to narrow to tasks due by a specific date — this checks both `dueDate` (one-off) and `next_due_at` (recurring).

## Date and Timezone Rules

- `completedAt` fields accept: `"today"` | `"yesterday"` | `"tomorrow"` | `YYYY-MM-DD` | full ISO timestamp. The server resolves relative terms and bare dates in the user's timezone.
- **Default completedAt is "today".** When logging an action or task time entry and the user does not explicitly specify a date, always use `"today"` — never infer a date from conversational context. Only use a specific `YYYY-MM-DD` when the user explicitly states a past date (e.g., "log this for yesterday", "I did this on Tuesday"). Long conversations may span multiple dates — the date being discussed is not necessarily the date the activity occurred.
- `dueDate`, `scheduledDate` are bare `YYYY-MM-DD` — user-local dates, no time component.
- All timestamps in responses include the user's timezone offset (e.g. `2026-04-21T14:00:00-04:00`). `.slice(0, 10)` yields the user-local date.
- Default query ranges: last 30 days for actions/task time; last 7 days for weekly reflection. Only widen when the user explicitly asks.

### Temporal Metadata

Activity records from `list_activity` include server-computed temporal fields: `dayOfWeek` (e.g., "Monday"), `dayOfMonth` (e.g., 24), and `weekOfMonth` (e.g., "last"). These are computed in the user's timezone and are authoritative — **use these fields instead of computing day-of-week or week-of-month from timestamps yourself.** This avoids off-by-one errors and timezone edge cases.

Use temporal metadata for:
- Inferring `preferredDays` from activity patterns ("4 of your last 8 gym sessions were on Fridays")
- Day-of-week analysis in reflections ("your most active days were Monday and Thursday")
- Monthly pattern detection ("you consistently reconcile on the last Friday of the month")

## Cadence Signals

Habits and tasks include server-computed signals for cadence-gap reasoning. **Use these fields directly — don't compute days-since or interval from raw timestamps.**

### Habit fields (from `list_habits`, `get_habit`, and inline in `list_ends` / `get_end`)

- `lastActionAt` — ISO timestamp of the most recent action, or `null` if never logged.
- `daysSinceLastAction` — calendar days since `lastActionAt` in the user's timezone. `null` if never logged.
- `expectedIntervalDays` — typical interval implied by `recurrence` (e.g., `daily` → 1, `weekly` → 7, `3x week` → 2, `monthly` → 30). `null` for habits with no recurrence or with an unparseable one.
- `actionCountLast30Days` — number of actions logged in the last 30 days.

### Task fields (from `list_tasks`, `get_task`, and inline in `list_ends` / `get_end`)

- `daysOverdue` — positive when past due, negative when not yet due, `null` when completed or no due date. Based on `nextDueAt` for recurring, `dueDate` for one-off.

### Interpretation

A habit is **behind** when `daysSinceLastAction > expectedIntervalDays × 1.5`. Adjust based on context — a daily streak habit (meditation) is more sensitive to gaps than a forgiving one (weekly reflection).

For weekly reflection, sort habits by the largest `daysSinceLastAction / expectedIntervalDays` ratio first. `actionCountLast30Days` is a frequency view robust to single missed weeks — use it to distinguish "off the wagon" from "had one busy week."

For tasks, `daysOverdue > 0` is overdue and the magnitude tells you how late. Negative values are upcoming and useful for "what's coming up this week."

### Reflection principles

- Lead with what's true, not what's nice. Don't bury a 3-week gap under encouragement.
- Surface few things, well. Three or four concrete observations beat fifteen shallow ones.
- Frame gaps in terms of the user's stated commitment when possible — "you said this matters" lands harder than "you missed your gym sessions."
- Wins matter. Cadence signals make it easy to over-index on what's broken — surface streaks alongside gaps.
- Don't moralize. Surface the data; the user decides.

## ID Resolution — Never Guess

**Always look up IDs before creating or updating records.** Never fabricate or guess a UUID. A foreign key constraint error means an ID was wrong — never retry with another guess; always look up the correct ID first.

### Lookup strategy by record type

- **End ID** — use `list_ends` (filter by `areaId` or `portfolioId` when possible) before `create_task`, `create_habit`, or `update_habit`
- **Habit ID** — use `list_habits` (filter by `endId`) before `create_action` or `update_habit`
- **Person ID** — use `list_people`
- **Area ID** — use `list_areas`
- **Portfolio ID** — use `list_portfolios`
- **Team / Organization ID** — use `list_teams` / `list_organizations`

### When IDs are already known

- IDs surfaced earlier in the same conversation (e.g., a habit returned by `list_habits` a few turns ago) can be reused without re-listing.
- IDs stored in client-side memory (e.g., key people pinned by the calling client) can be used directly. If a call fails with a foreign key error, treat the cached ID as stale and re-list before retrying.

## Tool Selection Quick Reference

### Resolving what to log

When a user asks to log an activity and you're unsure whether it's a habit or task, search both before logging. Call `list_habits` and `list_tasks` (or use `list_ends` which includes both inline) to find a match by name. Don't guess — a wrong match means logging against the wrong entity.

| User says... | Tool | Key params |
|---|---|---|
| "I went to the gym" | `create_action` | habitId, completedAt: "today" |
| "I worked on X for 2 hours" | `log_task_time` | taskId, completedAt, actualDurationMinutes |
| "I finished [task]" | `update_task` | completedAt (recurring: + nextDueAt) |
| "Create a task to check tire pressure every 6 weeks" | `create_task` | recurrence, nextDueAt |
| "What did I do today?" | `list_activity` | period: "today" |
| "What did I do this week?" | `list_activity` | period: "this_week" |
| "Break down my week by area" | `list_activity` | period: "this_week", groupBy: "area" |
| "What's due?" | `list_tasks` | completed: false, dueBy: today's date |
| "Show all open tasks" | `list_tasks` | completed: false |
| "What's coming up this month?" | `list_tasks` | dueBy: end-of-month date |
| "I want to be a better father" | `create_end` | endType: "journey" |
| "Launch the product by June" | `create_end` | endType: "destination", dueDate |
| "Is this product line viable?" | `create_end` | endType: "inquiry", thesis |
| "Mark [end] as complete" | `update_end` | state: "completed" (destination only) |
| "Resolve [inquiry]" | `update_end` | state: "resolved", resolutionNotes |
| "Add person to team" | `update_person` | teamIdsToAdd (NOT teamIds, which replaces) |

## Projection Priority

When advising on what to focus on, surface gaps in this order:

1. **Habits behind** — identity-level. Filter where `daysSinceLastAction > expectedIntervalDays × 1.5`. "You haven't logged a gym workout in 12 days; expected interval is 2-3."
2. **Tasks overdue** — practical. Filter where `daysOverdue > 0`, sort descending. "Tire pressure check was due 7 days ago."
3. **Upcoming tasks** — by `daysOverdue` ascending (negative values = days until due). "Photos and listing is due tomorrow."

## Tool Response Format

All tool responses return structured JSON:
- **List tools**: `{ <plural>: [...], count: N }` — e.g. `{ beliefs: [{id, name, ...}], count: 3 }`
- **Single-entity tools** (get/create/update): `{ <singular>: {id, name, ...} }`
- **Delete tools**: `{ deleted: {id, name} }`
- **Errors**: plain text with `isError: true`

Related entities are included inline with `{id, name}` — use these for follow-up tool calls without intermediate lookups. All fields are present with `null` for unset values (no ambiguity from omission).

## Supporting Ends

Ends can have parent-child relationships via `link_supporting_end`. Max depth: 3 tiers (grandparent → parent → leaf).

- `get_end` returns `supportingEnds` (children) and `supports` (parents) arrays.
- `list_ends` returns full `supportingEnds` and `supports` arrays per end, plus `habits` and `openTasks`.
- `create_end` accepts optional `parentEndId` to create and link in one call.
- All end type combinations are valid (journey → destination, inquiry → destination, etc.).
- State does NOT propagate — parent and child states are independent.

| User says... | Tool |
|---|---|
| "Break this goal into sub-goals" | `create_end` with `parentEndId` |
| "Link existing end as supporting" | `link_supporting_end` |
| "What supports this end?" | `get_end` → `supportingEnds` |
| "What does this end support?" | `get_end` → `supports` |

## Sharing

Ends can be shared with other users (read-only). Shared ends expose their habits and actions to the shared user.

**When listing habits for an end:** always call both `list_habits` (with `endId`) and `list_shared_habits`, then combine results. Shared habits do not appear in the standard `list_habits` response — they are only returned by `list_shared_habits`.

**When listing actions:** `list_actions` returns only your own actions. Shared actions (from other users on shared ends) are not currently surfaced via a separate tool.

## Gotchas

- `list_ends` is the single authoritative tool for ends overview — includes habits, open tasks, supporting ends, and parent ends. No need for separate habits or tasks calls when viewing ends.
- `list_teams`: use `personId` (not `organizationId`) for "what teams is X in?" Use `__self__` for current user.
- `update_habit`: `endIdToReplace` ignores `endIdToAdd`/`endIdToRemove`. Choose one approach.
- `update_person`: `teamIds` replaces the entire list; prefer `teamIdsToAdd` for adding.
- `list_actions`: if `period` is set, `fromDate`/`toDate` are ignored.
- `delete_habit`: cascades to all actions. Destructive and not recoverable.
- `delete_portfolio`: does NOT unset `portfolioId` on ends.
- `create_person`: check `list_people` first. Tool returns `duplicateWarning` if similar name exists.
- Person `email` and `lastName` are optional. Only `firstName` is required.
