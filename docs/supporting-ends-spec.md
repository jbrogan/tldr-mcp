# Supporting Ends Spec

## Overview

Add a many-to-many relationship between ends, where one end can be "supported by" one or more other ends. This enables goal decomposition, inquiry-to-destination lineage, and milestone tracking without introducing unbounded hierarchy.

---

## Motivation

Real use cases that don't fit the current flat model:

- **Inquiry → Destination promotion**: "Is a mobile app viable?" resolves yes → spawns "Launch the mobile app" and "Establish distribution." The inquiry should link to the destinations it spawned.
- **Goal decomposition**: "Launch product" breaks into "Build prototype," "Validate pricing," "First 10 customers." Each is a trackable end with its own type, state, habits, and tasks.
- **Journey milestones**: "Be financially independent" is supported by "Pay off mortgage" (destination) and "Build investment portfolio" (journey).

The common pattern: a higher-level end is served by one or more lower-level ends, and a lower-level end may serve multiple higher-level ends (many-to-many).

---

## Data Model

### Junction table: `end_supports`

```sql
CREATE TABLE end_supports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_end_id UUID NOT NULL REFERENCES ends(id) ON DELETE CASCADE,
  child_end_id UUID NOT NULL REFERENCES ends(id) ON DELETE CASCADE,
  rationale TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_end_id, child_end_id),
  CHECK (parent_end_id != child_end_id)
);
```

- **parent_end_id**: the higher-level end being supported.
- **child_end_id**: the supporting end.
- **rationale**: optional free text capturing why the link exists (e.g. "spawned from inquiry resolution", "milestone toward parent").
- Cascade delete: if either end is deleted, the link is removed.
- Many-to-many: an end can support multiple parents, and a parent can have multiple supporting ends.

### Depth constraint: two levels (grandparent → parent → leaf)

An end can occupy one of three roles:

- **Grandparent**: has children, no parents
- **Mid-level (parent)**: has children and has parents
- **Leaf**: has no children, has parents

A maximum chain depth of 2 levels is enforced at the API layer, not the database — keeps the schema simple and the constraint easy to relax later if needed.

**Mental model**: grandparent → parent → leaf. No end can participate in a chain deeper than three tiers.

---

## End Type Interactions

All combinations are valid — the end type and state machine are independent of the support relationship:

| Parent type | Child type | Example |
|---|---|---|
| journey | destination | "Be healthy" → "Run a marathon" |
| journey | journey | "Be a great father" → "Be present at home" |
| inquiry | destination | "Is this viable?" → "Launch product" |
| destination | destination | "Launch product" → "Build prototype" |
| destination | inquiry | "Launch product" → "Is pricing sustainable?" |

No type-based restrictions on which combinations are allowed.

---

## State Propagation

**None.** Parent and child states are independent. The LLM reasons about child progress during reflection:

> "Your end 'Launch product' has 3 supporting ends — 1 completed, 1 active, 1 not started."

This is informational, not enforced. A parent can be completed even if children are still active (the user decides when the parent is done). A child can be abandoned without affecting the parent.

---

## RLS

Same pattern as `end_shares` — policy based on ownership of the parent or child end:

```sql
CREATE POLICY "Users can CRUD own end_supports"
  ON end_supports FOR ALL
  USING (
    EXISTS (SELECT 1 FROM ends e WHERE e.id = end_supports.parent_end_id AND e.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM ends e WHERE e.id = end_supports.child_end_id AND e.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM ends e WHERE e.id = end_supports.parent_end_id AND e.user_id = auth.uid())
  );
```

SELECT allows viewing if you own either end (relevant for shared ends). INSERT/UPDATE requires owning the parent (you decide what supports your goals).

---

## Sharing Interaction

If a parent end is shared, its supporting ends are **visible** to the shared user (read-only, consistent with how habits and tasks on shared ends work). No automatic sharing of child ends — the owner controls sharing per end.

Implementation: the SELECT RLS policy above already handles this if combined with the shared-end visibility pattern. Alternatively, add an explicit policy that allows viewing `end_supports` rows where the parent end is accessible via `can_access_end()`.

---

## Validation Rules

- An end cannot support itself (`parent_end_id != child_end_id`).

### Depth validation

On insert of `(parent_end_id=P, child_end_id=C)`, the resulting chain from any ancestor of P through to any descendant of C must be ≤ 3 nodes (grandparent → parent → leaf). Two checks:

1. **Upward from P**: walk ancestors of P. If P already has a grandparent (i.e., P's parent has a parent), reject — adding C below P would create depth 4.
2. **Downward from C**: walk descendants of C. If C already has children AND P already has a parent, reject — the chain would be: P's parent → P → C → C's child = depth 4.

Note: C having children is allowed if P has no parents (P becomes grandparent, C becomes mid-level, C's children are leaves = depth 3). P having a parent is allowed if C has no children (P's parent is grandparent, P is mid-level, C is leaf = depth 3). The violation only occurs when BOTH conditions are true simultaneously.

### Cycle detection

Reject any insert where `child_end_id` is an ancestor of `parent_end_id`. Walk upward from P; if C is found in the ancestor chain, the insert would create a cycle (A → B → C → A).

### Ownership

Both parent and child must exist and be owned by the current user (or parent is accessible via sharing).

### Cascade

Deleting an end cascades to its `end_supports` rows (both as parent and child).

### Error responses

`link_supporting_end` must return a descriptive error if any check fails:

- `"error": "link_would_exceed_max_depth"` — depth check failed
- `"error": "link_would_create_cycle"` — cycle detection failed
- `"error": "self_link_not_allowed"` — parent and child are the same end

---

## MCP Tool Changes

### New tools

- **`link_supporting_end`**: Links a child end as supporting a parent end.
  - Parameters: `parentEndId` (required), `childEndId` (required), `rationale` (optional)
  - Validates: upward depth check, downward depth check, cycle detection, self-link check
  - Returns: `{ linked: { parentEndId, childEndId, rationale } }`

- **`unlink_supporting_end`**: Removes a support link.
  - Parameters: `parentEndId` (required), `childEndId` (required)
  - Returns: `{ unlinked: { parentEndId, childEndId } }`

### Updated tools

- **`get_end`**: Include `supportingEnds` array (children) and `supports` array (parents) in the response. Each entry: `{ id, name, endType, state, rationale }`. Both arrays always returned, empty when no relationships exist.

- **`list_ends`**: Include `supportingEndCount` and `supportsCount` fields on each end so the LLM knows which ends have relationships without fetching full details.

- **`create_end`**: Add optional `parentEndId` and `supportRationale` parameters — convenience for creating a supporting end and linking it in one call (equivalent to create + link_supporting_end). Both operations must be wrapped in a transaction; if the link fails, the end creation is rolled back.

---

## Migration

```sql
CREATE TABLE end_supports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_end_id UUID NOT NULL REFERENCES ends(id) ON DELETE CASCADE,
  child_end_id UUID NOT NULL REFERENCES ends(id) ON DELETE CASCADE,
  rationale TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_end_id, child_end_id),
  CHECK (parent_end_id != child_end_id)
);

CREATE INDEX idx_end_supports_parent ON end_supports(parent_end_id);
CREATE INDEX idx_end_supports_child ON end_supports(child_end_id);
```

No backfill needed — existing ends have no support relationships.

---

## Example

```
"Bring tldr to market" (destination, active)          ← grandparent
├── "Launch the mobile app" (destination, active)      ← mid-level (parent)
│       ├── "Validate pricing" (inquiry, active)       ← leaf
│       └── "First 10 customers" (destination, active) ← leaf
└── "Establish distribution" (destination, active)     ← leaf
```

"Launch the mobile app" is a mid-level end — it has a parent ("Bring tldr to market") and children ("Validate pricing", "First 10 customers"). "Establish distribution" is a leaf — it has a parent but no children. This is the two-level decomposition that expresses natural goal hierarchy without unbounded complexity.

### Invalid insert examples

**Depth violation**: If "Validate pricing" (a leaf with a grandparent) tries to add a child, rejected — would create depth 4.

**Cycle violation**: If "Bring tldr to market" tries to add "Validate pricing" as a parent, rejected — "Validate pricing" is already a descendant of "Bring tldr to market."
