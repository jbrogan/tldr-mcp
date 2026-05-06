# tldr: Cadence Signals Spec

**Version:** 0.1
**Date:** May 6, 2026
**Status:** Draft

---

## 1. Overview

This spec defines a set of server-computed cadence signals added to habits, tasks, and ends. The signals enable LLM-driven reflection ("how am I doing this week?", "what's behind?", weekly summary) without requiring the LLM to perform aggregate arithmetic over raw timestamps.

**Design principle:** the server is the data layer; the LLM is the presenter. Reflection logic — prioritization, framing, tone — belongs to the LLM. Aggregate computation — "days since last action," "expected interval," "is overdue" — belongs to the server. This spec adds the second category so the LLM has reliable structured signals to reason over.

This work also lays the foundation for a future observer / accountability feature (see `tldr-observer-spec.md`), which depends on cadence-gap detection. Observer push notifications are out of scope here.

---

## 2. Problem Statement

### Current state

To answer "how am I doing on the gym habit?" today, the LLM must:

1. `list_actions` for that habit
2. Find the most recent `completedAt`
3. Compute `now() - lastCompletedAt` in days
4. Interpret the `recurrence` string ("3x week") to estimate an expected interval
5. Compare and decide whether there's a gap

Steps 3 and 4 are arithmetic and string interpretation — both prone to LLM errors and inconsistent across calls. Step 5 is the actual reasoning, which the LLM does well.

### Observed failure modes

- LLM computes "days since last action" inconsistently across long contexts.
- LLM interprets `recurrence` differently on different turns ("3x week" sometimes treated as ~2.3 days, sometimes as 7).
- Browsing many habits at once requires the LLM to repeat the computation per habit; cost compounds.

### Impact

Unreliable cadence reasoning affects:
- Weekly reflection accuracy
- Gap detection ("you haven't logged X in N days")
- Projection priority (which habits/tasks to surface first)
- Future observer accountability prompts

---

## 3. Proposed Cadence Signals

### 3.1 On habits

| Field | Type | Source |
|---|---|---|
| `lastActionAt` | TIMESTAMPTZ \| null | **Stored** column on `habits`, maintained by trigger on `actions` |
| `daysSinceLastAction` | integer \| null | Computed at read time from `lastActionAt` and `now()` (in user TZ) |
| `expectedIntervalDays` | integer \| null | **Stored** column on `habits`, computed from `recurrence` on write |
| `actionCountLast30Days` | integer | Computed at read time |

`null` for `lastActionAt` and `daysSinceLastAction` indicates the habit has never been logged.
`null` for `expectedIntervalDays` indicates the `recurrence` string could not be parsed (or none was provided).

### 3.2 On tasks

| Field | Type | Source |
|---|---|---|
| `daysOverdue` | integer \| null | Computed at read time from `nextDueAt` (recurring) or `dueDate` (one-off). Negative or null when not overdue |

`nextDueAt` already exists for recurring tasks — this spec only adds the derived `daysOverdue`.

### 3.3 On ends (deferred)

`lastActivityAt` per end (max of actions on linked habits + task_time on linked tasks) is valuable for reflection but multi-source and complex to denormalize. **Defer to a follow-up.** Ship read-time aggregation in `list_ends` only if it proves cheap enough; otherwise revisit denormalization later.

---

## 4. Schema Changes

### 4.1 New columns on `habits`

```sql
ALTER TABLE habits ADD COLUMN last_action_at TIMESTAMPTZ;
ALTER TABLE habits ADD COLUMN expected_interval_days INTEGER;

CREATE INDEX idx_habits_last_action_at ON habits(last_action_at);
```

### 4.2 Trigger to maintain `last_action_at`

```sql
CREATE OR REPLACE FUNCTION sync_habit_last_action_at() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.habit_id IS NOT NULL THEN
    UPDATE habits
    SET last_action_at = (
      SELECT MAX(completed_at) FROM actions WHERE habit_id = NEW.habit_id
    )
    WHERE id = NEW.habit_id;
  END IF;

  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE' AND OLD.habit_id IS DISTINCT FROM NEW.habit_id) THEN
    UPDATE habits
    SET last_action_at = (
      SELECT MAX(completed_at) FROM actions WHERE habit_id = OLD.habit_id
    )
    WHERE id = OLD.habit_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actions_sync_last_action
AFTER INSERT OR UPDATE OF completed_at, habit_id OR DELETE ON actions
FOR EACH ROW EXECUTE FUNCTION sync_habit_last_action_at();
```

**Why recompute MAX on every change** rather than `GREATEST(last_action_at, NEW.completed_at)` on insert + selective recompute on update/delete: the trigger runs only on action edits (low write volume), and a single-row recompute is correct under all action edits with no edge cases. The two `IF` branches handle the rare case where an action's `habit_id` is changed — both old and new habits are resynced. Simplicity wins.

### 4.3 No schema change for `expectedIntervalDays` derivation

`expected_interval_days` is computed in application code by `create_habit` / `update_habit` and written directly. No trigger needed; recurrence changes pass through the application layer.

---

## 5. Recurrence Parser

A new function — `getExpectedIntervalDays(recurrence: string): Promise<number | null>` — added as a sibling export in the **existing** `src/utils/recurrence.ts` module. The module already provides `computeNextDueAt` for recurring task `nextDueAt` computation; we use the same two-tier pattern: regex fast path first, Haiku fallback for unrecognized strings.

Habit writes are infrequent. A populated `expectedIntervalDays` enables better cadence reasoning at every read, so the LLM round-trip on uncommon phrasings is worth the cost. `null` is returned only when both tiers fail (no API key, LLM error, unparseable LLM response).

**Semantic note: `monthly` differs between functions.**
- `computeNextDueAt("monthly", date)` advances the calendar month — 28 to 31 days depending on the reference date.
- `getExpectedIntervalDays("monthly")` returns `30` — a fixed cadence threshold for "is this habit behind?"

These are deliberately different. Cadence reasoning needs a stable threshold; occurrence math needs calendar correctness.

### 5.1 Recognized patterns

| Recurrence string | `expectedIntervalDays` |
|---|---|
| `daily`, `every day` | 1 |
| `weekly`, `every week`, `1x week` | 7 |
| `2x week`, `twice a week` | 4 (rounded from 7/2) |
| `3x week` | 2 (rounded from 7/3) |
| `5x week` | 1 |
| `monthly`, `every month` | 30 |
| `2x month` | 15 |
| `quarterly` | 90 |
| `every N days` (e.g. "every 3 days") | N |
| `every N weeks` | N × 7 |
| (unparseable) | `null` |

### 5.2 Behavior

- Regex tier is deterministic and case-insensitive.
- LLM tier (Haiku) handles patterns the regex doesn't — "every other tuesday", "second friday of the month", "twice a quarter", etc. Prompt instructs the model to use stable thresholds (monthly=30, quarterly=90, yearly=365).
- Returns `null` rather than throwing on unrecognized input — `expected_interval_days` is best-effort metadata, not validation.

### 5.3 Where it's invoked

- `create_habit`: parse `recurrence` → set `expected_interval_days` on insert.
- `update_habit`: when `recurrence` is changed, re-parse and update.
- (Same parser may eventually serve recurring tasks for `nextDueAt` computation, but that path is already handled by the existing recurring-task logic — out of scope for this spec.)

---

## 6. Migration Plan

Single migration: `supabase/migrations/<timestamp>_habit_cadence_signals.sql`

```sql
-- 1. Add columns
ALTER TABLE habits ADD COLUMN last_action_at TIMESTAMPTZ;
ALTER TABLE habits ADD COLUMN expected_interval_days INTEGER;
CREATE INDEX idx_habits_last_action_at ON habits(last_action_at);

-- 2. Add trigger function and trigger (see §4.2)

-- 3. Backfill last_action_at for existing habits
UPDATE habits h SET last_action_at = (
  SELECT MAX(completed_at) FROM actions WHERE habit_id = h.id
);

-- 4. Backfill expected_interval_days
-- NOTE: The recurrence parser lives in application code. Run a one-shot
-- backfill script (npm run cli backfill-cadence) after deployment to
-- populate this column for existing habits with non-null recurrence.
```

The recurrence backfill is an application-layer one-shot rather than SQL because the parser is in TypeScript and easier to maintain in one place.

---

## 7. Tool Response Changes

### `list_habits` / `get_habit`

Each habit object adds:
- `lastActionAt`
- `daysSinceLastAction`
- `expectedIntervalDays`
- `actionCountLast30Days`

### `list_tasks` / `get_task`

Each task object adds:
- `daysOverdue`

### `list_ends` / `get_end`

Inline habit objects in the response inherit the new habit fields. End-level `lastActivityAt` is **not** added in this spec (see §3.3).

---

## 8. SKILL.md Guidance

A new section in `SKILL.md` instructs the LLM on how to use these signals:

- Prefer `daysSinceLastAction` and `expectedIntervalDays` over computing dates from raw `completedAt` timestamps.
- A habit is "behind" when `daysSinceLastAction > expectedIntervalDays × 1.5` (heuristic — the LLM may adjust based on habit type and user context).
- For weekly reflection, surface habits with the largest `daysSinceLastAction / expectedIntervalDays` ratio first.
- `actionCountLast30Days` provides a frequency view that's robust to small gaps (a single missed week may not reflect overall trajectory).

The exact prompt language is left to the SKILL.md update accompanying this work.

---

## 9. Performance Considerations

### Read path

`lastActionAt` is now O(1) per habit (column read, no join). `actionCountLast30Days` requires an aggregate query but is bounded by 30 days × the user's habit count — small. Expect `list_habits` latency to decrease vs. read-time MAX computation.

### Write path

Each `create_action` / `update_action` / `delete_action` triggers a single `UPDATE habits` with a scalar subquery. Action write volume is low (handful per day per user). Acceptable.

### Index

`idx_habits_last_action_at` supports queries that surface "stale" habits (e.g., `WHERE last_action_at < now() - interval '14 days'`) which is the canonical gap-detection query.

---

## 10. Out of Scope

- **`ends.last_activity_at`** — multi-source denormalization deferred (§3.3).
- **Observer push notifications** — covered by `tldr-observer-spec.md`; depends on this spec but is not enabled by it. Push requires server-side scheduled detection (e.g., Cloudflare Cron Triggers).
- **Reflection prompt templates** — left to SKILL.md and the chat agent. The data layer is what this spec delivers.
- **`list_gaps` convenience tool** — possible follow-up if the LLM workflow benefits from a pre-filtered "what's behind" view. Not required at V1; the new fields on existing list tools are sufficient.

---

## 11. Open Questions

- **Heuristic threshold (×1.5):** what multiplier defines "behind"? Spec proposes 1.5 as a starting point; calibrate based on real reflection sessions.
- **`expectedIntervalDays` for `preferredDays`-only habits:** if a habit has `preferredDays` (e.g., "Tuesday") but no explicit recurrence, what interval should it imply? Proposal: treat single-day-of-week as `weekly` (7 days). Multi-day patterns may need their own derivation.
- **`actionCountLast30Days` window:** is 30 fixed, or should the field be parameterized? Fixed at V1; revisit if reflection wants different windows.

---

*This spec should be read alongside `tldr-temporal-metadata-spec.md` (sibling LLM-data-quality work) and `tldr-observer-spec.md` (downstream feature that depends on this).*
