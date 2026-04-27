# Recurring Tasks Spec

## Overview

Add recurrence support to tasks, enabling lightweight tracking of periodic maintenance and operational items without the behavioral commitment implied by habits. Recurring tasks and habits serve different purposes in the system — habits are identity-level behavioral commitments; recurring tasks are practical items that need to happen periodically.

This distinction is meaningful for the LLM projection use case: habit gaps are surfaced first (higher semantic weight), recurring task gaps are surfaced second (practical/maintenance weight).

---

## Motivation

Not everything that recurs warrants a habit. Habits carry an implicit commitment and streak psychology. Items like "check tire pressure," "follow up with Crescent Brands," or "review pricing" are periodic maintenance items — they need to happen on a cadence but don't represent identity-level behavioral commitments.

Recurring tasks provide the recurrence signal the projection engine needs (last done + expected interval = overdue or approaching) without the overhead of habit management.

---

## New Fields on Tasks

### `recurrence` (string, optional)
A natural language frequency string describing how often this task should recur.

Examples: `daily`, `weekly`, `semi-monthly`, `monthly`, `every 6 weeks`, `quarterly`, `every 3 months`

- Optional — tasks without recurrence behave as today (one-time items).
- When present, the task becomes a persistent maintenance record rather than a one-time item.
- Free-form natural language — no strict enum. The LLM interprets this string at the point of task creation or completion to compute `next_due_at`. The server stores the string as-is and never parses it directly.

### `last_completed_at` (datetime, derived)
The most recent completion timestamp for this task.

- Derived from the task's completion history (task time logs or completedAt).
- When a recurring task is marked complete, `last_completed_at` is updated and the task is reopened automatically (see Lifecycle below).
- Stored on the task record for efficient querying.

### `next_due_at` (datetime, server-computed)
The next date this recurring task is due, computed server-side from `last_completed_at + recurrence_interval`.

- Computed and stored by the server whenever `last_completed_at` or `recurrence` changes.
- For tasks with no `last_completed_at` (never completed), computed from `created_at + recurrence_interval`.
- Null for non-recurring tasks.
- Used by `list_tasks` for efficient filtering — eliminates the need for the LLM to parse recurrence strings and compute intervals at query time.
- Not stale-prone: only two triggers require recalculation — task completion and recurrence change — both explicit server-side events.

---

## Lifecycle of a Recurring Task

Recurring tasks do **not** spawn copies of themselves on completion. Instead, the single task record persists and is updated:

1. User completes the recurring task (with optional past `completedAt` date).
2. LLM interprets `recurrence` string + `completedAt` → computes `next_due_at`.
3. System records `last_completed_at` = `completedAt`.
4. System stores computed `next_due_at`.
5. System **reopens** the task (sets `completedAt` back to null).
6. Task remains active, surfacing again when `next_due_at <= today`.

This keeps the task list clean — one record per recurring item, not an ever-growing list of completed copies.

**Non-recurring tasks** behave as today — complete once, stay completed.

---

## Next Due Computation

`next_due_at` is **stored server-side** but **computed by the LLM** at the point of task creation or completion — not at query time and not by server-side string parsing.

**Why LLM-computed at event time, stored server-side:**
- Server-side parsing of free-form recurrence strings is fragile and error-prone.
- Computing at query time requires O(n) LLM calls over all recurring tasks on every query — expensive and slow.
- Computing once at creation/completion and storing the result is efficient: the LLM interprets the natural language exactly once per event, and all subsequent queries just read the stored date.

**Computation logic:**

| Situation | next_due_at |
|---|---|
| Task created with recurrence, no completion | `created_at + recurrence_interval` |
| Task created with past completion date | `completed_at + recurrence_interval` |
| Task completed (subsequent completions) | `completed_at + recurrence_interval` |
| `recurrence` field updated | `last_completed_at + new recurrence_interval` (or `created_at` if never completed) |

**Recalculation triggers:**
1. Task created with `recurrence` → LLM computes `next_due_at` from `created_at` (or `completedAt` if provided)
2. Recurring task completed → LLM computes `next_due_at` from `completed_at`
3. `recurrence` field updated → LLM recomputes `next_due_at` from `last_completed_at`

The LLM reads `next_due_at` directly at query time — no computation needed.

---

## Projection Behavior

The LLM uses recurrence data in projection and planning conversations with the following priority order:

1. **Habits** — surfaced first. Gaps in habits are identity-level signals (higher semantic weight).
2. **Recurring tasks** — surfaced second. Gaps here are practical/maintenance signals.
3. **One-time tasks** — surfaced by due date as today.

Example projection prompt behavior:
- "You haven't logged a gym workout in 5 days — that's below your 3x/week target." *(habit gap)*
- "Tire pressure was last checked 7 weeks ago — you may want to check it soon." *(recurring task gap)*
- "Photos and listing for satin finish is due today." *(one-time task)*

---

## API / Data Layer Changes

- Add `recurrence` (nullable string) to the tasks table.
- Add `last_completed_at` (nullable datetime) to the tasks table.
- Add `next_due_at` (nullable datetime) to the tasks table. Server-computed by default; user-settable for one-time overrides. On next completion, recurrence logic recomputes and overwrites the user-set value.
- On completion of a recurring task (where `recurrence` is not null):
  - Set `last_completed_at` = completion timestamp
  - Set `next_due_at` = completion timestamp + recurrence_interval
  - Set `completedAt` = null (reopen)
- On update of `recurrence` field:
  - Recompute `next_due_at` = `last_completed_at` + new recurrence_interval (or `created_at` if never completed)
- On completion of a non-recurring task: behavior unchanged.
- Expose `recurrence`, `last_completed_at`, and `next_due_at` in task API responses.
- Accept `recurrence` as an optional field on task create and update.

---

## MCP Tool Changes

- `create_task`: add optional `recurrence` parameter; add optional `completedAt` parameter for recurring tasks being created after the fact with a known last completion date; add optional `nextDueAt` parameter to allow user override of computed value. Tool description should instruct the calling LLM: *"When `recurrence` is provided and `nextDueAt` is not, compute `nextDueAt` from the recurrence string and `completedAt` (or today if not provided) before calling this tool."* The MCP server also computes `next_due_at` server-side if not provided — belts and suspenders.
- `update_task`: add optional `recurrence` parameter; add optional `nextDueAt` parameter for user override. Tool description should instruct the calling LLM: *"When `recurrence` changes and `nextDueAt` is not provided, recompute `nextDueAt` from the new recurrence string and `last_completed_at` (or `created_at` if never completed). When `nextDueAt` is provided directly, pass as-is — this is a one-cycle override, recurrence logic resumes on next completion."* The MCP server also enforces this server-side as a fallback.
- `complete_task` (or `update_task` with `completedAt`): when completing a recurring task, tool description should instruct the calling LLM: *"When completing a recurring task (one with a `recurrence` value), compute `nextDueAt` from the recurrence string and `completedAt` before calling this tool."* The MCP server recomputes server-side as a fallback, then reopens the task by setting `completedAt` to null.
- `list_tasks`: add optional `dueBy` parameter (date) — returns tasks where `due_date <= dueBy OR next_due_at <= dueBy`. Recurring tasks with `next_due_at` in the future are excluded from default open task queries.
- `log_task_time`: no changes needed.

---

## Validation Rules

- `recurrence` is optional on all tasks.
- `last_completed_at` is read-only — set by the system on completion, not by the user directly.
- `last_completed_at` is read-only — set by the system on completion, not by the user directly.
- `next_due_at` is user-settable. If the user manually sets `next_due_at`, it overrides the computed value for the current cycle only. On the next completion, the recurrence logic takes back over and recomputes `next_due_at` from `completed_at + recurrence_interval` as normal. This allows one-time adjustments (push out or pull in) without permanently altering the recurrence pattern.
- A recurring task with no `last_completed_at` has never been completed — `next_due_at` is computed from `created_at + recurrence_interval`.
- Recurring tasks with `next_due_at` in the future should not appear in default open task queries — only surface when `next_due_at <= today` or within a specified `dueBy` window.

---

## Design Principle: Belts and Suspenders for LLM-Computed Fields

This spec introduces a pattern worth applying broadly across tldr's MCP tools:

**Tool description instructs the calling LLM; server enforces as fallback.**

- Tool descriptions include explicit instructions for any computation the calling LLM should perform before calling the tool (e.g. computing `nextDueAt` from a recurrence string).
- The MCP server independently enforces the same invariant — if the calling LLM missed the instruction, used a different client, or the tool was called directly via API, the server catches it.
- This makes invariants robust to caller variability without requiring the server to trust any single caller.

Apply this pattern to other tools where computed or validated fields exist, including end_type state machine validation and any future LLM-interpreted fields.

---

## Migration

No migration needed for existing tasks. Existing tasks have `recurrence` = null and behave as one-time items as today.

---

## Example Recurring Tasks

| Task | End | Recurrence |
|---|---|---|
| Check tire pressure | Maintain Vehicles | every 6 weeks |
| Wash car | Maintain Vehicles | monthly |
| Schedule oil change | Maintain Vehicles | every 3 months |
| Follow up with Crescent Brands | LED Logo Panel | every 2 weeks |
| Review pricing | Financial Management | monthly |
