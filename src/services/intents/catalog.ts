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
      { name: "collectionName", type: "string", description: "Collection name if mentioned" },
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
      'User wants to add an end to a collection, move it, or change its properties. Triggered by "add X to Y", "put X in Y", "move X to Y", or renaming/recategorizing an end.',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end to update" },
      { name: "newName", type: "string", description: "New name if renaming" },
      { name: "areaName", type: "string", description: "New area name if changing area" },
      { name: "collectionName", type: "string", description: "Collection name if adding to collection" },
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
    name: "create_collection",
    description:
      'User explicitly wants to CREATE a new collection (e.g. "create collection Q1 Goals for Acme"). Do NOT use for "add end to collection" — that is update_end.',
    rawParams: [
      { name: "name", type: "string", required: true, description: "Collection name" },
      { name: "ownerType", type: "string", required: true, description: '"organization", "team", or "person"' },
      { name: "ownerName", type: "string", required: true, description: 'Owner name. Use "__self__" for "my collection"' },
      { name: "collectionType", type: "string", description: "goals, projects, quarterly, backlog, operations, or other" },
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
      { name: "relationshipType", type: "string", description: "self, spouse, child, parent, sibling, friend, colleague, mentor, client, other. Map: wife/husband/partner→spouse, kid/son/daughter→child, mom/dad→parent, brother/sister→sibling, coworker→colleague" },
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
      { name: "relationshipType", type: "string", description: "self, spouse, child, parent, sibling, friend, colleague, mentor, client, other. Map: wife/husband/partner→spouse, kid/son/daughter→child, mom/dad→parent, brother/sister→sibling, coworker→colleague" },
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
      'User wants to complete or update a task (e.g. "I finished call mom", "mark task X done")',
    rawParams: [
      { name: "taskName", type: "string", required: true, description: "Name of the task to update" },
      { name: "completedDate", type: "string", description: '"today", "yesterday", or YYYY-MM-DD. Use today if user says "done" or "completed"' },
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
      { name: "collectionName", type: "string", description: "Filter by collection name" },
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
    name: "list_collections",
    description: 'User wants to see collections (e.g. "list collections", "my collections", "collections for Acme")',
    rawParams: [
      { name: "ownerType", type: "string", description: '"organization", "team", or "person"' },
      { name: "ownerName", type: "string", description: 'Owner name. Use "__self__" for "my collections"' },
      { name: "collectionType", type: "string", description: "goals, projects, quarterly, backlog, operations, other" },
    ],
  },
  {
    name: "get_collection",
    description:
      'User wants details about a specific collection including its ends (e.g. "show me the Sales collection", "details on Q1 Goals")',
    rawParams: [
      { name: "collectionName", type: "string", required: true, description: "Name of the collection" },
    ],
  },
  {
    name: "update_collection",
    description:
      'User wants to update a collection\'s name, type, or description (e.g. "change Sales collection type to quarterly", "rename Q1 Goals to Q2 Goals")',
    rawParams: [
      { name: "collectionName", type: "string", required: true, description: "Name of the collection to update" },
      { name: "newName", type: "string", description: "New name if renaming" },
      { name: "collectionType", type: "string", description: "New type: goals, projects, quarterly, backlog, operations, other" },
      { name: "description", type: "string", description: "New description" },
    ],
  },
  {
    name: "delete_collection",
    description:
      'User wants to delete or remove a collection (e.g. "delete the Sales collection", "remove Q1 Goals collection")',
    rawParams: [
      { name: "collectionName", type: "string", required: true, description: "Name of the collection to delete" },
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
    description: 'User wants to see tracked actions (e.g. "what did I do today", "actions this week")',
    rawParams: [
      { name: "habitName", type: "string", description: "Filter by habit name" },
      { name: "period", type: "string", description: "today, yesterday, this_week, this_month" },
      { name: "fromDate", type: "string", description: "YYYY-MM-DD start date for custom range" },
      { name: "toDate", type: "string", description: "YYYY-MM-DD end date for custom range" },
      { name: "withPersonNames", type: "string[]", description: 'Filter to actions done WITH these people (e.g. "with Jennifer")' },
      { name: "forPersonNames", type: "string[]", description: 'Filter to actions done FOR these people (e.g. "for Alex")' },
    ],
  },
  {
    name: "list_tasks",
    description: 'User wants to see tasks (e.g. "show my tasks", "open tasks", "completed tasks")',
    rawParams: [
      { name: "endName", type: "string" },
      { name: "areaName", type: "string" },
      { name: "completed", type: "boolean", description: "true=completed only, false=open only" },
    ],
  },
  {
    name: "list_ends_and_habits",
    description: 'User wants ends AND habits together (e.g. "show my ends and habits", "ends and habits by area")',
    rawParams: [
      { name: "areaName", type: "string" },
      { name: "collectionName", type: "string" },
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
      'User wants details for a specific person (e.g. "show me John", "who is Sarah?"). For "what teams is X in?" use list_teams instead.',
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
    name: "help",
    description:
      'User wants to understand a concept or how the system works (e.g. "what is an end?", "how do collections work?", "explain sharing", "help")',
    rawParams: [
      { name: "topic", type: "string", description: "The concept to explain: areas, ends, habits, actions, tasks, collections, organizations, teams, persons, sharing, or overview" },
    ],
  },
  {
    name: "unknown",
    description: "Intent is unclear or not supported",
    rawParams: [],
  },
];
