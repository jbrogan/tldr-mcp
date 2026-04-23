# Spec: Add `purpose` field to ends

## Problem

Journey and destination ends currently have no field to capture *why the end exists* — the specific motivation or intent behind it. The existing model has adjacent concepts but none that fit precisely:

- **`thesis`** — inquiry ends only; captures a question to be investigated. Semantically inappropriate for journeys and destinations.
- **`rationale`** — lives on the *link* between ends, not on the end itself. Captures why a child supports a parent, not why the end exists independently.
- **`beliefs`** — linked values that motivate ends, but many-to-many and philosophical. Too broad to serve as a purpose statement.

The result is that a journey or destination end has a name but no way to articulate its specific intent. Two ends with similar names could mean very different things with no way to distinguish them.

## Goal

Add an optional `purpose` field to all end types that captures a concise statement of *why this end exists* — specific to the end itself, not its relationship to other ends.

---

## Proposed Change

### New field: `purpose`

| Attribute | Value |
|---|---|
| Field name | `purpose` |
| Type | `string` |
| Required | No (optional) |
| Applies to | All end types: `journey`, `destination`, `inquiry` |
| Max length | No database constraint. Tool description says "keep to a sentence or two." |

### Semantics

`purpose` answers the question: *"Why does this end exist?"*

It is distinct from:
- `thesis` — which asks *"What question is being investigated?"* (inquiry only)
- `rationale` — which asks *"Why does this end support its parent?"* (link-level)
- `beliefs` — which ask *"What value motivates this?"* (philosophical, many-to-many)

For inquiry ends, both `purpose` and `thesis` may coexist:
- `purpose` = why this inquiry matters
- `thesis` = the specific question being investigated

### Examples

| End | Type | Purpose |
|---|---|---|
| Build tldr | journey | *"A personal life OS that turns intentions into consistent action"* |
| Bring tldr to market | journey | *"Make tldr available to others who want to live more intentionally"* |
| Achieve product readiness | destination | *"tldr must work for strangers, not just its creator"* |
| Deploy and monitor | journey | *"Reliability and cost transparency are table stakes for a paid product"* |
| Define the product | inquiry | *"Without clear positioning, every product decision is harder"* |
| Launch | destination | *"The moment tldr becomes publicly available and commercially active"* |

---

## API Changes

### `create_end`
Add optional `purpose` parameter:
```
purpose?: string   # Why this end exists
```

### `update_end`
Add optional `purpose` parameter:
```
purpose?: string   # Update the purpose statement
```

### Response schema
Add `purpose` to all end responses (`get_end`, `list_ends`):
```json
{
  "id": "...",
  "name": "...",
  "endType": "journey",
  "purpose": "A personal life OS that turns intentions into consistent action",
  ...
}
```

`purpose` should be `null` when not set.

---

## Impact on Claude behavior

When `purpose` is present, Claude should:
- Surface it when describing an end to give richer context
- Use it to inform recommendations (tasks, habits) that serve the end
- Reference it when evaluating whether a new task or habit belongs under a given end

When `purpose` is absent, Claude should treat the end the same as today — no degraded behavior, just less context.

---

## Relationship to `thesis`

`thesis` remains inquiry-only and unchanged. The two fields are complementary for inquiry ends:

| Field | Applies to | Question answered |
|---|---|---|
| `purpose` | All end types | Why does this end exist? |
| `thesis` | Inquiry only | What specific question is being investigated? |

No changes to `thesis` are required.
