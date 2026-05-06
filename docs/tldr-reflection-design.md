# tldr: LLM Reflection Design Note

**Version:** 0.1
**Date:** May 6, 2026
**Status:** Design note (not a spec)

---

## 1. Overview

Reflection — "how am I doing?", weekly summaries, surfacing where the user has fallen behind on what matters — is an LLM responsibility, not a server-side engine. The server's job is to surface the right structured data and provide the LLM with guidance on how to use it. The LLM's job is synthesis, framing, tone, and judgment.

This note captures the two-part model, the work that supports it, and a few design questions worth resolving before V1 prompt language is finalized.

This is intentionally a design note, not a spec. Reflection behavior is best understood empirically — write SKILL.md guidance, watch how the LLM uses it, iterate. Concrete prompt templates and output structures will come from real sessions, not whiteboarding.

---

## 2. The Two-Part Model

Reflection is driven by two pieces, both server-controlled:

**Data — surfaced via tools.**
The LLM reasons over structured fields, not raw timestamps. `daysSinceLastAction`, `expectedIntervalDays`, `daysOverdue`, `lastActivityAt`, temporal metadata on activities. The server pre-computes these because aggregate arithmetic is exactly the kind of thing the LLM does inconsistently across long contexts.

**Guidance — surfaced via SKILL.md and system instructions.**
The LLM is told *how* to reason: when to flag a gap, when to celebrate a streak, what tone to use when the user is clearly struggling, how to prioritize among ten potential things to surface. Guidance evolves as we learn what works.

Neither piece is enough alone. Data without guidance produces flat "here's what you did" recitations. Guidance without data produces hallucinated specifics. Both together: the LLM has facts to anchor on and a frame for using them.

---

## 3. Pre-requisites

### Shipped

- **Temporal metadata** (`tldr-temporal-metadata-spec.md`) — `dayOfWeek`, `dayOfMonth`, `weekOfMonth` on activity records. Lets the LLM reason about day-of-week patterns without computing dates.
- **`preferredDays`** on habits and recurring tasks — captures which days the user prefers, supporting "you usually run on Tuesdays" framing.
- **`list_activity`** with grouping by area/end/portfolio, period filters — the canonical "what did I do?" tool.
- **Recurring task lifecycle** — `nextDueAt` recomputation on completion, supporting "what's due?" reasoning.

### Planned

- **Cadence signals** (`tldr-cadence-signals-spec.md`) — `lastActionAt`, `daysSinceLastAction`, `expectedIntervalDays` on habits; `daysOverdue` on tasks. The most load-bearing pre-req. Without these, the LLM has to compute gaps from raw `completedAt` timestamps and interpret recurrence strings inconsistently.
- **SKILL.md reflection section** — guidance on when to surface gaps, how to prioritize, what tone to use. Lands alongside cadence-signals.

### Not required for V1, but enables future modes

- **Server-side scheduled triggers** (Cloudflare Cron) — for proactive/push reflection (system pings the user, e.g., weekly Sunday summary). V1 is pull-only; proactive is a follow-up.
- **`list_gaps` convenience tool** — pre-filtered "what's behind." Possibly useful, possibly redundant once cadence signals are on the existing list tools.

---

## 4. Modes of Reflection

| Mode | Trigger | V1? |
|---|---|---|
| **Pull / on-demand** | User asks: "how am I doing?", "what's behind?", "weekly reflection" | Yes |
| **User-initiated weekly** | User opens chat with intent to do a structured weekly review | Yes (same as pull, just longer) |
| **Scheduled proactive** | System pings user on a cadence (e.g., Sunday evening summary) | Future — needs Cron + delivery channel |
| **Event-driven proactive** | System notices a gap and surfaces it at next interaction | Future |

V1 is entirely pull-based: the user prompts, the LLM reflects. This avoids needing scheduled jobs, notification infrastructure, or push delivery channels in the first cut. Proactive modes earn their place later if pull reflection is working well and the user wants the system to be more active.

---

## 5. Surface

Reflection can happen in two places:

- **Chat agent (web app)** — has the user's full conversation context, prompt caching for cost efficiency, but is rate-limit-constrained today (61 tools × full history exceeds the 30K/min tier on long sessions).
- **MCP client (Claude Desktop, Code, web)** — uses whatever model the user is running, gets SKILL.md as session instructions, no rate-limit issues that aren't the user's own.

Recommendation: **target MCP first.** SKILL.md guidance is already the delivery mechanism for tldr-specific instructions there, and most heavy reflection sessions today happen in Claude Desktop / Code. The chat agent gains the same behavior automatically once SKILL.md ships, since both surfaces share the same tool layer.

---

## 6. Principles (not prescriptions)

Worth writing down so SKILL.md guidance and prompt iterations stay coherent. These are starting points; calibrate against real sessions.

- **Lead with what's true, not what's nice.** Don't bury a 3-week gym gap under five lines of encouragement. The user is asking because they want to know.
- **Surface few things, well.** Three or four concrete observations beat fifteen shallow ones. Reflection is curation.
- **Frame gaps in terms of the user's stated commitment.** "You said this matters" lands harder than "you missed your gym sessions."
- **Match tone to context.** A user closing out a strong week wants celebration. A user opening with "I've been a mess" wants empathy first, data second.
- **Wins matter.** Cadence-gap detection makes it easy to over-index on what's broken. Surface streaks and progress alongside gaps.
- **Don't moralize.** The LLM is not the user's coach. It surfaces; the user decides.

---

## 7. Storing Reflections (Possibility)

A future direction worth flagging: persist reflection sessions as first-class records.

A `reflections` table could store:
- The trigger (user prompt, scheduled cron, event)
- The LLM's analysis (what it surfaced, what it framed as priority)
- The user's response (free-text, or structured: "I agree", "I don't", "I'll act on this", commitments made)
- Timestamps and the conversation context

**Why this might be valuable:**

- **Reflections of reflections.** Future reflection sessions can reference past ones — "you've now mentioned the gym slowdown three weekends in a row," "last month you committed to walking on Tuesdays; let's see how that went."
- **Pattern detection over time.** The user's response patterns (denial, action, deferral) become observable. Surfaces a meta-layer the user might not see themselves.
- **Continuity across surfaces.** Reflection in the chat agent and reflection via Claude Desktop become parts of one record, not parallel histories.

**Why this is a possibility, not a commitment:**

- Storing LLM output is a data growth and privacy concern not currently in the system's scope.
- "Reflections of reflections" is a powerful idea but easy to over-engineer. The simpler path — letting reflection be ephemeral and re-derived from the underlying data — may be enough.
- Until pull-based reflection is working well, building durable storage on top of it is premature.

If pursued, it would be its own spec. Not V1.

---

## 8. Open Questions

- **Threshold tuning.** What multiplier of `expectedIntervalDays` constitutes "behind"? Cadence-signals spec proposes 1.5× as a starting point — to be calibrated.
- **Reflection vs. action.** Should reflection naturally bridge into action ("want to set a task to check in on this?") or stay observational? Probably the former, but worth deciding deliberately.
- **Time horizons.** Is "the past week" the default reflection window, or should the LLM detect intent (weekly vs. monthly vs. quarterly)? Probably context-detected; SKILL.md should give defaults.
- **Reflection on inquiries.** Inquiry ends have a `thesis` — reflection on these is qualitatively different from habit/destination reflection. May need its own SKILL.md sub-pattern.

---

*Read alongside `tldr-cadence-signals-spec.md` (data pre-req) and `tldr-temporal-metadata-spec.md` (already shipped).*
