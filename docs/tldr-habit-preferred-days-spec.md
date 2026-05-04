# tldr: Preferred Days Spec (Habits and Recurring Tasks)

**Version:** 0.2
**Date:** May 3, 2026
**Status:** Draft

---

## 1. Overview

This spec defines the `preferredDays` field for **habits** and **recurring tasks** — an optional text field that captures *when* within a recurrence cycle a user prefers to perform a behavior or complete a task instance. It complements the existing `recurrence` field (which defines *how often*) by adding *which days*.

The field applies to two entities with slightly different semantics:

- **Habits** — `preferredDays` defines cadence: which days of the week/month a recurring behavior should be scheduled. There is no single scheduled date; the field distributes occurrences across preferred days within the recurrence cycle.
- **Recurring tasks** — `preferredDays` defines scheduling intent for each recurrence instance. One-off tasks already have `scheduledDate` for this purpose; `preferredDays` fills the equivalent gap for recurring tasks where `scheduledDate` only captures a single date and doesn't carry forward to future recurrences.

One-off tasks are not in scope — `scheduledDate` handles them adequately.

This is a product discussion document. Implementation details are indicative, not final.

---

## 2. Motivation

### Current state
The habit data model has:
- `recurrence` — natural language frequency: "daily", "3x week", "semimonthly", "every 6 weeks"
- `durationMinutes` — expected time per instance

The recurring task data model has:
- `recurrence` — same natural language frequency
- `scheduledDate` — a single date for when to work on the task (one-off only; does not carry forward to future recurrences)
- `estimatedDurationMinutes` — expected time per instance

Both are sufficient for tracking and analysis, but insufficient for projection and scheduling. When building a weekly schedule, "3x week" tells you how many sessions to plan, but not which days to place them on. For recurring tasks, `scheduledDate` only captures the next planned instance — it provides no signal for where future recurrences should land.

### The gap
Without preferred day information, the scheduling engine must either:
- Place habits and recurring tasks arbitrarily across the week, or
- Infer day-of-week patterns from historical activity logs (possible but unreliable, especially for newer habits or inconsistent logging)

### The solution
An optional `preferredDays` text field on both habits and recurring tasks that captures the user's intent — expressed in natural language — for when they want to perform or work on each instance within their recurrence cycle.

---

## 3. Field Definition

```
habits (addition):
  preferredDays    text, optional
                   Natural language expression of preferred day(s) within the
                   recurrence cycle. Interpreted at scheduling/projection time.

tasks (addition — recurring tasks only):
  preferredDays    text, optional
                   Natural language expression of preferred day(s) for each
                   recurrence instance. Applies only when recurrence is set.
                   One-off tasks use scheduledDate instead.
```

### Example values

| preferredDays | Meaning |
|---|---|
| `"M,W,F"` | Monday, Wednesday, Friday |
| `"Thursday"` | Any Thursday |
| `"Mon,Thu"` | Monday and Thursday |
| `"weekdays"` | Any weekday (Mon–Fri) |
| `"weekends"` | Saturday or Sunday |
| `"1st of the month"` | First day of each month |
| `"last Friday of the month"` | Last Friday of each calendar month |
| `"15th of the month"` | 15th of each month |
| `"Tue,Thu"` | Tuesday and Thursday |
| `"Sunday morning"` | Sundays (time-of-day stored but ignored for scheduling in V1) |

---

## 4. Interpretation

`preferredDays` is a **scheduling hint**, not a strict constraint. It informs the projection and scheduling engine — it does not prevent a habit from being logged on other days.

### Interpretation layers

**Layer 1: Fast pattern matching (regex)**
Common patterns resolved without LLM:
- Day abbreviations: M, Tu, W, Th, F, Sa, Su (and full names)
- Comma-separated lists: "M,W,F", "Mon,Thu"
- Named groups: "weekdays", "weekends"
- Ordinal dates: "1st of the month", "15th"

**Layer 2: LLM fallback**
Complex patterns that regex cannot reliably handle:
- "Last Friday of the month"
- "Second Tuesday"
- "Every other Monday"
- Ambiguous or conversational expressions

This dual-enforcement pattern is consistent with how `recurrence` is already handled in the system.

### Conflict resolution: preferredDays vs. recurrence

When `preferredDays` specifies more candidate days than `recurrence` allows, the system uses `preferredDays` as a **candidate pool** and `recurrence` as the **frequency constraint**.

**Example:**
- `recurrence: "2x week"`, `preferredDays: "M,W,F"`
- Interpretation: schedule 2 sessions per week, drawn from Monday, Wednesday, or Friday
- The scheduler picks 2 of the 3 candidate days, preferring even distribution

**Example:**
- `recurrence: "monthly"`, `preferredDays: "1st of the month"`
- Interpretation: schedule 1 session per month, on the 1st
- Fully resolved — no conflict

**Example:**
- `recurrence: "daily"`, `preferredDays: "M,W,F"`
- Interpretation: ambiguous. Options:
  - Treat as "daily on weekdays only" (most natural reading)
  - Flag as a potential conflict to the user
- Recommended resolution: interpret `preferredDays` as an override to `recurrence` when more specific. "M,W,F" with "daily" = 3x/week on those days.

---

## 5. Scheduling and Projection Behavior

`preferredDays` is an input to scheduling and projection, whether driven by an LLM or a dedicated engine. The LLM already does a capable job of resolving scheduling questions when given the habit data — a separate scheduling engine may not be needed.

When building a projection or weekly schedule:

1. **Fetch active habits and recurring tasks** for the period
2. **For each habit/task**, resolve `preferredDays` using the interpretation layers above
3. **Place the habit/task** on the appropriate day(s) within the projection window, respecting the `recurrence` frequency constraint
4. **Fall back to historical inference** if `preferredDays` is null — the LLM can analyze recent activity patterns from `list_activity` to identify day-of-week tendencies and surface them transparently: "Placing cardio on Mon/Wed/Fri based on your typical pattern"

### Recurring task nextDueAt computation

When a recurring task is completed and `nextDueAt` is recomputed, `preferredDays` influences placement:

- `recurrence` determines the minimum interval (e.g., "weekly" = at least 7 days)
- `preferredDays` determines which day within the next cycle the task lands on

**Example:** Task recurs "weekly" with `preferredDays: "Thursday"`. Completed on Tuesday.
- The recurrence constraint (weekly) has been met for this week
- `nextDueAt` = Thursday of the **next** week (not Tuesday + 7 days)
- Recurrence takes precedence: the next instance respects the cycle boundary, then lands on the preferred day within that cycle

**Example:** Task recurs "biweekly" with `preferredDays: "Mon"`. Completed on Friday.
- Next cycle starts 2 weeks later
- `nextDueAt` = Monday of the target week (the preferred day within the next biweekly cycle)

## 6. Inference Fallback (when preferredDays is null)

When `preferredDays` is not set, the LLM can infer preferred days from the activity log by examining `completedAt` timestamps from `list_activity`. This keeps inference in the LLM's control rather than embedding it in a scheduling engine.

The LLM should:
- Look at the last 30–60 days of actions for the habit
- Identify day-of-week patterns (e.g., "you typically log this on Mon/Wed/Fri")
- Surface the inference transparently and offer to set `preferredDays` based on the pattern
- Flag low-confidence inferences (few data points, inconsistent patterns)

---

## 7. User Experience

### Setting preferredDays
Conversational, not a form:
- "I like to do cardio on Mondays, Wednesdays, and Fridays"
- "Set my gym habit to Tuesdays and Thursdays"
- "I do badge fabrication on Monday and Thursday each week"

The LLM extracts the natural language expression and stores it as-is in `preferredDays`. The field is human-readable — the stored value should match what the user said, not be normalized to a code.

### Viewing preferredDays
When listing habits, surface `preferredDays` alongside recurrence:
- "Cardio workout — 3x week — M,W,F — 30 min"
- "Badge fabrication — 2x week — Mon,Thu — 90 min"

### Updating preferredDays
Same conversational pattern:
- "Actually I want to move gym to Monday and Wednesday"
- "Remove preferred days from my shopping habit"

---

## 8. Relationship to Projection Engine

`preferredDays` is a key input to the planned `get_projection` tool. The full projection model becomes:

```
Habit projection per week:
  recurrence       → how many sessions
  preferredDays    → which days
  durationMinutes  → how long each session
  = scheduled blocks on specific days with estimated duration
```

This enables the scheduling engine to produce a concrete weekly plan (as demonstrated in the May 4–9 schedule) rather than unanchored time estimates.

---

## 9. Data Model Impact

**Schema additions:**
```sql
ALTER TABLE habits ADD COLUMN preferred_days text;
ALTER TABLE tasks ADD COLUMN preferred_days text;
```

No migration needed for existing records — field is nullable on both tables. Existing habits and recurring tasks without `preferredDays` continue to work normally; scheduling falls back to historical inference.

**MCP tool updates:**

*Habits:*
- `create_habit` — add optional `preferredDays` parameter
- `update_habit` — add optional `preferredDays` parameter
- `list_habits` — include `preferredDays` in response
- `get_habit` — include `preferredDays` in response

*Tasks (recurring only):*
- `create_task` — add optional `preferredDays` parameter (ignored if no recurrence set)
- `update_task` — add optional `preferredDays` parameter
- `list_tasks` — include `preferredDays` in response for recurring tasks
- `get_task` — include `preferredDays` in response

---

## 10. Open Questions

- **Normalization:** Resolved — store as entered (human-readable), parse at query time. No normalization on write.
- **Validation:** Should the system validate `preferredDays` on write and reject unparseable values? Or store anything and surface a warning if parsing fails? Recommendation: store anything, warn on parse failure at scheduling time.
- **UI exposure:** Should `preferredDays` be surfaced in the dashboard habit cadence view? Yes — adds meaningful context to the cadence heatmap.
- **Habit_ends junction:** Does `preferredDays` apply per habit or per habit-end pair? Almost certainly per habit — a behavior has one preferred cadence regardless of how many ends it serves.
- **Task recurrence guard:** Should the MCP server silently ignore `preferredDays` on non-recurring tasks, or return a warning? Recommendation: silently ignore — the field is advisory and the cost of a silent no-op is low.
- **Interaction with scheduledDate:** Resolved — `scheduledDate` takes precedence when projecting a schedule. `preferredDays` is referenced when a recurring task is marked complete and the next `scheduledDate` is being computed — it determines where in the calendar the next instance lands. This creates a clean separation: `scheduledDate` owns the current instance; `preferredDays` governs the recurrence engine that produces future instances.

---

## 11. Design Review Notes

### Time-of-day fragments
Time-of-day expressions (e.g., "Sunday morning", "Thursday evening") are stored as entered but ignored for scheduling in V1. If time-block scheduling (morning/afternoon/evening) is added later, the data is already captured.

### SKILL.md guidance
Once implemented, SKILL.md should instruct the LLM: "When a user describes when they do a habit (e.g., 'I go to the gym on Tuesdays and Thursdays'), extract and set `preferredDays` alongside the habit creation/update. Don't wait for the user to explicitly say 'set preferred days.'"

### Dashboard integration
The Upcoming view and Home view's Today's Focus could use `preferredDays` to show "expected today" habits — habits whose `preferredDays` includes today's day of week. This makes the dashboard more actionable without needing a full projection engine.

### Scheduling engine
No dedicated scheduling engine is planned. The LLM handles scheduling and projection using the habit/task data (recurrence, preferredDays, durationMinutes) and activity history. This avoids building a rules engine that duplicates what the LLM already does well.

---

*This spec should be read alongside the tldr End State & Implicit Cascade Spec and the tldr Dashboard Spec. It is a direct input to the projection engine design.*
