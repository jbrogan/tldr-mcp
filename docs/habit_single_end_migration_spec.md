# Spec: Migrate Habits to Single End (Remove `habit_ends` Junction Table)

## Overview

Replace the `habit_ends` many-to-many junction table with a single `end_id` foreign key on the `habits` table. This aligns habits with tasks, simplifies queries throughout the system, and unblocks the `list_activity` implementation.

---

## Motivation

- **Model consistency** — tasks already use a single `end_id`; habits should match
- **Simpler queries** — eliminates a join in every query that resolves habit → end → area
- **list_activity unblocked** — action → end resolution becomes symmetric with task_time → end resolution
- **Multi-end semantics no longer needed** — the supporting-ends hierarchy now expresses "this habit serves a higher purpose" at the end level, which is architecturally cleaner
- **Data confirms low risk** — all existing habits have a single end; no data loss expected

---

## Schema Changes

### Remove
```sql
DROP TABLE habit_ends;
```

### Add
```sql
ALTER TABLE habits ADD COLUMN end_id UUID REFERENCES ends(id);
```

### Index
```sql
CREATE INDEX idx_habits_end_id ON habits(end_id);
```

---

## Migration Steps

1. **Backfill** `end_id` on habits from `habit_ends`
   ```sql
   UPDATE habits h
   SET end_id = (
     SELECT end_id FROM habit_ends
     WHERE habit_id = h.id
     LIMIT 1
   );
   ```
2. **Verify** all habits have a non-null `end_id` (count check)
3. **Drop** `habit_ends` junction table
4. **Update** ORM/query layer to use `habit.end_id` instead of joining `habit_ends`

---

## Rollback Plan

Before running the migration:
- Back up `habit_ends` table contents
- Keep `habit_ends` in place until migration is verified in production

To roll back:
1. Restore `habit_ends` from backup
2. Revert ORM/query layer changes
3. Drop `end_id` column from habits

---

## Tool Interface Changes

### `create_habit`
- **Before:** `endIds: string[]` (array, min 1)
- **After:** `endId: string` (single UUID, required)

### `update_habit`
- **Before:** `endIdToAdd`, `endIdToRemove`, `endIdsToReplace`
- **After:** `endId` — replaces the end association directly

### `list_habits`
- No parameter changes; filter by `endId` continues to work, simpler internally

### `get_habit`
- Response changes from `ends: []` array to `end: {}` single object

---

## Impact on Downstream Tools

| Tool | Impact |
|---|---|
| `list_actions` | Simpler internal join; no interface change |
| `list_activity` | Action → end resolution now mirrors task_time path; no junction join needed |
| `list_ends_and_habits` | Simpler query; no interface change |
| `create_habit` | Interface change: `endId` replaces `endIds` |
| `update_habit` | Interface change: `endId` replaces `endIdToAdd/Remove/Replace` |
| `get_habit` | Response change: `end` object replaces `ends` array |

---

## SKILL.md Update

Update habit logging and creation examples to use `endId` (singular) instead of `endIds` (array).

---

## Acceptance Criteria

- [ ] All habits have a non-null `end_id` after migration
- [ ] `habit_ends` table no longer exists
- [ ] `create_habit` accepts `endId` (single), rejects array
- [ ] `update_habit` accepts `endId` to change end association
- [ ] `get_habit` returns `end` as a single object, not array
- [ ] `list_actions` and `list_activity` resolve end/area correctly via `habit.end_id`
- [ ] No existing habits lost or orphaned
