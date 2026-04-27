# Prompt: Generate tldr SKILL.md

## What a SKILL.md is

A SKILL.md is a context document read by a Claude instance at the start of any conversation where this MCP server is available. Its sole purpose is to produce correct LLM behavior. Write for an LLM reader, not a human one. Precision beats readability. Explicit beats inferable. If there's a mistake an LLM would plausibly make, the skill should prevent it.

---

## Your research process before writing

Do this before drafting anything:

1. **Read every tool description and parameter** on the tldr MCP server. This is your ground truth. Note: what tools exist, what each does, what each parameter means, which parameters are required vs optional, and any instructions embedded in tool descriptions.
2. **Identify ambiguities and traps** — places where an LLM might reach for the wrong tool, skip a required computation, or misunderstand a field. These become explicit rules in the skill.
3. **Trace the key workflows end to end:** logging a habit, creating a one-time task, creating a recurring task, completing a recurring task, logging time on a task, querying what's due. For each, identify the exact sequence of tool calls and any pre-call computations the LLM is responsible for.
4. **Read the data schema** to understand field types, relationships, and any server-side vs LLM-side responsibilities.

---

## What to include in the SKILL.md

Structure it around what an LLM needs to operate correctly:

- **Data model** — the hierarchy and key relationships, concisely
- **Behavioral guidelines** — rules for each major workflow; be explicit about tool choice, parameter responsibility, and sequencing
- **Tool disambiguation** — a table or section that makes the right tool obvious for common intents, especially where multiple tools could plausibly apply
- **Recurrence mechanics** — this was recently implemented; document it fully (fields, lifecycle, nextDueAt computation responsibility, how recurring tasks behave in list queries)
- **Projection model** — how habits vs recurring tasks vs one-time tasks are weighted in planning conversations
- **Architecture principles** — brief; helps Claude reason about novel situations by understanding the design philosophy
- **What's not yet built** — any planned features that aren't live, so Claude doesn't hallucinate their availability

---

## What to omit

This SKILL.md is a **product default** — a starting point for any new tldr user. Do not include anything user-specific:

- No personal names, relationships, or people IDs
- No specific ends, portfolios, or habit IDs
- No organization-specific setup

User-specific context belongs in a separate layer (e.g. Claude's memory or a user-maintained config) — not in this file.

---

## Quality criteria

- An LLM reading this skill should never need to guess which tool to use for a common operation
- Any field the LLM is responsible for computing before a tool call should be explicitly called out
- Any "gotcha" behavior (e.g. recurring tasks hidden from default queries, server auto-reopening on completion) should be stated as a rule, not left to inference
- Keep it as short as the above allows — every line should earn its place