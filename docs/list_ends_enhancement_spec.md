# Spec: Enhance `list_ends` and Deprecate `list_ends_and_habits`

## Problem

`list_ends` currently returns summary-level data with `supportingEndCount` and `supportsCount` as integer counts, making it impossible to build the full end hierarchy from a single call. Additionally, `list_ends_and_habits` exists as a separate tool that returns habits alongside ends, but has a weaker filter set and no hierarchy data. The two tools overlap in purpose but neither is complete.

## Goals

1. Make `list_ends` the single authoritative tool for retrieving ends with their relationships and habits
2. Enable full hierarchy tree construction in a single tool call
3. Eliminate `list_ends_and_habits` as redundant

---

## Proposed Changes to `list_ends`

### 1. Replace hierarchy counts with full arrays

Replace `supportingEndCount` and `supportsCount` with full arrays, matching the shape already returned by `get_end`:

```json
"supportingEnds": [
  {
    "id": "...",
    "name": "...",
    "endType": "journey",
    "state": "active",
    "rationale": "..."
  }
],
"supports": [
  {
    "id": "...",
    "name": "...",
    "endType": "journey",
    "state": "active",
    "rationale": "..."
  }
]
```

### 2. Add habits array to each end

Add a `habits` array to each end, matching the shape returned by `list_ends_and_habits`:

```json
"habits": [
  {
    "id": "...",
    "name": "...",
    "recurrence": "...",
    "durationMinutes": null
  }
]
```

### 3. No changes to filter arguments

The existing filter set is sufficient and already a superset of `list_ends_and_habits`:

| Argument | Type | Description |
|---|---|---|
| `areaId` | string | Filter by area |
| `portfolioId` | string | Filter by portfolio |
| `endType` | enum | `journey` \| `destination` \| `inquiry` |
| `state` | enum | `active` \| `paused` \| `archived` \| `completed` \| `abandoned` \| `resolved` |

---

## Full Response Schema (per end)

```json
{
  "id": "string",
  "name": "string",
  "endType": "journey | destination | inquiry",
  "state": "active | paused | archived | completed | abandoned | resolved",
  "dueDate": "YYYY-MM-DD | null",
  "area": {
    "id": "string",
    "name": "string"
  },
  "portfolio": {
    "id": "string",
    "name": "string"
  },
  "habits": [
    {
      "id": "string",
      "name": "string",
      "recurrence": "string | null",
      "durationMinutes": "integer | null"
    }
  ],
  "supportingEnds": [
    {
      "id": "string",
      "name": "string",
      "endType": "string",
      "state": "string",
      "rationale": "string | null"
    }
  ],
  "supports": [
    {
      "id": "string",
      "name": "string",
      "endType": "string",
      "state": "string",
      "rationale": "string | null"
    }
  ]
}
```

---

## Deprecation of `list_ends_and_habits`

Once `list_ends` is updated, `list_ends_and_habits` is fully redundant:

| Capability | `list_ends` (enhanced) | `list_ends_and_habits` |
|---|---|---|
| Filter by area | ✅ | ✅ |
| Filter by portfolio | ✅ | ✅ |
| Filter by endType | ✅ | ❌ |
| Filter by state | ✅ | ❌ |
| Returns habits | ✅ | ✅ |
| Returns full hierarchy | ✅ | ❌ |

`list_ends_and_habits` can be removed once this spec is implemented. Claude's tool skill documentation should be updated to reflect `list_ends` as the preferred tool for all ends overview and planning queries.

---

## Impact

| Metric | Before | After |
|---|---|---|
| Calls to build hierarchy tree | N (one `get_end` per end with relationships) | 1 |
| Calls for ends + habits overview | 1 (`list_ends_and_habits`) | 1 (`list_ends`) |
| Tool surface area | `list_ends` + `list_ends_and_habits` | `list_ends` only |
