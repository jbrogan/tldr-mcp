/**
 * Help System — static explanations of system concepts.
 *
 * Isolated from core intent logic. The executor calls getHelpText()
 * and returns the result as-is.
 */

const topics: Record<string, string> = {
  overview: `The Wheel of Life system helps you track what matters across all areas of your life.

Here's how the pieces fit together:
  - Beliefs: Core values that motivate everything (e.g. "Family comes first")
  - Areas: 10 life domains (Career, Family, Health, etc.)
  - Ends: Ongoing aspirations within an area (e.g. "Be a great father")
  - Habits: Recurring behaviors that serve your ends (e.g. "Family dinner weekly")
  - Actions: Logged completions of habits (your track record)
  - Tasks: One-off to-dos, optionally linked to an end
  - Portfolios: Group ends by owner (org, team, or person) for a structural view
  - Organizations & Teams: People hierarchy for collaborative tracking
  - Sharing: Share ends with other users for joint accountability

Two ways to slice your data:
  - By Area: "How am I doing in Family?" (life domain lens)
  - By Organization: "How is the business doing?" (structural lens)
  Portfolios bridge these two views.`,

  beliefs: `Beliefs are your core values and convictions — the foundational principles that explain why your ends matter.

Examples: "Family comes first", "Health is the foundation for everything", "Financial independence enables freedom"

Key properties:
  - Beliefs sit above ends in the hierarchy: beliefs → ends → habits → actions
  - A belief can motivate multiple ends across different areas
  - An end can serve multiple beliefs
  - Beliefs provide the "why" for reflection — connecting daily actions to deeper purpose
  - Use "link [end] to [belief]" to connect them`,

  areas: `Areas are the 10 Wheel of Life categories that represent the broad domains of your life:
  Career, Family, Health, Finance, Social, Romance, Personal Growth, Fun & Recreation, Physical Environment, Contribution.

Every end belongs to an area. Areas help you see balance — are you investing in all parts of your life, or over-indexing on one?

Areas are auto-seeded when you sign up. You can't create or delete them.`,

  ends: `Ends are ongoing aspirations or goals — things you want to be or become. They're called "ends" because they represent the purpose behind your habits.

Examples: "Be a great father", "Stay physically fit", "Grow the client base"

Key properties:
  - Each end belongs to an Area (life domain)
  - Each end can belong to a Portfolio (organizational grouping)
  - Habits attach to ends — they're the "how" for your "why"
  - Ends can be shared with other users for joint accountability
  - Ends are ongoing — you don't complete them, you pursue them`,

  habits: `Habits are recurring behaviors that serve your ends. They're the concrete actions you commit to doing regularly.

Examples: "Exercise 30 minutes daily", "Weekly family dinner", "Prospect 5 leads per week"

Key properties:
  - Each habit links to one or more ends (the aspirations it serves)
  - Habits can have a frequency (daily, weekly, etc.) and expected duration
  - Habits can be assigned to a team and/or specific participants
  - When you log a completion, that creates an Action
  - A single habit can serve multiple ends`,

  actions: `Actions are logged completions of habits — your actual track record.

When you say "I went to the gym for 45 minutes" or "we had family dinner", that creates an action linked to the relevant habit.

Key properties:
  - Each action belongs to a habit
  - Actions have a completion date and optional duration
  - Actions can include "with" people (who participated) and "for" people (who it was for)
  - On shared ends, actions are visible to everyone sharing that end`,

  tasks: `Tasks are one-off to-dos — things you need to do once, not recurring behaviors.

Examples: "Call mom about Thanksgiving", "Get oil changed", "Buy birthday gift for Alex"

Key properties:
  - Tasks can optionally link to an end (the aspiration they support)
  - Tasks can have a due date
  - Tasks can involve people (with/for)
  - Tasks are owned by you, but when linked to a shared end they are visible to everyone the end is shared with — this helps confirm commitments between users`,

  portfolios: `Portfolios group ends under an owner (organization, team, or person). They provide a structural view of your aspirations.

Examples: "Sales" (org-owned), "Q1 Goals" (person-owned), "Kids Activities" (team-owned)

Portfolios bridge the gap between Areas and Organizations:
  - Area view: End → Area → "How am I doing in Family?"
  - Org view: End → Portfolio → Organization → "How is the business doing?"

Key properties:
  - Owner can be an organization, team, or person
  - Portfolio type: goals, projects, quarterly, backlog, operations, or other
  - An end belongs to one portfolio (optional) and one area (required)`,

  organizations: `Organizations represent the top-level groups in your life — businesses, families, clubs, etc.

Examples: "Brogan Family", "Acme Corp", "Local Church"

Organizations contain teams, which contain people. This hierarchy lets you:
  - Assign habits to teams
  - Own portfolios at the org level
  - Roll up reporting by organizational structure

Organizations are broader than just "work" — any group of people you interact with regularly can be an organization.`,

  teams: `Teams are sub-groups within an organization. They organize people by function, relationship, or role.

Examples: "Engineering" (in Acme Corp), "Kids" (in Brogan Family), "Leadership" (in your business)

Key properties:
  - Every team belongs to an organization
  - People can be on multiple teams
  - Habits can be assigned to a team
  - Portfolios can be owned by a team`,

  persons: `Persons represent the people in your life. Each person has a name, email, relationship type, and optional team memberships.

Relationship types: self, spouse, child, parent, sibling, friend, colleague, mentor, client, other.

Key properties:
  - Persons can be on one or more teams
  - Persons can be linked to a user account (for sharing)
  - Habits can have person participants
  - Actions can track "with" and "for" people
  - Your own person record (relationship: self) represents you in the system`,

  sharing: `Sharing lets you collaborate on ends with other users.

WHAT GETS SHARED
Sharing happens at the end level. When you share an end, the other user can see:
  - The end itself, its beliefs and portfolio context
  - All habits linked to that end (yours and theirs)
  - All actions logged against those habits
  - All tasks linked to that end, with owner attribution

Habits, tasks, actions, and portfolios are NOT shared directly — they flow through the shared end.

HOW TO SHARE
  1. The other person must have a person record in your system with their email
  2. They must have signed up for an account (their email matches a profile)
  3. The person record must be linked — happens automatically if their email matches at creation, or manually via "link [person] to their account"
  4. Share with: "share [end name] with [person name]"
  5. Unshare with: "unshare [end name] with [person name]"

SHARING SEMANTICS
Two distinct concepts:
  - Sharing (end level): visibility and accountability
  - Participant (habit level): active doer who can log actions

Sharing an end does NOT automatically make the shared user a participant on its habits.

WHAT SHARED USERS CAN DO
  - View the end, its habits, actions, and tasks
  - Create their OWN habits linked to the shared end (shared write access)
  - Create their own tasks linked to the shared end
  - Log actions on habits where they've been explicitly added as participants (via "add [person] to [habit]")
  - Log task time on their own tasks

WHAT SHARED USERS CANNOT DO
  - Edit the owner's habits or the end itself
  - Delete anything that isn't theirs
  - Log actions on habits they're not a participant on

CONTEXTUAL DISPLAY
  - The owner sees "Shared with: [names]" on an end
  - The recipient sees "Shared by: [owner name]"
  - Shared habits show "by [owner]" when you're not the owner
  - Shared tasks show "by [owner]" when you're not the owner
  - Action lists show "by [owner]" on actions logged by other users

LIST VIEWS
  - "list my shares" — ends you've shared with others
  - "list shared ends" — ends others have shared with you
  - "list shared habits" — habits visible through ends shared with you`,
};

const TOPIC_ALIASES: Record<string, string> = {
  area: "areas",
  belief: "beliefs",
  value: "beliefs",
  values: "beliefs",
  "core belief": "beliefs",
  "core beliefs": "beliefs",
  "core value": "beliefs",
  "core values": "beliefs",
  end: "ends",
  aspiration: "ends",
  aspirations: "ends",
  goal: "ends",
  goals: "ends",
  habit: "habits",
  action: "actions",
  task: "tasks",
  "to-do": "tasks",
  todos: "tasks",
  portfolio: "portfolios",
  collection: "portfolios",
  collections: "portfolios",
  organization: "organizations",
  org: "organizations",
  orgs: "organizations",
  team: "teams",
  person: "persons",
  people: "persons",
  share: "sharing",
  shared: "sharing",
  help: "overview",
  "how does it work": "overview",
  "getting started": "overview",
};

export function getHelpText(topic: string | undefined): string {
  if (!topic) return topics.overview;

  const normalized = topic.toLowerCase().trim();
  const resolved = TOPIC_ALIASES[normalized] ?? normalized;
  const text = topics[resolved];

  if (text) return text;

  const available = Object.keys(topics).join(", ");
  return `Unknown topic: "${topic}". Available topics: ${available}`;
}
