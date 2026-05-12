# tldr — Product Website Spec
**Think. Learn. Do. Reflect.**
*Version 1.3 | May 2026*

---

## 1. Brand Foundation

### Identity
- **Product name:** tldr (always lowercase)
- **Tagline:** Think. Learn. Do. Reflect.
- **Category:** Life management system
- **Audience:** Intentional individuals who want their daily actions to connect to something larger — professionals, builders, people in seasons of growth or transition.

### Visual Identity Direction — Editorial / Typographic

The four words *are* the visual system. Every design decision should reinforce the weight and cadence of Think. Learn. Do. Reflect.

- **Typography:** Heavy serif or high-contrast display font for headlines and the four pillar words. Paired with a refined, readable body font. The wordmark "tldr" is set in the display face — all lowercase, tight tracking.
- **Color palette:**
  - Primary: Deep charcoal (`#1a1a1a`) or near-black
  - Background: Warm off-white (`#f5f2ec`) for light sections
  - Accent: Warm amber (`#c9893f`) — used sparingly for emphasis, CTAs, and the four pillar words
  - Text on dark: Warm off-white
- **Aesthetic:** Literary magazine meets intentional living. Dense, confident type. Generous negative space. No gradients, no glassmorphism, no tech-bro UI conventions.
- **Motion:** Staggered reveals on the four words. Deliberate, weighted — each word lands, then the next. Page transitions are slow fades, not slides.
- **Photography / illustration:** If used, high-contrast black and white. No stock photography of people looking at phones.

### Voice & Tone
- **Thoughtful, not academic.** Has a philosophy; earns its depth rather than announcing it.
- **Direct, not cold.** Short sentences. No filler. Trusts the reader.
- **Grounded, not aspirational.** Describes a system and a loop. Doesn't promise transformation.
- **Confident, not arrogant.** Has a point of view on why most productivity tools fail. States it plainly.

### Messaging Guardrails
| Say this | Not this |
|---|---|
| Life management system | Productivity app / to-do list |
| Beliefs | Core values (too corporate) |
| Ends / goals you're working toward | Objectives / OKRs |
| Life areas | Categories / buckets |
| Log a completion | Check it off / mark done |
| Reflect | Review / analyze |
| AI assistant / Claude | Chatbot / AI-powered |
| MCP (explained plainly) | "Connects to your AI" (vague) |
| Habits that compound | Streaks (avoid gamification framing) |

---

## 2. Site Architecture

```
tldr4.ai
├── /                        — Home: marketing, philosophy intro, product preview, early-access CTA
├── /philosophy              — Why tldr: the Think.Learn.Do.Reflect. framework in full
├── /how-it-works            — Product walkthrough: areas, beliefs, ends, habits, tasks, dashboard
├── /dashboard               — Dashboard feature showcase with screenshots
├── /connect                 — MCP integration guide: Claude (preferred) + other clients
├── /pricing                 — Individual / Family tiers, trial details, BYO AI note
└── /early-access            — Dedicated signup landing (campaigns, direct links)
```

**Navigation:**
`tldr` · Think · Learn · Do · Reflect · Pricing · [Get Early Access →]

> The four pillar nav items link to anchor sections on the Philosophy page, making the framework the navigational backbone of the entire site. Pricing sits between the pillars and the CTA — visible but not loud.

**Note on "early access" framing:** tldr is a paid product with both surfaces (dashboard + Claude connector) fully built. "Early access" here is positioning, not a waitlist mechanism — visitors who sign up start a 30-day free trial immediately. The framing is warm and acknowledges newness without pretending the product isn't ready.

---

## 3. MCP Integration Philosophy

tldr is built on MCP (Model Context Protocol) — the standard that allows AI assistants to connect to external tools and data sources. This is not a hidden implementation detail; it's a feature.

**How to explain MCP to a non-developer:**
> MCP is how AI assistants like Claude connect to tools like tldr. Think of it as a secure bridge — your AI assistant reads your goals, habits, and activity through tldr, and you interact with your life system through conversation.

**Client positioning:**
- **Claude** (Anthropic) — preferred and featured client. Best-in-class reasoning for reflection, planning, and analysis.
- **Other MCP-compatible clients** — listed and supported (Cursor, etc.) with setup instructions.
- The `/connect` page handles all client-specific setup. The rest of the site features Claude as the primary experience without excluding other clients.

**Consumer framing:**
Lead with Claude by name — most consumers will recognize it. Introduce MCP as the mechanism in one plain sentence, then move on. Don't bury it, don't over-explain it.

---

## 4. Page Specs

---

### 4.1 Home (`/`)

**Purpose:** Convert first-time visitors into waitlist signups. Lead with the problem and the philosophy, introduce both product surfaces (dashboard + AI), end with a clear CTA.

**Status note:** Both the dashboard and Claude connector are fully built. No "coming soon" language anywhere. This is a launch, not a teaser.

---

#### Section 1 — Hero

**Goal:** Immediate orientation. The four words land before anything else.

```
tldr

Think. Learn. Do. Reflect.

A life management system built around the loop
that separates intentional living from just staying busy.

[Get early access]
```

**Design notes:**
- "Think. Learn. Do. Reflect." animates in — each word staggered, weighted, deliberate
- Deep charcoal background, warm off-white type, amber accent on the CTA
- No subtext, no secondary links — the phrase does the work

---

#### Section 2 — The Problem

**Goal:** Name the feeling the reader already has. Create resonance before introducing the product.

```
Most people aren't lazy. They're just disconnected.

Disconnected from why they set that goal in the first place.
From whether their habits are actually moving the needle.
From what a good week even looks like for them.

You can be busy every day and still feel like nothing's happening.

tldr was built for that gap.
```

**Design notes:**
- Flowing prose, large type, warm off-white background
- Sparse layout — the copy is the only element
- Should feel like someone speaking directly to the reader, not a brand

---

#### Section 3 — The Framework

**Goal:** Introduce the four pillars as both philosophy and product architecture.

Four blocks, each anchored by one pillar word in large display type.

---

**Think.**
> Before the plans, the habits, the streaks — tldr asks a more important question: *why?*
>
> You start by defining your beliefs — the values that drive you — and from those, the goals you're working toward across every area of your life. Career. Health. Family. Finances. Spiritual. Home. Fun.
>
> Not just your work queue. Your whole life.

---

**Learn.**
> Data without meaning is just noise.
>
> tldr connects every action you log back to a goal, and every goal back to a belief. Your weekly recap isn't just a list of what you did — it's a signal about what you're actually prioritizing, what's slipping, and whether your days are pointing in the right direction.

---

**Do.**
> Execution is where intention meets reality.
>
> tldr tracks habits — the recurring behaviors that compound over time — and tasks, the specific things that need to get done. Log completions with a tap from the dashboard, or work through your day with Claude. Either way, everything is captured, connected, and counted.

---

**Reflect.**
> The loop closes here — and this is the step most systems skip entirely.
>
> Weekly recaps. Habit patterns. Time distribution across your life areas. A clear view of what's on track and what's drifting. Not as a judgment. As a compass.

---

**Design notes:**
- Each pillar word is typographically dominant — display font, large, amber or amber-tinted
- Alternating layout: word left / copy right, then word right / copy left
- Subtle background texture shift between sections
- Most design-investment-heavy section on the site

---

#### Section 4 — Product Preview

**Goal:** Make it real. Show both surfaces. Let screenshots do the work.

```
Two ways in. One system.

The tldr dashboard gives you a living view of your life —
habit patterns, goal progress, time across life areas,
and quick-log actions so you can capture completions
without breaking your flow.

[Dashboard screenshot]

tldr connects to Claude through MCP — the standard that lets
AI assistants work with external tools. Ask Claude to recap
your week, plan your next sprint, or surface what's slipping.
Claude reads your actual goals and habits. The answers mean something.

[Claude conversation screenshot]

[Connect Claude →]  [View the dashboard →]
```

**Design notes:**
- Two-column layout: dashboard screenshot left, Claude screenshot right (stacked on mobile)
- Screenshots are the hero visuals — invest in clean, representative captures
- CTAs link to `/dashboard` and `/connect` respectively

---

#### Section 4.5 — Your life is more than your tasks

**Goal:** Surface tldr's relational layer — persons, with/for semantics, sharing — without naming it as a feature category. Speak in action, not abstraction. The pillar architecture (Think. Learn. Do. Reflect.) is the brand commitment; relationships are a property the system has, not a fifth pillar.

```
Your life is more than your tasks.

tldr knows the people who matter — your family, your team,
the friends you're trying to see more of. Log what you did
with your daughter, for your spouse, with your mentor.
Share an end with someone you trust so you're working toward
it together.

Relationships aren't a soft skill. They're a category of life —
and tldr treats them that way.
```

**Design notes:**
- Light section, no inversion — warm paper background
- Serif at moderate size; the prose carries it
- No supporting visual — the concrete examples ("with your daughter, for your spouse") do the work
- Slots between Product Preview (Section 4) and Human Development Angle (Section 5)

**Voice guardrail:** never describe this as "Relationship Tracking" or any tracking-flavored phrase. The verbs are *log*, *share*, *see together* — not *track*. And don't introduce a named feature category for it; the capability lives in the prose.

---

#### Section 5 — Human Development Angle

**Goal:** Differentiate tldr at a deeper level. The "why this is different" moment.

```
This isn't a better to-do list.

Most productivity tools live at the surface —
they help you track what you're doing,
not who you're becoming.

tldr is built on a different belief:
that the gap between your values and your daily behavior
is the most important thing to understand about yourself.

When you can see that gap clearly, you can close it.

That's not productivity. That's growth.
```

**Design notes:**
- Pull-quote treatment — large type, dark background, amber on the final two lines
- No competing visual elements — typography carries the section entirely

---

#### Section 6 — Founder / Credibility Note

**Goal:** Build trust with early adopters. Honest, human, not hype.

```
Built for real life. Tested on one.

tldr started as a personal system —
built by one person who wanted their days to mean something.
It's been running, evolving, and proving itself daily ever since.

Now it's ready for more people.

If you've ever felt productive but not purposeful —
tldr was built for you.
```

**Design notes:**
- Founder photo / signature optional (TBD — see open questions)
- Tone should feel visibly different from the rest of the page — more human, less polished

---

#### Section 7 — Waitlist CTA

**Goal:** Convert. Simple, warm, low-friction.

```
Ready to close the loop?

tldr is available now in early access.
Think. Learn. Do. Reflect.

[email field]  [Get early access →]

No spam. Just tldr.
```

**Design notes:**
- Repeats the four words to close the frame opened by the hero
- Email only — no name, no dropdowns
- Dark background section to signal end-of-page and create visual contrast with what came before

---

### 4.2 Philosophy (`/philosophy`)

**Purpose:** The intellectual home of the brand. Full treatment of the Think. Learn. Do. Reflect. framework — why it works, how it relates to human development, and how it maps to the product.

**Audience:** Thoughtful readers who want to understand *why* before they commit.

---

#### Section 1 — Opening

```
Why Think. Learn. Do. Reflect.?

Because most systems only serve half the loop.

Productivity tools are great at Do.
They'll help you track, organize, and execute.
But they don't ask why you're doing what you're doing —
and they don't help you learn from what you've done.

Human development frameworks are great at Think and Reflect.
They'll help you get clear on your values and extract wisdom
from your experience. But they rarely give you the traction
to act on any of it.

tldr is built to hold all four — and to close the loop.
```

---

#### Section 2 — The Four Words, Expanded

---

**Think.**
> Development begins with awareness.
>
> You can't manage your life toward something you haven't named. tldr's foundation is *beliefs* — not as abstract principles, but as the actual values that shape your decisions when no one's watching. From beliefs flow *ends*: the aspirations you're actively working toward in each area of your life.
>
> This is the step most people skip. They go straight to goals and habits without ever asking whether those goals are rooted in anything real. Think is the anchor.

---

**Do.**
> Practice is how beliefs become character.
>
> Aristotle argued that virtue isn't something you have — it's something you *do*, repeatedly, until it becomes who you are. tldr takes this seriously. Habits aren't just routines; they're the daily expression of the person you're trying to become. Tasks aren't just work items; they're the specific moves that advance your most important ends.
>
> Do is where intention meets the calendar.

---

**Learn.**
> Experience without reflection is wasted.
>
> Data only has value when it's connected to meaning. In tldr, every action links to an end, and every end links to a belief — which means your activity log isn't just a record, it's a map. You can see which life areas are getting your time, which habits are holding, which goals are advancing, and which are being quietly abandoned.
>
> Learn is how you make the invisible visible.

---

**Reflect.**
> This is where growth actually happens.
>
> Not in the doing — in the integrating. When you close the loop by looking back on what you did, how it felt, what it produced, and whether it pointed in the right direction — that's when experience becomes wisdom rather than just mileage.
>
> Most productivity systems are silent here. tldr is built for it.

---

#### Section 3 — Life Management Meets Human Development

```
Two disciplines. One system.

Life management is about structure and execution.
Human development is about growth and transformation.

Most systems serve one or the other.
tldr connects them.

The beliefs → ends → habits → actions architecture
isn't just a data model. It's a development framework.

Beliefs represent who you want to become.
Ends are the expressions of that growth in specific life areas.
Habits are the practices that move you there.
Actions are the evidence.

When you can see all four — together, connected, over time —
you stop managing your life and start building it.
```

---

#### Section 4 — CTA

```
This is the system. Ready to run it?

[Get early access →]
```

---

### 4.3 How It Works (`/how-it-works`)

**Purpose:** Plain-language product walkthrough. Explains the data model progressively, ending with how both surfaces serve the system.

---

**Step 1 — Start with your life areas**
> tldr organizes around eight areas: Career, Health, Relationships, Family, Finances, Spiritual, Physical Environment, and Fun & Recreation. Everything in the system lives inside one of them.

**Step 2 — Define what you believe**
> Beliefs are the foundation. Before goals and plans, tldr asks what actually drives you in each area. These don't change often — they're the values that make your goals mean something.

**Step 3 — Name what you're working toward**
> Ends are your active aspirations — the things you're genuinely trying to build or become right now. Not a wish list. A working set.

**Step 4 — Build the habits**
> Habits are the recurring behaviors that serve your ends. tldr tracks frequency, duration, and patterns over time — so you can see whether the practice is actually holding.

**Step 5 — Capture the tasks**
> Tasks are bounded work: specific deliverables, milestones, things with edges. They connect to ends just like habits do, so completed work isn't floating — it's meaningful.

**Step 6 — Note the people**
> Every habit and task can be tagged with who you did it with — or who it was for. Share specific ends with people you trust so you're working toward them together. The same action means something different when you're with your daughter than when you're solo, and tldr captures that.

**Step 7 — Log, view, reflect**
> Every completion gets logged. The dashboard shows your patterns visually. Claude helps you interpret them, plan ahead, and close the loop through conversation.

**Design notes:**
- Vertical step-by-step layout with small icon per step
- Progressive — each step visually builds on the last
- Dashboard and Claude screenshots at Step 6

---

### 4.4 Dashboard (`/dashboard`)

**Purpose:** Feature showcase. Screenshot-driven.

---

**Hero**
> Your life, at a glance.
> The tldr dashboard surfaces what matters — habit patterns, goal progress, time by life area — without requiring a conversation.
> *[Hero dashboard screenshot]*

**Visualizations**
> See the patterns others miss.
> Pre-built views for habit frequency, life area time distribution, goal progress, and weekly activity. They populate as you log — no setup required.
> *[Visualization screenshots]*

**Quick-log**
> Capture without interrupting.
> Log completions against habits and tasks directly from the dashboard. A tap is enough — the system handles the rest.
> *[Quick-log UI screenshot]*

**Works with Claude**
> The dashboard and Claude are the same system.
> Everything you log in the dashboard is available to Claude. Ask for a recap, a projection, or a gut-check — Claude is reading the same data the dashboard visualizes.
> *[Side-by-side: dashboard stat ↔ Claude referencing same stat in conversation]*

**CTA**
> [Get early access →]

---

### 4.5 Connect (`/connect`)

**Purpose:** MCP setup guide. Claude is featured; other clients are listed and supported.

---

**Intro**
> tldr connects to your AI assistant through MCP — Model Context Protocol, the standard that lets AI tools read and interact with external systems securely.
>
> Once connected, your AI assistant has full context: your goals, habits, tasks, and activity. The conversation becomes useful.

**Connect with Claude** *(Featured)*
> Claude is the recommended client for tldr. It offers the best reasoning for reflection, planning, and analysis — and it's where tldr was designed to be used.
> *[Step-by-step Claude MCP setup with screenshots]*
> [Connect Claude →]

**Other MCP clients**
> tldr works with any MCP-compatible client.
> *[List of supported clients with setup links]*

**What changes once you're connected**
```
Before: a capable AI assistant.
After: an AI assistant that knows your beliefs,
       your goals, your habits, and your week.

Ask it anything.
```
> *[Example prompts: "Recap my week", "What's slipping?", "Help me plan Thursday"]*

---

### 4.6 Pricing (`/pricing`)

**Purpose:** Convert thoughtful visitors. Make the value clear; make the friction low. Same editorial restraint as the rest of the site — pricing is information, not a sales pitch.

---

#### Section 1 — Hero

```
Pricing.

Two tiers. No usage caps. Bring your own AI.
```

**Design notes:**
- Heavy serif on the single-word "Pricing." headline (consistent with /philosophy, /dashboard hero treatment)
- Subline in body sans, warm muted off-white
- Generous space before the tier cards

---

#### Section 2 — Tier Cards

Two cards, side-by-side on desktop, stacked on mobile.

---

**Individual**
> **$12 / month**
> or $120 / year — about 17% off
>
> — One user
> — All features: beliefs, ends, habits, tasks, reflection, projection
> — Share ends with people you trust — a spouse, coach, or friend — so they can see your progress
> — Unlimited data
> — 30-day free trial
>
> [Start your trial →]

---

**Family** *(featured)*
> **$36 / month**
> or $360 / year — about 17% off
>
> — Up to 5 individual accounts on one bill
> — About 40% off vs. five Individual subscriptions
> — All Individual features, for every member
> — Each member has their own ends; sharing is opt-in per end
> — 30-day free trial
>
> [Start your trial →]

---

**Design notes:**
- Tier name in heavy serif display; price in the same face, larger and amber-tinted
- Annual price treated as a small, muted line under the monthly
- List items separated by thin charcoal hairlines
- Featured tier (Family) gets a thin amber border instead of charcoal — no "Most popular" badge, no shouting
- CTA buttons match the home page: amber on charcoal

---

#### Section 3 — Bring Your Own AI

```
Bring your own AI.

tldr connects to your AI assistant through MCP — Claude,
Codex, Cursor, OpenRouter, and other compatible clients all work.
A tldr subscription doesn't include an AI subscription.

Claude has a free tier; paid plans unlock higher usage.
```

**Design notes:**
- Single column, narrower than the tier grid, generous line height
- Warm off-white background
- The kind of plain disclosure that builds trust by not hiding it

---

#### Section 4 — Trial Mechanics

```
About the trial.

30 days. Credit card required.

We ask for a card upfront to filter for serious intent
and to avoid the "trial ended, surprise charge" friction.

Cancel anytime before day 31. You won't be charged.
```

**Design notes:**
- Three short paragraphs, more white space than the rest of the page
- Match the founder-note tone from the home page — direct, human, unembellished

---

#### Section 5 — Closing CTA

```
Ready to close the loop?

[Start your trial →]
```

**Design notes:**
- Dark background section, repeats the home-page closing frame
- Same CTA copy as the home page so the conversion target is consistent

---

### 4.7 Early Access (`/early-access`)

**Purpose:** Dedicated signup page for campaigns and direct links.

```
Be among the first.

tldr is in early access.
Think. Learn. Do. Reflect.

[email]  [Join the waitlist →]

What you'll get:
— The tldr dashboard, fully built
— Claude MCP integration, ready to connect
— A life management system that connects
  what you do to what you care about

No spam. No pressure. Just tldr.
```

---

## 5. SEO & Metadata

| Page | Title | Description |
|---|---|---|
| Home | tldr — Think. Learn. Do. Reflect. | A life management system that connects your beliefs to your behavior. |
| Philosophy | The Philosophy Behind tldr | Why Think. Learn. Do. Reflect. is the loop that closes the gap between who you are and how you live. |
| How It Works | How tldr Works | From beliefs to daily actions — a plain-language walkthrough of the tldr life management system. |
| Dashboard | The tldr Dashboard | See your habits, goals, and life areas in one place. Quick-log completions and track what matters. |
| Connect | Connect tldr to Claude | Set up the tldr MCP integration with Claude or any compatible AI assistant. |
| Pricing | tldr Pricing | Two tiers. No usage caps. 30-day free trial. Bring your own AI assistant. |
| Early Access | Join tldr Early Access | Be among the first to Think. Learn. Do. Reflect. |

---

## 6. Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Visual identity | ✅ Direction set: Editorial/Typographic. Charcoal, warm off-white, amber accent. Pending logo execution. |
| 2 | Dashboard screenshots | ✅ Available — to be supplied for design |
| 3 | MCP/Claude framing | ✅ MCP is a requirement; own the term plainly. Claude is preferred client. `/connect` handles all clients. |
| 4 | Waitlist / signup tool | 🔲 TBD — email platform and CRM to be selected |
| 5 | Launch readiness | ✅ Both dashboard and Claude connector are live. Full launch framing throughout. |
| 6 | Founder presence | 🔲 TBD — photo, name, and story visibility on the site |
| 7 | Billing platform | 🔲 TBD — Stripe (default), Paddle, or Lemon Squeezy. Shapes the trial signup flow and customer portal copy. |

---

## 7. Changelog

- **v1.3 (2026-05-12):** Relational layer (persons, with/for, sharing) woven into the marketing pages without being named as a feature category. New homepage Section 4.5 ("Your life is more than your tasks"). How It Works gains Step 6 ("Note the people"), pushing Log/view/reflect to Step 7. Pricing Individual tier expands the share-ends line. Voice guardrail added: never describe this as "Relationship Tracking" or any tracking-flavored phrase — the verbs are *log*, *share*, *see together*, not *track*. Org structure (organizations, portfolios beyond the personal case) remains docs-only.
- **v1.2 (2026-05-12):** Pricing kept in scope as a paid product. New `/pricing` page added (§4.6); §2 architecture and navigation updated; clarifying note on "early access" framing (positioning, not waitlist mechanism — visitors enter the 30-day free trial immediately). SEO row added. Open Item #7 added for billing platform decision.
- **v1.1 (May 2026):** Initial detailed copywriting + design brief. Editorial/typographic visual identity. Six pages: Home, Philosophy, How It Works, Dashboard, Connect, Early Access.

---

*End of spec — v1.3*
