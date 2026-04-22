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

- `thesis` and `resolutionNotes` are inquiry-only fields.
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
- `dueDate`, `scheduledDate` are bare `YYYY-MM-DD` — user-local dates, no time component.
- All timestamps in responses include the user's timezone offset (e.g. `2026-04-21T14:00:00-04:00`). `.slice(0, 10)` yields the user-local date.
- Default query ranges: last 30 days for actions/task time; last 7 days for weekly reflection. Only widen when the user explicitly asks.

## Tool Selection Quick Reference

| User says... | Tool | Key params |
|---|---|---|
| "I went to the gym" | `create_action` | habitId, completedAt: "today" |
| "I worked on X for 2 hours" | `log_task_time` | taskId, completedAt, actualDurationMinutes |
| "I finished [task]" | `update_task` | completedAt (recurring: + nextDueAt) |
| "Create a task to check tire pressure every 6 weeks" | `create_task` | recurrence, nextDueAt |
| "What did I do this week?" | `list_actions` | period: "this_week" |
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

1. **Habits** — identity-level. "You haven't logged a gym workout in 5 days."
2. **Recurring tasks** — practical. "Tire pressure was last checked 7 weeks ago."
3. **One-time tasks** — by due date. "Photos and listing is due tomorrow."

## Tool Response Format

All tool responses include IDs alongside display names for related entities. Use these IDs for follow-up tool calls without intermediate lookups.

## Sharing

Ends can be shared with other users (read-only). Shared ends expose their habits and actions to the shared user.

**When listing habits for an end:** always call both `list_habits` (with `endId`) and `list_shared_habits`, then combine results. Shared habits do not appear in the standard `list_habits` response — they are only returned by `list_shared_habits`.

**When listing actions:** `list_actions` returns only your own actions. Shared actions (from other users on shared ends) are not currently surfaced via a separate tool.

## Gotchas

- `list_ends_and_habits`: `areaId` and `portfolioId` are mutually exclusive.
- `list_teams`: use `personId` (not `organizationId`) for "what teams is X in?" Use `__self__` for current user.
- `update_habit`: `endIdsToReplace` ignores `endIdToAdd`/`endIdToRemove`. Choose one approach.
- `update_person`: `teamIds` replaces the entire list; prefer `teamIdsToAdd` for adding.
- `list_actions`: if `period` is set, `fromDate`/`toDate` are ignored.
- `delete_habit`: cascades to all actions. Destructive and not recoverable.
- `delete_portfolio`: does NOT unset `portfolioId` on ends.
- `create_person`: check `list_people` first. Tool returns `duplicateWarning` if similar name exists.
- Person `email` and `lastName` are optional. Only `firstName` is required.
