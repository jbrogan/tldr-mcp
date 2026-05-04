# tldr: Temporal Metadata Spec

**Version:** 0.1
**Date:** May 3, 2026
**Status:** Draft

---

## 1. Overview

This spec defines a set of server-computed temporal metadata fields added to activity payloads (actions, task time entries, tasks) to enable reliable day-of-week and day-of-month reasoning by the LLM without requiring it to perform date arithmetic.

The motivation is simple: LLMs are prone to off-by-one errors and miscalculations when computing temporal properties from raw date strings — particularly day-of-week across month boundaries and relative week-of-month positions. These are trivial computations for the server, which has access to the user's IANA timezone and deterministic date libraries.

By pre-computing these fields server-side and including them in API responses, the LLM can perform reliable pattern detection, preferred day inference, and schedule reasoning purely through reading labeled fields rather than computing dates.

---

## 2. Problem Statement

### Current state
Payloads return `completedAt` as a UTC-offset timestamp:
```json
{
  "completedAt": "2026-04-27T12:00:00-04:00"
}
```

The LLM must derive day-of-week, day-of-month, and week-of-month from this string. This is error-prone, particularly when:
- Dates span month boundaries
- The LLM must determine "last Friday of the month" vs. "4th Friday"
- Large sets of records require sequential date calculations

### Observed failure mode
In a real session, the LLM incorrectly computed day-of-week for multiple April dates, leading to a wrong `preferredDays` recommendation for the Gym workout habit. The error was caught by the user and corrected, but illustrates the reliability risk.

### Impact
Unreliable temporal reasoning affects:
- `preferredDays` inference from historical activity
- Weekly schedule projection
- Habit cadence gap detection
- Monthly pattern analysis in reflection

---

## 3. Proposed Temporal Metadata Fields

Three server-computed fields added to relevant payloads:

### 3.1 `dayOfWeek`
The day of the week the activity occurred, in the user's local timezone.

```json
"dayOfWeek": "Monday"
```

- **Values:** "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"
- **Computed from:** `completedAt` converted to user's IANA timezone
- **Enables:** Day-of-week pattern inference (e.g. "Mon, Wed, Fri"), weekly schedule placement

### 3.2 `dayOfMonth`
The calendar day of the month the activity occurred, in the user's local timezone.

```json
"dayOfMonth": 27
```

- **Values:** Integer 1–31
- **Computed from:** `completedAt` converted to user's IANA timezone
- **Enables:** Monthly date pattern inference (e.g. "15th of the month", "1st of the month")

### 3.3 `weekOfMonth`
The relative week position of the activity within its calendar month, in the user's local timezone.

```json
"weekOfMonth": "last"
```

- **Values:** "1st" | "2nd" | "3rd" | "4th" | "last"
- **Computed from:** `completedAt` converted to user's IANA timezone
- **Computation logic:**
  - Determine the day-of-week of the date
  - Count how many times that day-of-week has occurred in the month up to and including this date → ordinal position
  - If the next occurrence of that day-of-week falls outside the month → value is "last"; otherwise value is the ordinal ("1st", "2nd", "3rd", "4th")
- **Enables:** Relative day pattern inference (e.g. "last Friday of the month", "2nd Tuesday")

### Combined example
```json
{
  "completedAt": "2026-04-24T12:00:00-04:00",
  "dayOfWeek": "Friday",
  "dayOfMonth": 24,
  "weekOfMonth": "last"
}
```

*April 24, 2026 is the last Friday of April — all three fields together allow the LLM to identify this pattern.*

---

## 4. Entities Receiving Temporal Metadata

### 4.1 Actions (habit completions)
Primary use case — inferring preferred days from historical habit activity.

```json
{
  "id": "...",
  "habitId": "...",
  "completedAt": "2026-04-24T12:00:00-04:00",
  "dayOfWeek": "Friday",
  "dayOfMonth": 24,
  "weekOfMonth": "last",
  "actualDurationMinutes": 60,
  "notes": null
}
```

### 4.2 Task Time Entries
Secondary use case — inferring when recurring task work tends to happen.

```json
{
  "id": "...",
  "taskId": "...",
  "completedAt": "2026-04-30T12:00:00-04:00",
  "dayOfWeek": "Thursday",
  "dayOfMonth": 30,
  "weekOfMonth": "last",
  "actualDurationMinutes": 10
}
```

### 4.3 Tasks (date fields) — deferred

Task date temporal metadata (`dueDayOfWeek`, `scheduledDayOfWeek`, `nextDueDayOfWeek`, etc.) is deferred to a future iteration. The primary use case — inferring `preferredDays` from historical activity — is fully served by temporal metadata on actions and task time entries. Task date metadata can be added if the LLM struggles with task scheduling arithmetic.

---

## 5. Inference Algorithm

With temporal metadata available, the LLM can reliably infer `preferredDays` from historical actions using the following approach:

### Step 1: Fetch recent actions
Request last 30–60 days of actions for the habit, ensuring temporal metadata is included.

### Step 2: Count by temporal dimension
```
For weekly patterns:
  Count occurrences by dayOfWeek
  Rank days by frequency
  Identify top N days (where N = implied weekly frequency from recurrence)

For monthly date patterns:
  Count occurrences by dayOfMonth
  If a single dayOfMonth has high frequency → "Nth of the month"

For monthly relative patterns:
  Count occurrences by (dayOfWeek + weekOfMonth) pair
  If a single pair has high frequency → "last Friday of the month", "2nd Tuesday", etc.
```

### Step 3: Confidence assessment
```
High confidence:   ≥ 4 occurrences on the same day/position over 60 days
Medium confidence: 2–3 occurrences
Low confidence:    0–1 occurrences → do not infer, ask user
```

### Step 4: Surface transparently
When making a `preferredDays` recommendation, the LLM states the basis:
- "Based on 4 of your last 12 gym sessions falling on Fridays, I'd suggest 'Mon, Wed, Fri'."
- "Your last 3 Quicken reconciliations were on the last Friday of the month."

---

## 6. Timezone Contract

All three temporal metadata fields are computed in the user's IANA timezone, retrieved from `profiles.timezone`. This ensures:

- A user in `America/New_York` who logs an activity at 11pm ET sees it attributed to that local day, not the UTC next day
- Consistent with the existing `completedAt` serialization contract (UTC stored, user timezone offset applied on read)
- The temporal metadata fields are always in sync with the user's local date experience

---

## 7. Server Implementation Notes

### Computation
All three fields are derived at response serialization time — not stored in the database. They are computed on-the-fly from `completedAt` and the user's timezone. No schema changes required for actions or task_time tables.

For task date fields (`dueDate`, `scheduledDate`, `nextDueAt`), computation is straightforward date parsing in the user's timezone.

### weekOfMonth computation
```javascript
function weekOfMonth(date, timezone) {
  const local = toZonedTime(date, timezone);
  const dayOfWeek = local.getDay(); // 0=Sun, 6=Sat
  const dayOfMonth = local.getDate();
  
  // Count occurrences of this day-of-week up to and including this date
  let count = 0;
  for (let d = 1; d <= dayOfMonth; d++) {
    const candidate = new Date(local.getFullYear(), local.getMonth(), d);
    if (candidate.getDay() === dayOfWeek) count++;
  }
  
  // Check if there's another occurrence later in the month
  const daysInMonth = new Date(local.getFullYear(), local.getMonth() + 1, 0).getDate();
  const nextOccurrence = dayOfMonth + 7;
  const isLast = nextOccurrence > daysInMonth;
  
  if (isLast) return "last";
  const ordinals = ["1st", "2nd", "3rd", "4th"];
  return ordinals[count - 1];
}
```

### Performance
These are lightweight computations — no database queries, no external calls. The cost is negligible per record. For list endpoints returning many records, the overhead is linear but small.

---

## 8. MCP Tool Updates

The following tools return updated payloads with temporal metadata:

| Tool | Fields Added | Status |
|---|---|---|
| `list_activity` | `dayOfWeek`, `dayOfMonth`, `weekOfMonth` on each activity record | **Shipped** |
| `list_actions` | `dayOfWeek`, `dayOfMonth`, `weekOfMonth` on each action | Deferred |
| `get_action` | `dayOfWeek`, `dayOfMonth`, `weekOfMonth` | Deferred |
| `list_task_time` | `dayOfWeek`, `dayOfMonth`, `weekOfMonth` on each entry | Deferred |
| `list_tasks` | Task date temporal metadata | Deferred |
| `get_task` | Task date temporal metadata | Deferred |

V1 ships temporal metadata on `list_activity` only — the primary tool for pattern inference and reflection. Other tools can be updated incrementally as needed.

---

## 9. Relationship to Other Specs

**Preferred Days Spec** — temporal metadata is the inference foundation for `preferredDays`. The two specs are complementary: this spec provides the data quality layer; the Preferred Days spec defines how that data is used.

**Projection Engine** — temporal metadata on tasks (due dates, scheduled dates, next due) gives the LLM reliable day-of-week context when building forward schedules without arithmetic.

**Reflection Engine** — temporal metadata on actions enables day-of-week pattern analysis in monthly and weekly reflections (e.g. "your most productive days were Mondays and Thursdays").

---

## 10. Open Questions

- **Storage vs. computation:** Should temporal metadata be stored as computed columns in the database for query efficiency, or always computed at serialization time? Recommendation: compute at serialization time initially; add computed columns if performance becomes an issue at scale.
- **`list_activity` unified log:** The `list_activity` tool merges actions and task_time entries. Should it include temporal metadata on each record? Yes — this is the primary tool used for reflection analysis and should be the most semantically rich.
- **Historical backfill:** Existing data doesn't need backfilling since fields are computed on-the-fly. No migration required.

---

*This spec should be read alongside the Preferred Days Spec and the tldr Technical Disclosure (Section 5: AI-Mediated Semantic Reflection and Projection Engine). It is a foundational input to reliable LLM-based scheduling and pattern inference.*
