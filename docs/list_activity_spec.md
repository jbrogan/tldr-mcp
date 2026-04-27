# Spec: `list_activity` Tool

## Overview

`list_activity` is a unified query tool that returns a merged, chronologically sorted set of habit actions and task time entries for a given time period. It eliminates the need for clients to make two separate calls (`list_actions` + `list_task_time`) and manually merge the results.

---

## Motivation

Currently, answering "what did I do today?" requires:
1. `list_actions` — returns habit occurrences
2. `list_task_time` — returns task work sessions

The client (Claude) must then merge, sort, and present these as a unified activity log. This is repetitive, error-prone, and adds latency. A single `list_activity` tool solves all three issues.

---

## Tool Definition

### Name
`list_activity`

### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `period` | enum: `today`, `yesterday`, `this_week` | No | Convenience period. Mutually exclusive with `fromDate`/`toDate`. |
| `fromDate` | string (YYYY-MM-DD) | No | Start date. Ignored if `period` is set. |
| `toDate` | string (YYYY-MM-DD) | No | End date. Ignored if `period` is set. |
| `endId` | string (UUID) | No | Filter by end ID. |
| `areaId` | string (UUID) | No | Filter by area ID. |
| `groupBy` | enum: `area`, `end`, `portfolio` | No | If provided, returns grouped response shape instead of flat array. |
| `order` | enum: `asc`, `desc` | No | Sort direction by `completedAt`. Default: `desc` (newest first). |

### Response Shape

#### Flat (no `groupBy`)


```json
{
  "activities": [
    {
      "id": "uuid",
      "type": "action",
      "name": "Gym workout",
      "completedAt": "2026-04-23T12:00:00-04:00",
      "actualDurationMinutes": 60,
      "notes": null,
      "end": { "id": "uuid", "name": "Healthy Lifestyle" },
      "area": { "id": "uuid", "name": "Health" },
      "withPersons": [],
      "forPersons": []
    },
    {
      "id": "uuid",
      "type": "task_time",
      "name": "Assemble LED Logo Panel frame sample",
      "completedAt": "2026-04-23T14:00:00-04:00",
      "actualDurationMinutes": 240,
      "notes": "Completed assembly, tested fit.",
      "end": { "id": "uuid", "name": "LED Logo Panel" },
      "area": { "id": "uuid", "name": "Career" },
      "withPersons": [],
      "forPersons": []
    }
  ],
  "count": 2,
  "totalDurationMinutes": 300
}
```

#### Grouped (with `groupBy`)

```json
{
  "groupBy": "area",
  "groups": [
    {
      "group": { "id": "uuid", "name": "Career" },
      "activities": [ /* same activity shape as flat */ ],
      "count": 3,
      "totalDurationMinutes": 360
    },
    {
      "group": { "id": "uuid", "name": "Health" },
      "activities": [ /* ... */ ],
      "count": 2,
      "totalDurationMinutes": 90
    }
  ],
  "count": 5,
  "totalDurationMinutes": 450
}
```

When `groupBy=end`, the `group` object is an end (`id`, `name`) instead of an area. Activities without a resolvable area or end are placed in a `null` group.

---

### Response Fields

| Field | Description |
|---|---|
| `activities` | Merged, chronologically sorted array of actions and task time entries |
| `type` | `action` (habit) or `task_time` (task work session) |
| `name` | Habit name (for actions) or task name (for task time entries) |
| `completedAt` | When the activity occurred |
| `actualDurationMinutes` | Duration logged; may be null if not recorded |
| `notes` | Optional notes |
| `end` | The end this activity serves |
| `area` | The area, resolved via end if not set directly |
| `withPersons` | People present for the activity |
| `forPersons` | People the activity was done for |
| `groupBy` | Present in grouped responses; reflects the requested grouping (`area` or `end`) |
| `groups` | Array of group objects, each with a `group` identifier, `activities`, `count`, and `totalDurationMinutes` |
| `totalDurationMinutes` | Sum of all `actualDurationMinutes` values (nulls excluded) |

---

## Sorting

Results are sorted by `completedAt` descending (newest first) by default, matching the primary use case of "what did I do today?". Use the `order` parameter to override.

| `order` value | Behavior |
|---|---|
| `desc` (default) | Newest first |
| `asc` | Oldest first |

Sorting applies within each group when `groupBy` is used.

---

## Implementation Notes

### Action → End Resolution
Habits now have a single `end_id` (no junction table), so the resolution chain for actions mirrors task time entries exactly:

```
action → habit.end_id → end → area
task_time → task.end_id → end → area
```

Filtering by `endId` or `areaId` requires first resolving which habits have a matching `end_id` (or resolve to that area via end), then filtering actions by those habit IDs. The symmetric join paths significantly simplify query planning and result assembly compared to the previous `habit_ends` junction table approach.

### Bulk Preloading
All related entities (habits, tasks, ends, areas, persons) must be preloaded in bulk before result assembly — not fetched row by row. The same bulk preloading pattern used in `list_actions` should be applied here across both result sets.

---

Add the following to the Tool Discovery Tips table:

| Intent | Tool to use |
|---|---|
| See a unified activity log (habits + task time) | `list_activity` |
| See habit actions only | `list_actions` |
| See task time entries only | `list_task_time` |

Update the "What did I do today/yesterday?" guidance to prefer `list_activity` over the two-call pattern.

---

## Notes & Considerations

- `list_actions` and `list_task_time` remain available for cases where filtering by specific habit or task is needed
- `totalDurationMinutes` enables day/week summaries without client-side aggregation — present at both the top level and within each group
- `groupBy=area` is the primary use case for daily/weekly recap views
- `groupBy=end` is useful for per-project or per-aspiration reporting
- `groupBy=portfolio` is useful for business vs. personal splits (e.g., DLI vs. TLDR vs. personal); the `null` group is especially meaningful here as it captures all non-portfolio (personal) activity
- Activities without a resolvable group (e.g., no area set) are placed in a `null` group to avoid silent data loss
