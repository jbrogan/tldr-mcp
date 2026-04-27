# Timer Spec

## Overview

Add server-side timer support to enable automatic duration calculation for habits and tasks. When a user starts an activity, a timer is created server-side with a timestamp. When the activity is completed, the system calculates elapsed time automatically, eliminating the need for the user to manually report duration.

---

## Motivation

Currently, logging an action or task time entry requires the user to report the duration manually. This creates friction and inaccuracy — users have to remember how long they spent or estimate after the fact. A server-side timer removes this friction by recording the start time and computing duration automatically on completion.

---

## New Concepts

### Active Timer
A server-side record that tracks an in-progress activity. Each timer has:
- `id` — unique identifier
- `user_id` — owner
- `entity_type` — `habit` or `task`
- `entity_id` — ID of the habit or task being timed
- `started_at` — UTC timestamp when the timer was started
- `notes` — optional notes captured at start or completion
- `created_at`

Only one active timer per entity per user at a time. Starting a timer on an entity that already has an active timer should warn the user and offer to replace it.

---

## New Tools

### `start_timer`
Starts a timer for a habit or task.

**Parameters:**
- `entityType` (required) — `habit` or `task`
- `entityId` (required) — ID of the habit or task
- `notes` (optional) — notes about the activity

**Behavior:**
- Creates an active timer record with `started_at` = now
- Returns the timer ID and started_at timestamp
- If an active timer already exists for this entity, warns the user and asks whether to replace it

**Example:**
```
User: "Starting my weekly planning session"
→ start_timer(entityType: "habit", entityId: "b350cc4e...")
→ "Timer started for Weekly Planning Session at 2:15 PM"
```

---

### `stop_timer`
Stops an active timer and logs the completed action or task time entry.

**Parameters:**
- `entityId` (required) — ID of the habit or task (used to find the active timer)
- `notes` (optional) — additional notes to append to the action/task time entry

**Behavior:**
- Finds the active timer for the entity
- Calculates `actualDurationMinutes` = (now - started_at) rounded to nearest minute
- Creates the action (for habits) or task time entry (for tasks) with the calculated duration
- Deletes the active timer record
- Returns a summary: activity name, start time, end time, duration

**Example:**
```
User: "Done with planning session"
→ stop_timer(entityId: "b350cc4e...")
→ "Weekly Planning Session logged: 2:15 PM – 3:08 PM (53 min)"
```

---

### `list_timers`
Lists all active timers for the current user.

**Parameters:** none

**Returns:** list of active timers with entity name, type, started_at, and elapsed time so far

Useful for: "what timers do I have running?" or detecting forgotten timers.

---

### `cancel_timer`
Cancels an active timer without logging an action.

**Parameters:**
- `entityId` (required) — ID of the habit or task

**Behavior:**
- Deletes the active timer record
- Does not create any action or task time entry

---

## Integration with Existing Tools

Existing `create_action` and `log_task_time` tools are unchanged. If the user provides a duration manually, those tools work exactly as today. The timer system is additive — it provides an alternative path to the same outcome when the user wants automatic duration tracking.

**Optional enhancement (future):** when `create_action` or `log_task_time` is called without a duration, automatically check for an active timer on that entity and use it if found.

---

## Data Layer

### New table: `active_timers`

```sql
CREATE TABLE active_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('habit', 'task')),
  entity_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_id)
);
```

The `UNIQUE (user_id, entity_id)` constraint enforces one active timer per entity per user.

---

## API / MCP Tool Changes

Add three new MCP tools: `start_timer`, `stop_timer`, `list_timers`, `cancel_timer`.

No changes to existing tools required.

---

## UX Considerations

- `list_timers` should be called proactively at the start of a session if timers may have been left running from a previous session — forgotten timers are a likely failure mode.
- Timer elapsed time should be displayed in a human-readable format: "started 47 minutes ago" rather than a raw timestamp.
- If a timer has been running for an unusually long time (e.g. > 4 hours), surface a warning: "You have a timer running for Daily Dev Session — started 6 hours ago. Still going?"

---

## Migration

No migration needed for existing data. New table only.

---

## Example Conversation Flow

```
User: "Starting my weekly planning session"
Claude: start_timer(habit, Weekly Planning Session ID)
→ "Timer started — Weekly Planning Session, 2:15 PM"

[50 minutes later]

User: "Done with my planning session, focused on LED Logo Panel and retirement tasks"
Claude: stop_timer(Weekly Planning Session ID, notes: "Focused on LED Logo Panel and retirement tasks")
→ "Logged: Weekly Planning Session, 2:15–3:05 PM, 50 min"
```
