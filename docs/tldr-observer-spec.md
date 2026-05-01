# tldr: Observer Role Spec

**Version:** 0.1
**Date:** April 30, 2026
**Status:** Draft — for future consideration

---

## 1. Overview

The observer role extends the existing end sharing model to support accountability relationships. An observer is a user who can see progress on a specific end — activity, habit cadence, and milestones — with the explicit purpose of keeping the end owner accountable.

**Example:** "I want to run the NYC marathon and I add my son as an observer to keep me accountable."

---

## 2. How It Differs from Current Sharing

| Capability | Current sharing | Observer |
|---|---|---|
| See end details (name, type, state, purpose) | Yes | Yes |
| See attached habits and their cadence | Yes | Yes |
| See actions logged against the end | Yes (group visibility) | Yes |
| See task details | No (tasks are user-owned) | No |
| Log actions against the end | No (read-only) | No |
| **Accountability framing in reflection** | No | **Yes** |
| **Cadence alerts for observer** | No | **Yes (Phase 2)** |
| **System knows this is an accountability relationship** | No | **Yes** |

The key distinction is not access level (which is similar to current sharing) but the system's awareness that this is an accountability relationship — enabling accountability-specific reflection prompts and notifications.

---

## 3. Data Model

### 3.1 Option A: Role on end_shares

Add a `role` column to the existing `end_shares` table:

```
end_shares (modification):
  role    enum: 'collaborator' | 'observer'    default 'collaborator'
```

Existing shares default to `collaborator` (current behavior). New observer shares are created with `role = 'observer'`. Access rules are identical; the role is a semantic label used by the reflection engine and notification system.

### 3.2 Option B: Separate observer table

```
end_observers:
  id              uuid
  endId           uuid -> ends.id
  observerUserId  uuid -> profiles.id
  label           text (e.g., "accountability partner", "coach")
  createdAt       timestamptz
```

Option A is simpler and avoids a new table. Option B is cleaner if observer behavior diverges significantly from sharing. **Recommendation: start with Option A.**

---

## 4. Reflection Integration

The primary value of the observer role is enabling accountability-aware reflection:

- **Owner's reflection:** "You added [son] as an observer on 'Run NYC Marathon.' You haven't logged a training run in 12 days. Your next scheduled run was 5 days ago."

- **Gap escalation:** When an observed end has a cadence gap exceeding 2x the expected interval, the reflection engine flags it with higher urgency than a non-observed end. The accountability relationship raises the stakes of neglect.

- **Positive reinforcement:** "You've logged 4 training runs this week on 'Run NYC Marathon' — your observer [son] can see your consistency."

---

## 5. Observer Experience

### 5.1 Minimum Viable Observer Experience

The observer must be a tldr user (has an account). They see observed ends in their dashboard/LLM interface:

- A "Shared with me" or "Observing" section showing ends where they are an observer
- For each observed end: name, type, state, recent activity, habit cadence status
- Read-only — no ability to modify the end or log activity

### 5.2 Low-Friction Observer Experience (Future)

For observers who are not tldr power users:

- **Email digest:** Weekly summary of the observed end's activity sent to the observer. No login required.
- **Read-only link:** A shareable URL that shows the end's progress dashboard without requiring authentication. Secured by an unguessable token with optional expiry.

These reduce the adoption barrier for accountability partners who don't need the full tldr system.

---

## 6. Notification System (Phase 2)

When an observed end shows a cadence gap:

- **To the owner:** Surfaced in reflection (see Section 4)
- **To the observer:** Optional notification (email or in-app) that the person they're observing has fallen behind

Notification preferences should be configurable:
- Observer can opt in/out of notifications per observed end
- Owner can see who is being notified about their progress

---

## 7. MCP Tool Changes

Minimal additions:

- **share_end** — add optional `role` parameter (default: 'collaborator'). Value 'observer' creates an observer relationship.
- **list_shared_ends** — include role in response so the LLM can distinguish observers from collaborators
- **list_my_shares** — include role so the owner sees who is observing vs. collaborating

No new tools required if using Option A (role on end_shares).

---

## 8. Relationship to Dashboard

The observer role is most valuable when the dashboard exists:

- Observers see a read-only view of the end's progress in the dashboard
- The "Shared with me" section distinguishes observed ends from collaborated ends
- Activity timeline for observed ends shows the owner's actions

**Recommendation:** Build the dashboard first (Phase 1), then add the observer role. The observer needs something to look at.

---

## 9. Open Questions

- **Bidirectional accountability:** Can two users observe each other's ends? (e.g., training partners). Likely yes — each creates an observer share on their own end pointing to the other user.
- **Observer limits:** Is there a max number of observers per end? Probably not needed initially.
- **Privacy:** Should the owner be able to hide specific actions/notes from observers while keeping the activity visible? (e.g., show "logged a run" but not the notes). Worth considering but not for V1.
- **Non-user observers:** Should the system support observers who don't have tldr accounts? The email digest approach (Section 5.2) handles this without requiring accounts, but it's a Phase 2+ concern.
- **Patent implications:** The observer role as an accountability mechanism integrated with AI-mediated reflection (the system escalates reflection urgency based on observer relationships) may be a novel dependent claim.

---

*This spec should be read alongside the End State & Implicit Cascade Spec and the Dashboard Spec.*
