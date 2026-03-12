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
      { name: "personName", type: "string", description: 'Person who performs the habit (the doer). Use "__self__" for me/I/my/myself' },
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
      'User wants to update an existing person, typically adding them to a team (e.g. "add John to the Engineering team")',
    rawParams: [
      { name: "personName", type: "string", required: true, description: 'Person name. Use "__self__" for me/I/my/myself' },
      { name: "teamNamesToAdd", type: "string[]", description: "New team names to add (merges with existing)" },
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
      { name: "personName", type: "string", description: 'Filter by person. Use "__self__" for my habits' },
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
    name: "list_teams",
    description:
      'User wants to see teams. For "my teams" or "what teams is [person] in?" use personName. For "teams in [org]" use organizationName.',
    rawParams: [
      { name: "organizationName", type: "string", description: "Filter by org (only for listing org's teams)" },
      { name: "personName", type: "string", description: 'Filter by person membership. Use "__self__" for my teams' },
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
    name: "get_person",
    description:
      'User wants details for a specific person (e.g. "show me John", "who is Sarah?"). For "what teams is X in?" use list_teams instead.',
    rawParams: [
      { name: "personName", type: "string", required: true, description: 'Person name. Use "__self__" for me/my details' },
    ],
  },
  {
    name: "share_end",
    description: 'User wants to share an end with another user (e.g. "share fitness goal with john@example.com")',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end to share" },
      { name: "email", type: "string", required: true, description: "Email of user to share with" },
    ],
  },
  {
    name: "unshare_end",
    description: 'User wants to stop sharing an end (e.g. "stop sharing fitness goal with john@example.com")',
    rawParams: [
      { name: "endName", type: "string", required: true, description: "Name of the end to unshare" },
      { name: "email", type: "string", required: true, description: "Email of user to unshare from" },
    ],
  },
  {
    name: "list_shared_ends",
    description: 'User wants to see ends shared with them (e.g. "show shared ends")',
    rawParams: [],
  },
  {
    name: "unknown",
    description: "Intent is unclear or not supported",
    rawParams: [],
  },
];
