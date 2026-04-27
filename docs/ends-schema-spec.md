# Ends Schema Enhancement Spec
## Overview

Enhance the `ends` data model to support three distinct end types, each with its own state machine, valid transitions, and reflection logic. This replaces (or extends) any existing flat status/archived fields on ends.

---

## New Fields

### `end_type` (enum, required)
Determines the nature of the end and drives valid states, UI options, and LLM reflection prompts.

| Value | Description |
|---|---|
| `journey` | An ongoing aspiration with no finish line. Identity-level commitments. Example: "Be a disciple of Jesus", "Be a good father." |
| `destination` | A bounded goal with a clear done state. Project-like. Example: "Launch LED Logo Panel", "Remove trees from property." |
| `inquiry` | A hypothesis under investigation. Closes when sufficient conviction is reached to decide, not when a task is completed. Example: "Is LED Logo Panel a viable product line?" |

### `due_date` (date, optional)
- Optional for all types.
- Most relevant for `destination` ends (target completion date).
- Meaningful for `inquiry` ends as a self-imposed conviction deadline — "I want to have decided by X."
- Generally not used for `journey` ends.

### `thesis` (text, optional)
- Applicable to `inquiry` ends only.
- A one-sentence statement of what is being investigated.
- Surfaced in every reflection prompt for this end as the anchor question.
- Example: "Is LED Logo Panel a viable product line at sufficient margin to justify continued investment?"

### `resolution_notes` (text, optional)
- Applicable to `inquiry` ends only.
- Captured at the moment the end transitions to `resolved`.
- Records the conclusion reached and the reasoning behind it.
- Preserved permanently for retrospective reflection even after the end is closed.

---

## State Machines

The valid states and transitions are determined by `end_type`. Enforce valid states at the data layer — an end should never be in a state not permitted by its type.

### Journey
```
active ⟷ paused
active → archived
paused → archived
```
| State | Meaning |
|---|---|
| `active` | Currently living into this aspiration. |
| `paused` | Temporarily deprioritized but not abandoned. |
| `archived` | No longer pursuing. |

### Destination
```
active → completed
active → abandoned
```
| State | Meaning |
|---|---|
| `active` | In progress. |
| `completed` | Done state reached. Triggers a completion reflection prompt. |
| `abandoned` | Decided not to pursue. |

### Inquiry
```
active → resolved
active → abandoned
```
| State | Meaning |
|---|---|
| `active` | Investigation underway. |
| `resolved` | Sufficient conviction reached. Capture `resolution_notes` at transition. |
| `abandoned` | Stopped investigating without reaching conviction. |

---

## Lifecycle Notes

### Inquiry → Destination promotion
When an inquiry resolves with a "yes" answer, do **not** mutate the inquiry end into a destination. Instead:
1. Resolve the inquiry end (capturing resolution notes).
2. Create a new destination end for the execution phase.
3. Optionally link the new destination end back to the originating inquiry end for lineage.

This preserves the full history of the inquiry as its own entity and keeps the data model clean.

### Reflection prompt differentiation
The LLM should use `end_type` to modulate reflection behavior:

| Type | Reflection prompt focus |
|---|---|
| `journey` | "How well are you living into this? Which habits are supporting it? Which are lagging?" |
| `destination` | "What is the current status? What's the next action? Are you on track for the due date?" |
| `inquiry` | "What have you learned? What is still unresolved? What would change your mind? Are you ready to decide?" |

---

## Validation Rules

- `end_type` is required on create. Changes after creation require user confirmation (warn, don't block). Future: restrict changes once the end has any associated activity (tasks, actions, or task time entries).
- `state` must be a valid value for the given `end_type` (enforce at API/DB layer).
- `thesis` and `resolution_notes` are only valid on `inquiry` ends.
- `resolution_notes` should be required (or at least strongly prompted) when transitioning an inquiry end to `resolved`.
- `due_date` is optional for all types but should be surfaced prominently in UI for `destination` ends.

