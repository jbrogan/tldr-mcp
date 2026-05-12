# tldr: Website Product Spec

**Version:** 0.4
**Date:** May 12, 2026
**Status:** Draft

---

## 1. Product Vision

**tldr.** Short, clean, memorable. And underneath it, a tagline that tells you everything: **Think. Learn. Do. Reflect.**

The tl;dr origin — "too long; didn't read" — is part of the brand story, told in the right context. Not the front door, but a piece of the narrative that rewards people who dig in. The product name stands on its own. The tagline does the explaining.

tldr is a personal life management system built around the full cycle of intentional living. Think through what matters. Learn from what you've done. Do the things that serve your ends. Reflect on whether it's working.

Most productivity tools help you get more done. tldr helps you get the *right* things done — by grounding every habit, task, and activity in a clear hierarchy of what you're actually trying to become and accomplish. It's not a to-do list. It's not a habit tracker. It's a system for people who think seriously about how they live.

### The Four Pillars

- **Think** — Clarify your beliefs and define your ends. Know what you're working toward and why before you take a single step.
- **Learn** — Inquiry ends and reflection analysis. Turn open questions into lived exploration and extract meaning from experience.
- **Do** — Habits and tasks in service of ends. The daily and weekly behaviors that move you forward.
- **Reflect** — Look back with context. Understand not just what you did, but how it aligns with where you're going — and what to do differently.

---

## 2. Target Audience

### Primary
- Intentional adults (30–55) who already use some form of productivity or life management system but feel it lacks coherence or meaning
- People who journal, do annual reviews, or think in terms of life areas and goals
- Entrepreneurs, professionals, and leaders who manage multiple domains of life simultaneously

### Secondary
- Disciples, coaches, mentors — people who think about life design for themselves and others
- Families who want to track shared goals and activities together

### Psychographic Profile
The tldr user isn't overwhelmed — they're *underaligned*. They have plenty of drive and discipline. What they lack is a system that connects daily behavior to deeper intention. They've outgrown task managers and habit trackers and are ready for something that treats their life as a coherent whole.

---

## 3. Core Value Propositions

**1. From activity to meaning.**
tldr connects everything you do to why you're doing it. Every habit and task is anchored to an end — an aspiration, a destination, or an open question you're living into.

**2. Reflection that goes deeper.**
Because tldr knows *why* you do what you do, reflection isn't just "here's what you logged." It surfaces how your time aligns with your intentions — which areas are thriving, which are neglected, and what that means given where you want to go.

**3. Projection with honesty.**
tldr shows you what your commitments actually cost in time — before the week or month begins. Not just what's on your calendar, but the full load of your recurring habits and scheduled tasks mapped against your available attention.

**4. One system, whole life.**
Career, health, relationships, finances, faith, home — tldr holds all of it together in a single coherent model, organized by the life areas that matter to you.

**5. AI as the bridge between action and meaning.**
tldr uses your AI assistant as its interface — not as a gimmick, but as the layer that makes meaning possible. AI is what allows tldr to connect your daily activity to your deeper intentions, surface patterns you wouldn't see on your own, and give you reflection that actually says something. You talk to it the way you'd talk to a trusted advisor who knows your whole life. It responds with the kind of insight that turns data into direction.

---

## 4. The Data Model (User-Facing Language)

### Beliefs
The bedrock. Your core values — the convictions that explain why certain things matter to you. Beliefs motivate ends. When you know your beliefs, your ends make sense.

*Example: "Family is where I invest my deepest energy."*

### Ends
What you're working toward. Every habit and task in tldr serves an end. There are three kinds:

- **Journey ends** — ongoing ways of being with no finish line. *"Be a present father." "Maintain a healthy lifestyle."*
- **Destination ends** — specific outcomes you're driving toward. *"Replace the roof by August." "Launch the product."*
- **Inquiry ends** — open questions you're living into. *"What level of financial resources do I need to retire comfortably?"*

Ends belong to life areas and can be organized into portfolios. They have a lifecycle — active, paused, completed, resolved — and that state flows implicitly to everything attached to them.

### Habits
Recurring behaviors where **consistency is the point**. A habit isn't something you complete — it's something you practice. tldr tracks frequency, duration, and streaks, and surfaces gaps when your cadence slips.

*Examples: Daily workout. Weekly call with mom. Bi-weekly investment review.*

### Tasks
Bounded work where **completion is the point**. Tasks can be one-off or recurring. They have due dates, estimates, and scheduling. When you finish them, they're done (or they recur on schedule).

*Examples: Reconcile accounts in Quicken. Calculate net worth. Review insurance premiums.*

### Activity Log
Every habit logged and every task worked generates an activity record — with actual duration, notes, and who you did it with or for. This is the raw material for reflection.

### Life Areas
The domains of your life — Health, Career, Finances, Relationships, Family, Spiritual, Physical Environment, and others. Areas give your ends geographic context in the landscape of your life.

### Portfolios
Groupings of ends under an organization, team, or person. Useful for managing multiple ventures, roles, or life contexts.

### Organizations & People
tldr knows your world. Family members, colleagues, collaborators — people are first-class objects. You can log what you did *with* someone or *for* someone, enabling richer relational reflection.

---

## 5. Key Features

### Intentional Logging
Log habits and tasks conversationally. No forms, no friction. Tell tldr what you did, and it finds the right place in your system.

### Reflection
Look back with clarity. Daily, weekly, and monthly reflection organized by life area and end — with total time, pattern recognition, and alignment analysis. tldr doesn't just show you what you did; it shows you what it means.

### Projection
Look forward with honesty. See the full weight of your commitments — recurring habits, scheduled tasks, and open obligations — mapped against your available time. Know before the week starts whether your intentions and your calendar are in sync.

### End State Management
Pause an end and everything attached to it goes quiet — no nudges, no overdue alerts, no noise. Reactivate it and everything resumes. One change, whole system responds. *(See: End State & Implicit Cascade Spec)*

### Relationship Tracking
Log shared experiences and acts of service with the people who matter. Track time invested in relationships the same way you track time invested in work.

### AI as Meaning Engine
tldr runs through the AI assistant you already use — not to replace your thinking, but to give it back to you with context. AI is what makes the connection between your actions and their meaning legible. Log what you did, and tldr tells you what it adds up to. Ask how your week looked, and it doesn't just list activities — it tells you which ends were served, which were neglected, and what that pattern suggests. The intelligence isn't the point; the meaning it surfaces is.

### How You Use tldr
tldr connects to your AI assistant through **Model Context Protocol (MCP)** — an open standard for linking assistants to external tools and data. Any MCP-compatible assistant works: Claude Desktop, Claude Code, claude.ai web, Codex, Cursor, OpenRouter, and others.

At launch, first-class setup guides cover the Claude surfaces; setup for other MCP clients works the same way and is documented as the community contributes walkthroughs. For most users, claude.ai web is the simplest path: add the tldr connector once and the system's full capabilities become available in any conversation.

A tldr subscription does not include an AI subscription — you bring your own. (Anthropic's Claude has a free tier; paid plans unlock higher usage.)

The dashboard at app.tldr4.ai gives you a visual view of your beliefs, ends, habits, and activity. Day-to-day logging, reflection, and projection happen conversationally with your AI assistant.

---

## 6. How tldr Is Different

| | tldr | Task Managers | Habit Trackers | Journaling Apps |
|---|---|---|---|---|
| Connects behavior to intention | ✅ | ❌ | ❌ | Partial |
| Tracks habits and tasks together | ✅ | Partial | ❌ | ❌ |
| Life area organization | ✅ | Rarely | Rarely | ❌ |
| Reflection with meaning | ✅ | ❌ | Limited | ✅ |
| Forward projection | ✅ | Limited | ❌ | ❌ |
| Relationship / people tracking | ✅ | ❌ | ❌ | ❌ |
| AI surfaces meaning from activity | ✅ | ❌ | ❌ | ❌ |
| Belief-grounded model | ✅ | ❌ | ❌ | ❌ |
| Think. Learn. Do. Reflect. framework | ✅ | ❌ | ❌ | ❌ |

---

## 7. The tldr Philosophy

**Think. Learn. Do. Reflect.** This isn't a tagline — it's the architecture. The system is designed around the full cycle of intentional living, not just the "Do" slice that most productivity tools optimize for.

**Means serve ends.** Habits and tasks are not goals — they are behaviors in service of goals. tldr keeps that relationship explicit so you never lose the thread between what you're doing and why.

**AI surfaces meaning; humans provide it.** The role of AI in tldr is not to tell you what to do. It's to make the meaning of what you've done legible — to close the loop between action and intention in a way no static dashboard can.

**State should be simple.** You manage your intentions. The system manages the implications. Pausing a goal shouldn't require touching every attached habit and task.

**Reflection requires context.** A list of what you did last week is not reflection. Reflection is understanding how what you did maps to where you're trying to go — and what the gaps mean.

**The richer the ontology, the more meaningful the insight.** The more faithfully your system represents your life — your beliefs, your areas, your ends — the more useful the analysis becomes. tldr is designed to reward investment in the model.

**Your life is more than your work.** Most productivity systems are optimized for professional output. tldr treats health, relationships, faith, and home as first-class domains, not afterthoughts.

---

## 8. Suggested Website Structure

The site is both marketing for prospective users and product documentation for active users. The information architecture reflects both audiences — marketing surfaces at the top of the tree, documentation under `/docs/*`. The two share visual identity but have distinct navigation. MCP (Model Context Protocol — the open standard that connects tldr to your AI assistant) is named where it matters — §5 "How You Use tldr" and the setup docs — but isn't the lede on the homepage. Hero copy leads with Think. Learn. Do. Reflect., not the protocol.

### Homepage
- Hero: headline built around "Think. Learn. Do. Reflect." with the tl;dr reclaim as the hook
- Problem framing: what's broken about current tools — they help you do more, not live better
- The tldr cycle: brief visual of Think → Learn → Do → Reflect
- The data model underneath: Beliefs → Ends → Habits/Tasks
- How AI connects action to meaning (not AI as feature, AI as enabler)
- CTA: Subscribe / Get Started (launch-ready; signups may be limited)

### How It Works
- Walk through the four pillars in plain language with examples
- Show the data model: beliefs, ends, habits, tasks, activity
- Illustrate a sample reflection conversation
- Show the projection view
- Demonstrate the conversational AI interface

### Features
- Intentional Logging
- Reflection (with AI-surfaced meaning)
- Projection
- End State Management
- People & Relationships
- Life Areas & Portfolios

### Philosophy
- Longer-form narrative on intentional living and the Think. Learn. Do. Reflect. cycle
- The belief → end → behavior hierarchy explained
- Why most productivity tools only solve the "Do" problem
- The role of AI: not automation, but meaning

### Pricing
Two tiers, no usage caps at either. Position around the full cycle (Think. Learn. Do. Reflect.), not feature checklists. The competition isn't task managers; it's "no system" or "scattered systems."

**Individual — $12/mo or $120/yr (~17% annual discount)**
- Single user
- All features: beliefs, ends, habits, tasks, reflection, projection
- Sharing and observer relationships — invite others to view your ends
- Unlimited data

**Family — $36/mo or $360/yr (~17% annual discount)**
- Up to 5 individual accounts under one billing relationship (~40% household discount vs. five Individual subscriptions)
- All Individual features for each member
- Each user has their own ends; sharing is opt-in per end

**30-day free trial. Credit card required.** Filters for serious intent and avoids the "trial ended, surprise charge" friction. Cancel anytime during the trial without being charged.

A tldr subscription does not include Claude — bring your own.

### Documentation (`/docs`)
- **Getting started** — account creation, first end, first habit, first reflection
- **Setup** — connector walkthroughs for the Claude surfaces at launch (Desktop, Code, and claude.ai web — the primary path for non-technical users). Plus a generic "Other MCP-compatible clients" page covering Codex, Cursor, OpenRouter, and others; deeper per-client walkthroughs added as the community contributes them. Note: ChatGPT does **not** currently support MCP connectors and is not a target client
- **Concepts** — beliefs, ends, habits, tasks, activity, areas, portfolios, people; formal definitions and examples
- **Reflection** — how to reflect with Claude, prompt patterns, weekly/monthly rhythms
- **Dashboard** — using app.tldr4.ai for the visual view
- **Troubleshooting** — common connector issues, sync problems, billing FAQ
- **Changelog** — what's new, organized by month
- **For Developers** *(optional, deferred)* — MCP technical reference for the curious

### Blog / Journal *(optional)*
- Content around intentional living, life design, reflection practices
- The "Think. Learn. Do. Reflect." framework as a content pillar

---

## 9. Tone & Voice Guidelines

**Voice:** Thoughtful, direct, unhurried. tldr speaks to people who think carefully about their lives — not people who need to be hyped up.

**The name and tagline:** "tldr" is the product name — clean, short, modern. "Think. Learn. Do. Reflect." is the tagline that does the explaining. The tl;dr origin story is brand narrative, not homepage copy — surfaced in the Philosophy or About section for people who dig in.

**Avoid:** Hustle culture language ("crush it," "dominate your day," "level up"). Complexity jargon. Positioning AI as magic or automation. Over-promising.

**Lean into:** Clarity. Intentionality. The quiet confidence of someone who knows what they're doing and why. Words like: *intention, alignment, reflection, meaning, practice, serve, whole life, cycle, purpose.*

**On AI specifically:** Never lead with "AI-powered." Lead with what AI makes possible — meaning, insight, connection between action and intention. AI is the enabler; meaning is the product.

**Analogies that work:**
- A trusted advisor who knows your whole life
- A mirror that shows you not just what you did, but what it means
- A compass, not a treadmill
- The full cycle, not just the sprint

---

## 10. Open Items for Website Planning

- Final product name stylization (tldr — visual/typographic treatment TBD)
- Visual identity / design direction
- Testimonial / early user quotes for launch
- Demo video or interactive prototype — **required for launch**; the AI-as-meaning-engine value prop is hand-wavy without a concrete example dialogue or screen capture
- SEO strategy as part of the docs build (domain confirmed: tldr4.ai)
- Final billing platform decision (Stripe / Paddle / Lemon Squeezy) — affects subscription management copy
- Resolve the §3.5 / §5 "AI as Meaning Engine" duplication when copywriting begins — both sections currently make the same point

## 11. Changelog

- **v0.4 (2026-05-12):** Positioning broadened from Claude-specific to MCP-compatible. Marketing copy uses "your AI assistant" (§3.5, §5 AI as Meaning Engine) with Claude as the primary example, not the only option. §5 "How You Use tldr" now explicitly names Model Context Protocol and lists compatible clients: Claude Desktop, Claude Code, claude.ai web, Codex, Cursor, OpenRouter. First-class setup docs at launch are Anthropic-only; other MCP clients work the same way and ship with a generic walkthrough. ChatGPT noted as a non-target — does not support MCP connectors.
- **v0.3 (2026-05-12):** Pricing tiers finalized ($12 Individual / $36 Family, both with sharing/observer). In-app chat deprecated — product is dashboard + MCP connector. Site structure expanded to include `/docs/*` as primary documentation surface alongside marketing. "Projection (coming soon)" promoted to live feature for launch. MCP visibility decision recorded: invisible on marketing pages, surfaced in docs. "How You Use tldr" subsection added to §5 to explain the connector model. Open Items shrunk: pricing, signup limit, and grandfathering decisions resolved.
- **v0.2 (2026-04-29):** Initial detailed draft.

---

*This spec is intended as the primary input for website copywriting, design direction, and content planning. It should be read alongside the End State & Implicit Cascade Spec (April 2026) for technical product context.*
