/**
 * Intent Catalog
 *
 * Defines all supported intents with descriptions and raw parameter schemas.
 * The LLM sees only these definitions (no user data/IDs) to classify intent
 * and extract raw string parameters.
 */

export interface RawParamDef {
  name: string;
  type: "string" | "string[]" | "number" | "boolean";
  required?: boolean;
  description?: string;
}

export interface IntentDefinition {
  name: string;
  description: string;
  rawParams: RawParamDef[];
}

export const INTENT_CATALOG: IntentDefinition[] = [
  {
    name: "create_action",
    description:
      'User logged/tracked a habit completion (e.g. "I went to the gym", "practiced guitar for 30 minutes", "had family dinner with Patrick and Andrew")',
    rawParams: [
      { name: "habitName", type: "string", required: true, description: "Name of the habit performed" },
      { name: "endName", type: "string", description: "End/aspiration name if mentioned for context (e.g. 'weekly call for Better Together' → endName: 'Better Together')" },
      { name: "completedDate", type: "string", required: true, description: 'When it happened: "today", "yesterday", or YYYY-MM-DD' },
      { name: "durationMinutes", type: "number", description: "Duration in minutes if mentioned" },
      { name: "notes", type: "string", description: "Any additional notes" },
      { name: "withPersonNames", type: "string[]", description: 'People done WITH (e.g. "with Patrick and Andrew")' },
      { name: "forPersonNames", type: "string[]", description: 'People done FOR (e.g. "for mom")' },
    ],
  },
  {
    name: "create_end",
    description:
      'User wants to create a new aspiration or goal (e.g. "I want to be a better father", "new end: Learn Spanish")',
    rawParams: [
      { name: "name", type: "string", required: true, description: "The aspiration/goal name" },
      { name: "areaName", type: "string", description: "Life area if mentioned (e.g. Career, Family, Health)" },
      { name: "portfolioName", type: "string", description: "Portfolio name if mentioned" },
    ],
  },
  {
    name: "delete_end",
    description:
      'User wants to delete or remove an end/aspiration (e.g. "delete the Learn Guitar end", "remove my fitness goal")',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end to delete" },
    ],
  },
  {
    name: "update_end",
    description:
      'User wants to add an end to a portfolio, move it, or change its properties. Triggered by "add X to Y", "put X in Y", "move X to Y", or renaming/recategorizing an end.',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end to update" },
      { name: "newName", type: "string", description: "New name if renaming" },
      { name: "areaName", type: "string", description: "New area name if changing area" },
      { name: "portfolioName", type: "string", description: "Portfolio name if adding to portfolio" },
    ],
  },
  {
    name: "create_habit",
    description:
      'User wants to create a recurring habit linked to an end (e.g. "add a habit of daily guitar practice for Learn Guitar")',
    rawParams: [
      { name: "name", type: "string", required: true, description: "Habit name" },
      { name: "endNames", type: "string[]", required: true, description: "End(s) this habit serves" },
      { name: "frequency", type: "string", description: "How often (daily, weekly, etc.)" },
      { name: "durationMinutes", type: "number", description: "Expected duration in minutes" },
      { name: "areaName", type: "string", description: "Area name (infer from topic: sleep→Health, work→Career)" },
      { name: "teamName", type: "string", description: "Team name if mentioned" },
      { name: "personNames", type: "string[]", description: 'People who participate in the habit. Use ["__self__"] for me/I/my/myself. Include multiple names for group habits.' },
    ],
  },
  {
    name: "create_organization",
    description:
      'User wants to create a new organization (e.g. "Create an organization called Newco", "New org: Acme Corp")',
    rawParams: [
      { name: "name", type: "string", required: true, description: "Organization name" },
    ],
  },
  {
    name: "create_team",
    description:
      'User wants to create a team in an organization (e.g. "Create an Engineering team in Newco")',
    rawParams: [
      { name: "name", type: "string", required: true, description: "Team name" },
      { name: "organizationName", type: "string", required: true, description: "Organization the team belongs to" },
    ],
  },
  {
    name: "create_portfolio",
    description:
      'User explicitly wants to CREATE a new portfolio (e.g. "create portfolio Q1 Goals for Acme"). Do NOT use for "add end to portfolio" — that is update_end.',
    rawParams: [
      { name: "name", type: "string", required: true, description: "Portfolio name" },
      { name: "ownerType", type: "string", required: true, description: '"organization", "team", or "person"' },
      { name: "ownerName", type: "string", required: true, description: 'Owner name. Use "__self__" for "my portfolio"' },
      { name: "portfolioType", type: "string", description: "goals, projects, quarterly, backlog, operations, or other" },
      { name: "description", type: "string", description: "Optional description" },
    ],
  },
  {
    name: "create_person",
    description:
      'User wants to add a new person (e.g. "Add my wife Jennifer, jennifer@example.com"). If person already exists, use update_person instead.',
    rawParams: [
      { name: "firstName", type: "string", required: true },
      { name: "lastName", type: "string", required: true },
      { name: "email", type: "string", required: true, description: 'Use "unknown@example.com" if not provided' },
      { name: "phone", type: "string" },
      { name: "title", type: "string" },
      { name: "notes", type: "string" },
      { name: "relationshipType", type: "string", description: "self, spouse, child, parent, sibling, in-law, friend, colleague, mentor, client, other. Map: wife/husband/partner→spouse, kid/son/daughter→child, mom/dad→parent, brother/sister→sibling, coworker→colleague, brother-in-law/sister-in-law/father-in-law/mother-in-law/any in-law→in-law" },
      { name: "teamNames", type: "string[]", description: "Team names to add person to" },
    ],
  },
  {
    name: "update_person",
    description:
      'User wants to update an existing person (e.g. "add John to the Engineering team", "Sarah is my sister", "change Alex\'s relationship to friend")',
    rawParams: [
      { name: "personName", type: "string", required: true, description: 'Person name. Use "__self__" for me/I/my/myself' },
      { name: "teamNamesToAdd", type: "string[]", description: "New team names to add (merges with existing)" },
      { name: "relationshipType", type: "string", description: "self, spouse, child, parent, sibling, in-law, friend, colleague, mentor, client, other. Map: wife/husband/partner→spouse, kid/son/daughter→child, mom/dad→parent, brother/sister→sibling, coworker→colleague, brother-in-law/sister-in-law/father-in-law/mother-in-law/any in-law→in-law" },
    ],
  },
  {
    name: "link_person",
    description:
      'User wants to link a person to their user account (e.g. "link Alex to his account", "connect Jennifer to her user", "link Alex to alex@example.com"). Uses the person\'s stored email or an optional override to find the matching user profile.',
    rawParams: [
      { name: "personName", type: "string", required: true, description: "Name of the person to link" },
      { name: "email", type: "string", description: "Only include if the user explicitly provides an email address. Do NOT default or guess." },
    ],
  },
  {
    name: "create_task",
    description:
      'User wants to add a one-off to-do (e.g. "add task call mom", "I need to get oil changed", "remind me to buy birthday gift for Alex"). PRESERVE the full description including reason/purpose.',
    rawParams: [
      { name: "name", type: "string", required: true, description: "Full task description including purpose/reason" },
      { name: "endName", type: "string", description: "Related end/aspiration if mentioned" },
      { name: "areaName", type: "string", description: "Area name. Infer: family member task→Family, health→Health, work→Career" },
      { name: "withPersonNames", type: "string[]", description: "People involved with the task" },
      { name: "forPersonNames", type: "string[]", description: "People the task is for" },
      { name: "dueDate", type: "string", description: '"today", "tomorrow", or YYYY-MM-DD' },
      { name: "notes", type: "string" },
    ],
  },
  {
    name: "update_task",
    description:
      'User wants to complete, update, or reopen a task (e.g. "I finished call mom", "mark task X done", "set due date on oil change to Friday", "add a note to call mom", "reopen the oil change task")',
    rawParams: [
      { name: "taskName", type: "string", required: true, description: "Name of the task to update" },
      { name: "completedDate", type: "string", description: '"today", "yesterday", or YYYY-MM-DD. Use today if user says "done" or "completed"' },
      { name: "reopen", type: "boolean", description: "Set to true when user wants to reopen/uncomplete a task" },
      { name: "dueDate", type: "string", description: '"today", "tomorrow", "next Monday", or YYYY-MM-DD' },
      { name: "durationMinutes", type: "number" },
      { name: "name", type: "string", description: "New name if renaming" },
      { name: "endName", type: "string" },
      { name: "areaName", type: "string" },
      { name: "withPersonNames", type: "string[]" },
      { name: "forPersonNames", type: "string[]" },
      { name: "notes", type: "string" },
    ],
  },
  {
    name: "log_task_time",
    description:
      'User wants to log time spent working on a task (e.g. "I worked on the proposal for 30 minutes", "spent 2 hours on API docs yesterday", "worked on fix auth bug with Alex for 45 minutes")',
    rawParams: [
      { name: "taskName", type: "string", required: true, description: "Name of the task" },
      { name: "completedDate", type: "string", description: '"today", "yesterday", or YYYY-MM-DD. Default to today.' },
      { name: "durationMinutes", type: "number", description: "Duration in minutes" },
      { name: "notes", type: "string", description: "Notes about what was done" },
      { name: "withPersonNames", type: "string[]", description: "People who worked on it with you" },
      { name: "forPersonNames", type: "string[]", description: "People the work was for" },
    ],
  },
  {
    name: "suggest_habits",
    description:
      'User asks for habit suggestions (e.g. "What habits would help me be a better father?", "Suggest habits for getting promoted")',
    rawParams: [
      { name: "query", type: "string", required: true, description: "The aspiration/goal they want habits for" },
      { name: "suggestions", type: "string[]", required: true, description: "Generate 3-5 concrete, actionable habit suggestions" },
    ],
  },
  {
    name: "get_end",
    description:
      'User wants details about a specific end/aspiration (e.g. "show me Mentor Alex", "details for Healthy Lifestyle", "tell me about my fitness goal")',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end to show details for" },
    ],
  },
  {
    name: "list_areas",
    description: 'User wants to see life areas (e.g. "show areas", "list areas", "what areas do I have")',
    rawParams: [],
  },
  {
    name: "list_ends",
    description: 'User wants to see ends/aspirations (e.g. "show my ends", "list aspirations", "ends in Career")',
    rawParams: [
      { name: "areaName", type: "string", description: "Filter by area name" },
      { name: "portfolioName", type: "string", description: "Filter by portfolio name" },
    ],
  },
  {
    name: "list_habits",
    description: 'User wants to see habits (e.g. "show my habits", "list habits", "habits for guitar end")',
    rawParams: [
      { name: "endName", type: "string", description: "Filter by end name" },
      { name: "areaName", type: "string", description: "Filter by area name" },
      { name: "teamName", type: "string", description: "Filter by team name" },
      { name: "personName", type: "string", description: 'Filter by person. Use "__self__" ONLY when user explicitly says "my habits". Omit otherwise.' },
    ],
  },
  {
    name: "get_habit",
    description:
      'User wants details about a specific habit (e.g. "show me the guitar practice habit", "details on meditation", "tell me about my reading habit")',
    rawParams: [
      { name: "habitName", type: "string", required: true, description: "Name of the habit" },
    ],
  },
  {
    name: "update_habit",
    description:
      'User wants to update a habit — add/remove participants, link/unlink/move ends, change frequency, rename, etc. (e.g. "add Alex to Weekly Check-in", "link gym to Stay Fit", "move gym to Health Goals", "unlink gym from Learn Guitar")',
    rawParams: [
      { name: "habitName", type: "string", required: true, description: "Name of the habit to update" },
      { name: "personNamesToAdd", type: "string[]", description: "People to add as participants" },
      { name: "personNamesToRemove", type: "string[]", description: "People to remove as participants" },
      { name: "endNameToAdd", type: "string", description: "End name to link (additive)" },
      { name: "endNameToRemove", type: "string", description: "End name to unlink" },
      { name: "endNameToMoveTo", type: "string", description: "End name to move to (replaces all current end links)" },
      { name: "newName", type: "string", description: "New name if renaming" },
      { name: "frequency", type: "string", description: "New frequency (daily, weekly, etc.)" },
      { name: "durationMinutes", type: "number", description: "New expected duration in minutes" },
    ],
  },
  {
    name: "delete_habit",
    description:
      'User wants to delete or remove a habit (e.g. "delete the guitar practice habit", "remove meditation habit")',
    rawParams: [
      { name: "habitName", type: "string", required: true, description: "Name of the habit to delete" },
    ],
  },
  {
    name: "list_shared_habits",
    description:
      'User wants to see habits shared with them by other users (e.g. "show shared habits", "habits shared with me", "what habits are others sharing")',
    rawParams: [
      { name: "endName", type: "string", description: "Filter by end name" },
    ],
  },
  {
    name: "list_organizations",
    description: 'User wants to see organizations (e.g. "show organizations", "list orgs")',
    rawParams: [
      { name: "expand", type: "boolean", description: "True if user wants teams and people details" },
    ],
  },
  {
    name: "list_portfolios",
    description: 'User wants to see portfolios (e.g. "list portfolios", "my portfolios", "portfolios for Acme")',
    rawParams: [
      { name: "ownerType", type: "string", description: '"organization", "team", or "person"' },
      { name: "ownerName", type: "string", description: 'Owner name. Use "__self__" for "my portfolios"' },
      { name: "portfolioType", type: "string", description: "goals, projects, quarterly, backlog, operations, other" },
    ],
  },
  {
    name: "get_portfolio",
    description:
      'User wants details about a specific portfolio including its ends (e.g. "show me the Sales portfolio", "details on Q1 Goals")',
    rawParams: [
      { name: "portfolioName", type: "string", required: true, description: "Name of the portfolio" },
    ],
  },
  {
    name: "update_portfolio",
    description:
      'User wants to update a portfolio\'s name, type, or description (e.g. "change Sales portfolio type to quarterly", "rename Q1 Goals to Q2 Goals")',
    rawParams: [
      { name: "portfolioName", type: "string", required: true, description: "Name of the portfolio to update" },
      { name: "newName", type: "string", description: "New name if renaming" },
      { name: "portfolioType", type: "string", description: "New type: goals, projects, quarterly, backlog, operations, other" },
      { name: "description", type: "string", description: "New description" },
    ],
  },
  {
    name: "delete_portfolio",
    description:
      'User wants to delete or remove a portfolio (e.g. "delete the Sales portfolio", "remove Q1 Goals portfolio")',
    rawParams: [
      { name: "portfolioName", type: "string", required: true, description: "Name of the portfolio to delete" },
    ],
  },
  {
    name: "delete_task",
    description:
      'User wants to delete or remove a task (e.g. "delete the call mom task", "remove the oil change task")',
    rawParams: [
      { name: "taskName", type: "string", required: true, description: "Name of the task to delete" },
    ],
  },
  {
    name: "delete_person",
    description:
      'User wants to delete or remove a person (e.g. "delete John Smith", "remove Sarah from people")',
    rawParams: [
      { name: "personName", type: "string", required: true, description: "Name of the person to delete" },
    ],
  },
  {
    name: "delete_organization",
    description:
      'User wants to delete or remove an organization (e.g. "delete Acme Corp", "remove the old org")',
    rawParams: [
      { name: "organizationName", type: "string", required: true, description: "Name of the organization to delete" },
    ],
  },
  {
    name: "update_team",
    description:
      'User wants to rename a team (e.g. "rename DLI Operations to Operations", "update Engineering team name to Platform")',
    rawParams: [
      { name: "teamName", type: "string", required: true, description: "Current name of the team" },
      { name: "newName", type: "string", required: true, description: "New name for the team" },
    ],
  },
  {
    name: "delete_team",
    description:
      'User wants to delete or remove a team (e.g. "delete the Engineering team", "remove Leadership team")',
    rawParams: [
      { name: "teamName", type: "string", required: true, description: "Name of the team to delete" },
    ],
  },
  {
    name: "list_teams",
    description:
      'User wants to see teams. For "my teams" or "what teams is [person] in?" use personName. For "teams in [org]" use organizationName.',
    rawParams: [
      { name: "organizationName", type: "string", description: "ONLY use when user asks for teams in an organization. A person's name is NOT an organization." },
      { name: "personName", type: "string", description: 'The person whose teams to list. Use "__self__" for my teams. Use for "teams for Jennifer", "what teams is Alex in?", etc.' },
    ],
  },
  {
    name: "list_people",
    description:
      'User wants to see people (e.g. "show people", "people in Engineering", "my colleagues"). Do NOT use for "what teams is X in?" — use list_teams with personName.',
    rawParams: [
      { name: "organizationName", type: "string" },
      { name: "teamName", type: "string" },
      { name: "relationshipType", type: "string", description: "self, spouse, child, parent, sibling, friend, colleague, mentor, client, other" },
    ],
  },
  {
    name: "list_actions",
    description: 'User wants to see tracked actions (e.g. "what did I do today", "actions this week", "actions for Be a Great Father")',
    rawParams: [
      { name: "endName", type: "string", description: "Filter by end/aspiration name — shows actions across all habits linked to that end" },
      { name: "habitName", type: "string", description: "Filter by habit name" },
      { name: "period", type: "string", description: "today, yesterday, this_week, last_week, this_month, last_month, past_7_days, past_30_days, or a specific date like 'April 1st', '2026-04-01', 'March 30'. For a specific date, put the date here — do NOT use fromDate/toDate." },
      { name: "fromDate", type: "string", description: "YYYY-MM-DD start date ONLY for explicit custom ranges like 'from March 1 to March 15'" },
      { name: "toDate", type: "string", description: "YYYY-MM-DD end date ONLY for explicit custom ranges" },
      { name: "withPersonNames", type: "string[]", description: 'Filter to actions done WITH these people (e.g. "with Jennifer")' },
      { name: "forPersonNames", type: "string[]", description: 'Filter to actions done FOR these people (e.g. "for Alex")' },
    ],
  },
  {
    name: "list_tasks",
    description: 'User wants to see tasks (e.g. "show my tasks", "open tasks", "completed tasks", "tasks due this week", "what\'s due tomorrow")',
    rawParams: [
      { name: "endName", type: "string" },
      { name: "areaName", type: "string" },
      { name: "completed", type: "boolean", description: "true=completed only, false=open only" },
      { name: "duePeriod", type: "string", description: "today, tomorrow, this_week, this_month, overdue" },
    ],
  },
  {
    name: "get_task",
    description:
      'User wants details about a specific task (e.g. "show me the call mom task", "details on oil change task")',
    rawParams: [
      { name: "taskName", type: "string", required: true, description: "Name of the task" },
    ],
  },
  {
    name: "list_ends_and_habits",
    description: 'User wants ends AND habits together (e.g. "show my ends and habits", "ends and habits by area")',
    rawParams: [
      { name: "areaName", type: "string" },
      { name: "portfolioName", type: "string" },
    ],
  },
  {
    name: "get_team",
    description:
      'User wants details about a specific team including its members (e.g. "show me the Engineering team", "who is on the Family team", "members of Leadership").',
    rawParams: [
      { name: "teamName", type: "string", required: true, description: "Name of the team" },
    ],
  },
  {
    name: "get_person",
    description:
      'User wants details for a specific person (e.g. "show me John", "who is Sarah?", "who am I?"). For "what teams is X in?" use list_teams instead.',
    rawParams: [
      { name: "personName", type: "string", required: true, description: 'Person name. Use "__self__" for me/my details' },
    ],
  },
  {
    name: "share_end",
    description: 'User wants to share an end with another user (e.g. "share fitness goal with Jennifer", "share fitness goal with my wife")',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end to share" },
      { name: "personName", type: "string", required: true, description: "Name or relationship of person to share with (e.g. 'Jennifer', 'my wife', 'Alex')" },
    ],
  },
  {
    name: "unshare_end",
    description: 'User wants to stop sharing an end (e.g. "stop sharing fitness goal with Jennifer", "unshare fitness goal with my wife")',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end to unshare" },
      { name: "personName", type: "string", required: true, description: "Name or relationship of person to unshare from" },
    ],
  },
  {
    name: "list_shared_ends",
    description: 'User wants to see ends shared with them (e.g. "show shared ends")',
    rawParams: [],
  },
  {
    name: "create_belief",
    description:
      'User wants to define a core belief or value (e.g. "I believe family comes first", "my core belief is health is the foundation for everything")',
    rawParams: [
      { name: "name", type: "string", required: true, description: "The belief statement" },
      { name: "description", type: "string", description: "Additional context about the belief" },
    ],
  },
  {
    name: "list_beliefs",
    description: 'User wants to see their core beliefs (e.g. "show my beliefs", "list beliefs", "what are my core values")',
    rawParams: [],
  },
  {
    name: "get_belief",
    description:
      'User wants details about a specific belief including linked ends (e.g. "show me the family comes first belief")',
    rawParams: [
      { name: "beliefName", type: "string", required: true, description: "Name of the belief" },
    ],
  },
  {
    name: "update_belief",
    description:
      'User wants to update a belief\'s name or description (e.g. "rename my health belief to wellness is non-negotiable")',
    rawParams: [
      { name: "beliefName", type: "string", required: true, description: "Current name of the belief" },
      { name: "newName", type: "string", description: "New name if renaming" },
      { name: "description", type: "string", description: "New description" },
    ],
  },
  {
    name: "delete_belief",
    description:
      'User wants to delete a core belief (e.g. "delete the health belief", "remove my old belief")',
    rawParams: [
      { name: "beliefName", type: "string", required: true, description: "Name of the belief to delete" },
    ],
  },
  {
    name: "suggest_belief_links",
    description:
      'User wants the system to suggest which ends align with a belief (e.g. "suggest links for family comes first", "what ends match my health belief")',
    rawParams: [
      { name: "beliefName", type: "string", required: true, description: "Name of the belief to find matching ends for" },
    ],
  },
  {
    name: "link_end_to_belief",
    description:
      'User wants to connect an end to a belief (e.g. "link Be a Great Father to family comes first", "connect fitness goal to health belief")',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end" },
      { name: "beliefName", type: "string", required: true, description: "Name of the belief" },
    ],
  },
  {
    name: "unlink_end_from_belief",
    description:
      'User wants to disconnect an end from a belief (e.g. "unlink fitness goal from health belief")',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end" },
      { name: "beliefName", type: "string", required: true, description: "Name of the belief" },
    ],
  },
  {
    name: "reflect",
    description:
      'User wants to review how they\'re doing — what they committed to vs. what they did (e.g. "reflect on this week", "how am I doing?", "reflect on Family", "weekly review", "reflect on Be a Great Father", "how is the Sales portfolio doing?", "reflect on Operations portfolio")',
    rawParams: [
      { name: "period", type: "string", description: "this_week, last_week, this_month, last_month, past_7_days, past_30_days, today, yesterday, or a specific date like 'April 1st', '2026-04-01'. Default to this_week. A specific date goes here, NOT in scope. Map: 'this past week'/'past week'→last_week, 'last 7 days'→past_7_days, 'last 30 days'→past_30_days" },
      { name: "areaName", type: "string", description: "Optional area to focus on (use when user explicitly says area)" },
      { name: "endName", type: "string", description: "Optional specific end to reflect on (use when user explicitly says end)" },
      { name: "portfolioName", type: "string", description: "Optional portfolio to focus on (use when user explicitly says portfolio)" },
      { name: "scope", type: "string", description: "When the user says 'reflect on X' without specifying area/end/portfolio, put X here and the system will determine the type" },
    ],
  },
  {
    name: "ask",
    description:
      'User wants to have a conversation or ask an open-ended question about their data that requires reasoning (e.g. "what should I focus on this week?", "help me think about my beliefs", "why am I behind on fitness?", "tell me about my patterns"). Use this for questions that go beyond simple listing or CRUD.',
    rawParams: [
      { name: "question", type: "string", required: true, description: "The user's question or message, passed through unchanged" },
    ],
  },
  {
    name: "help",
    description:
      'User wants to understand a concept or how the system works (e.g. "what is an end?", "how do portfolios work?", "explain sharing", "help")',
    rawParams: [
      { name: "topic", type: "string", description: "The concept to explain: areas, ends, habits, actions, tasks, portfolios, organizations, teams, persons, sharing, or overview" },
    ],
  },
  {
    name: "unknown",
    description: "Intent is unclear or not supported",
    rawParams: [],
  },
];
