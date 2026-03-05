import { createLLMProvider } from "../llm/index.js";
import { listHabits, createHabit, getHabitById } from "../store/habits.js";
import { listEnds, createEnd, getEndById, updateEnd } from "../store/ends.js";
import { listAreas, getAreaById } from "../store/areas.js";
import { listOrganizations } from "../store/organizations.js";
import { listTeams, createTeam, getTeamById } from "../store/teams.js";
import { listCollections, createCollection } from "../store/collections.js";
import { createAction, listActions } from "../store/actions.js";
import type { RelationshipType } from "../schemas/person.js";
import { createPerson, listPersons, updatePerson, getPersonById, getSelfPerson } from "../store/persons.js";

const SELF_PLACEHOLDER = "__self__";

const INTENT_SCHEMA = `Respond with ONLY valid JSON, no other text. Use this schema:
{
  "intent": "create_action" | "create_end" | "create_habit" | "create_team" | "create_collection" | "create_person" | "update_person" | "update_end" | "suggest_habits" | "list_areas" | "list_ends" | "list_habits" | "list_organizations" | "list_teams" | "list_collections" | "list_people" | "list_actions" | "list_ends_and_habits" | "get_person" | "unknown",
  "params": { ... }
}

ROUTING PRIORITY:
- "Add [end] to [collection]" or "Put [end] in [collection]" or "Move [end] to [collection]" -> ALWAYS use intent "update_end" with id = end id from Ends list (match by name), collectionId = collection id from Collections list (match by name). Do NOT use create_collection or create_end.
- If the user asks about teams for a specific person (e.g. "what teams is [NAME] in?", "what teams is [NAME] a member of?", "list the teams for [NAME]", "teams for [NAME]", "which teams does [NAME] belong to?") -> ALWAYS use intent "list_teams" with personId = that person's id from Persons list. You MUST include personId (match by name). Do NOT use organizationId. Do NOT use get_person or list_people. Use __self__ ONLY when the user says me/I/my/myself - never when a different person's name is given.

For create_action: { "habitId": "<id>", "completedAt": "YYYY-MM-DD", "actualDurationMinutes": number (optional), "notes": string (optional) }
- Match the user's habit reference (e.g. "gym", "guitar") to the closest habit by name. Use the habit's id.
- "today" = ${new Date().toISOString().slice(0, 10)}, "yesterday" = previous day
- Extract duration in minutes if mentioned (e.g. "60 minutes" -> 60)

For create_end: { "name": string, "areaId": string (optional), "collectionId": string (optional) }
- Extract the aspiration/goal from the user's text
- Match area if mentioned (e.g. "family" -> Family area id)
- Match collection by name from Collections list if mentioned

For update_end: { "id": "<end-id>", "name": string (optional), "areaId": string (optional), "collectionId": string (optional) }
- Use when user says "add [end] to [collection]", "put [end] in [collection]", "move [end] to [collection]", or wants to change an end's area/name
- id = end id from Ends list (match the end name the user said, e.g. "DLI Monthly P&L")
- collectionId = collection id from Collections list (match the collection name, e.g. "Droplight Financial")

For create_habit: { "name": string, "endIds": ["<id>"], "frequency": string (optional), "durationMinutes": number (optional), "areaId": string (optional), "teamId": string (optional), "personId": string (optional) }
- Extract habit name and which end(s) it serves
- If the end has an areaId in context, include it. Or infer area from the habit topic (e.g. sleep -> Health, work -> Career)
- Match team by name from Teams list if mentioned (e.g. "for Engineering" -> teamId)
- personId = the person expected to PERFORM the habit (the doer), NOT the focus/recipient. Match by name from Persons list (e.g. "John's habit", "assigned to Sarah" -> personId). When user says me, I, my, or myself -> use personId: "__self__"
- If both team and person are mentioned, include both teamId and personId

For create_team: { "name": string, "organizationId": "<id>" }
- Extract team name and match organization by name (use org id from context)
- e.g. "Create an Engineering team in Newco" -> name: Engineering, organizationId: Newco's id

For create_person: { "firstName": string, "lastName": string, "email": string, "phone": string (optional), "title": string (optional), "notes": string (optional), "relationshipType": "self"|"spouse"|"child"|"parent"|"sibling"|"friend"|"colleague"|"mentor"|"client"|"other" (optional), "teamIds": ["<id>"] (optional) }
- IMPORTANT: Check the Persons list first. If the person already exists (match by name or email), use update_person instead.
- Extract name and split into firstName and lastName (use last word as lastName, rest as firstName if full name given)
- Map relationship words to relationshipType: wife/husband/partner -> spouse, kid/son/daughter -> child, mom/dad/parent -> parent, brother/sister -> sibling, coworker -> colleague
- Match team by name if mentioned (use id from context). Person membership is through teams only.
- Email is required - use "unknown@example.com" only if truly not provided

For update_person: { "id": "<id>", "teamIdsToAdd": ["<id>", ...] (optional) }
- Use when the person ALREADY EXISTS in Persons list and you need to add them to a team.
- Match person by name from Persons list and use their id. When user says me, I, my, or myself -> use id: "__self__"
- Use teamIdsToAdd with the NEW team id(s) to add. This merges with existing teams; do not pass existing teams.

For suggest_habits: { "query": string, "suggestions": ["habit 1", "habit 2", ...] }
- Use when user asks for habit suggestions (e.g. "What habits would help me be a better father?", "Suggest habits for getting promoted")
- Extract the aspiration/goal from their message as query
- Generate 3-5 concrete, actionable habit suggestions

For list_areas: {}
- Use when user wants to see areas (e.g. "show areas", "list areas", "what areas do I have")

For create_collection: { "name": string, "ownerType": "organization"|"team"|"person", "ownerId": "<id>", "collectionType": "goals"|"projects"|"quarterly"|"backlog"|"operations"|"other" (optional), "description": string (optional) }
- Use ONLY when user explicitly wants to CREATE a new collection (e.g. "create collection X", "make a new collection called Y"). Do NOT use for "add [end] to [collection]" - that is update_end.
- ownerType + ownerId = which org, team, or person owns the collection
- Match org, team, or person by name from context. For "my collection" use ownerType: "person", ownerId: "__self__"

For list_ends: { "areaId": "<id>" (optional), "collectionId": "<id>" (optional) }
- Use when user wants to see ends/aspirations (e.g. "show my ends", "list aspirations", "what ends do I have")
- Match area by name if mentioned (e.g. "ends in Career" -> areaId)
- Match collection by name if mentioned (e.g. "ends in Q1 Goals" -> collectionId)

For list_habits: { "endId": "<id>" (optional), "areaId": "<id>" (optional), "teamId": "<id>" (optional), "personId": "<id>" (optional) }
- Use when user wants to see habits (e.g. "show my habits", "list habits", "habits for guitar end")
- Match end, area, team, or person by name from context if mentioned. When user says my habits -> use personId: "__self__"

For list_organizations: { "expand": boolean (optional) }
- Use when user wants to see organizations (e.g. "show organizations", "list orgs", "organizations with teams")
- Set expand: true if user wants to see teams and people under each org

For list_collections: { "ownerType": "organization"|"team"|"person" (optional), "ownerId": "<id>" (optional), "collectionType": "goals"|"projects"|"quarterly"|"backlog"|"operations"|"other" (optional) }
- Use when user wants to see collections (e.g. "list collections", "collections for Acme", "my collections")
- For "collections for [org]" use ownerType: "organization", ownerId: org id
- For "collections for [team]" use ownerType: "team", ownerId: team id
- For "my collections" use ownerType: "person", ownerId: "__self__"

For list_teams: { "organizationId": "<id>" (optional), "personId": "<id>" or "__self__" (optional) }
- Use when user wants to see teams (e.g. "show teams", "list teams", "teams in Acme")
- For "my teams", "teams I'm in", "teams I'm a member of" -> use personId: "__self__" only. Do NOT use organizationId.
- For "what teams is [person] in?", "what teams is [person] a member of?", "list the teams for [person]", "teams for [person]" -> use personId = that person's id (match by name from Persons list). REQUIRED: include personId. Do NOT use organizationId.
- Match organization by name only when user asks for "teams in [org]" or "teams in Acme" (listing org's teams, not a person's teams)

For list_people: { "organizationId": "<id>" (optional), "teamId": "<id>" (optional), "relationshipType": "self"|"spouse"|"child"|"parent"|"sibling"|"friend"|"colleague"|"mentor"|"client"|"other" (optional) }
- Use when user wants to see people (e.g. "show people", "list people", "people in Engineering", "my colleagues")
- Do NOT use for "what teams is X in?" - use list_teams with personId instead.
- Match org or team by name. Map relationship words to relationshipType.

For list_actions: { "habitId": "<id>" (optional), "fromDate": "YYYY-MM-DD" (optional), "toDate": "YYYY-MM-DD" (optional) }
- Use when user wants to see tracked actions/completions (e.g. "show my actions", "what did I do", "gym completions this month")
- Match habit by name. "this month" = first and last day of current month. "this week" = Mon-Sun of current week.

For list_ends_and_habits: { "areaId": "<id>" (optional) }
- Use when user wants ends and habits grouped by area (e.g. "show my ends and habits", "ends and habits by area")
- Match area by name if mentioned

For get_person: { "personId": "<id>" }
- Use when user wants details for a specific person (e.g. "show me John", "get John Doe's details", "who is Sarah?", "show me" / "my details")
- Do NOT use for "what teams is X in?" or "what teams is X a member of?" - use list_teams with personId instead (returns teams only).
- Match person by name from Persons list and use their id. When user says show me, my details, who am I -> use personId: "__self__"

- Use "unknown" if the intent is unclear`;

export interface NLResult {
  success: boolean;
  message: string;
}

/** Match "add X to Y collection", "put X in Y collection", "move X to Y collection" */
function parseAddEndToCollection(text: string): { endName: string; collectionName: string } | null {
  const trimmed = text.trim().replace(/[.!?]+$/, "");
  const addMatch = trimmed.match(/^add\s+(.+?)\s+to\s+(?:the\s+)?(.+?)\s+collection\s*$/i);
  if (addMatch) return { endName: addMatch[1].trim(), collectionName: addMatch[2].trim() };
  const putMatch = trimmed.match(/^put\s+(.+?)\s+in\s+(?:the\s+)?(.+?)\s+collection\s*$/i);
  if (putMatch) return { endName: putMatch[1].trim(), collectionName: putMatch[2].trim() };
  const moveMatch = trimmed.match(/^move\s+(.+?)\s+to\s+(?:the\s+)?(.+?)\s+collection\s*$/i);
  if (moveMatch) return { endName: moveMatch[1].trim(), collectionName: moveMatch[2].trim() };
  return null;
}

function findBestMatch<T>(items: T[], name: string, getName: (t: T) => string): T | undefined {
  const lower = name.toLowerCase();
  const exact = items.find((i) => getName(i).toLowerCase() === lower);
  if (exact) return exact;
  return items.find((i) => getName(i).toLowerCase().includes(lower) || lower.includes(getName(i).toLowerCase()));
}

export async function interpretAndExecute(text: string): Promise<NLResult> {
  const ends = await listEnds();
  const collections = await listCollections();

  // Deterministic handling for "add X to Y collection" - bypass LLM to avoid wrong intent
  const addToCollection = parseAddEndToCollection(text);
  if (addToCollection) {
    const end = findBestMatch(ends, addToCollection.endName, (e) => e.name);
    const collection = findBestMatch(collections, addToCollection.collectionName, (c) => c.name);
    if (!end) {
      return { success: false, message: `End "${addToCollection.endName}" not found. Check the name or create it first.` };
    }
    if (!collection) {
      return { success: false, message: `Collection "${addToCollection.collectionName}" not found. Check the name or create it first.` };
    }
    const updated = await updateEnd(end.id, { collectionId: collection.id });
    return {
      success: true,
      message: `Updated end: ${updated?.name} (${updated?.id}) - added to collection ${collection.name}`,
    };
  }

  const habits = await listHabits();
  const areas = await listAreas();
  const organizations = await listOrganizations();
  const teams = await listTeams();

  const context = `
Habits (id, name):
${habits.map((h) => `  ${h.id}: ${h.name}`).join("\n")}

Ends (id, name, areaId, collectionId):
${ends.map((e) => `  ${e.id}: ${e.name}${e.areaId ? ` area:${e.areaId}` : ""}${e.collectionId ? ` collection:${e.collectionId}` : ""}`).join("\n")}

Areas (id, name):
${areas.map((a) => `  ${a.id}: ${a.name}`).join("\n")}

Organizations (id, name):
${organizations.map((o) => `  ${o.id}: ${o.name}`).join("\n")}

Teams (id, name, organizationId):
${teams.map((t) => `  ${t.id}: ${t.name} (org: ${t.organizationId})`).join("\n")}

Collections (id, name, ownerType, ownerId, collectionType):
${collections.map((c) => `  ${c.id}: ${c.name} (${c.ownerType}: ${c.ownerId})${c.collectionType ? ` [${c.collectionType}]` : ""}`).join("\n") || "  (none)"}

Persons (id, firstName, lastName, email, relationshipType, teamIds):
${(await listPersons()).map((p) => `  ${p.id}: ${p.firstName} ${p.lastName}, ${p.email}${p.relationshipType ? ` (${p.relationshipType})` : ""}, teams: [${(p.teamIds ?? []).join(", ")}]`).join("\n") || "  (none)"}

When user says me, I, my, or myself - use "__self__" for personId or id. Resolves to the person with relationshipType "self".

Today's date: ${new Date().toISOString().slice(0, 10)}
`;

  const prompt = `${INTENT_SCHEMA}

${context}

User said: "${text}"

JSON response:`;

  const provider = createLLMProvider();
  const raw = await provider.complete(prompt);

  // Extract JSON (handle markdown code blocks)
  let jsonStr = raw.trim();
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();

  let parsed: { intent: string; params?: Record<string, unknown> };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { success: false, message: `Could not parse LLM response: ${raw.slice(0, 200)}` };
  }

  const { intent, params = {} } = parsed;

  // Resolve __self__ placeholder to the person with relationshipType "self"
  if (
    params &&
    (params.personId === SELF_PLACEHOLDER ||
      params.id === SELF_PLACEHOLDER ||
      params.ownerId === SELF_PLACEHOLDER)
  ) {
    const selfPerson = await getSelfPerson();
    if (!selfPerson) {
      return {
        success: false,
        message:
          'No person with relationshipType "self" found. Create yourself with -r self, or add relationshipType "self" to your person via update-person.',
      };
    }
    if (params.personId === SELF_PLACEHOLDER) params.personId = selfPerson.id;
    if (params.id === SELF_PLACEHOLDER) params.id = selfPerson.id;
    if (params.ownerId === SELF_PLACEHOLDER) params.ownerId = selfPerson.id;
  }

  try {
    switch (intent) {
      case "create_action": {
        const { habitId, completedAt, actualDurationMinutes, notes } = params as {
          habitId?: string;
          completedAt?: string;
          actualDurationMinutes?: number;
          notes?: string;
        };
        if (!habitId || !completedAt) {
          return { success: false, message: "Missing habitId or completedAt for create_action" };
        }
        const completedAtISO =
          completedAt.length === 10 ? `${completedAt}T12:00:00.000Z` : completedAt;
        const action = await createAction({
          habitId,
          completedAt: completedAtISO,
          actualDurationMinutes,
          notes,
        });
        const habit = await getHabitById(habitId);
        return {
          success: true,
          message: `Recorded: ${habit?.name ?? habitId} on ${completedAt.slice(0, 10)}${actualDurationMinutes != null ? ` (${actualDurationMinutes} min)` : ""}`,
        };
      }

      case "create_end": {
        const { name, areaId, collectionId } = params as { name?: string; areaId?: string; collectionId?: string };
        if (!name) {
          return { success: false, message: "Missing name for create_end" };
        }
        const end = await createEnd({ name, areaId, collectionId });
        return {
          success: true,
          message: `Created end: ${end.name} (${end.id})`,
        };
      }

      case "update_end": {
        const { id, name, areaId, collectionId } = params as {
          id?: string;
          name?: string;
          areaId?: string;
          collectionId?: string;
        };
        if (!id) {
          return { success: false, message: "Missing id for update_end. Specify the end to update." };
        }
        const updates: Record<string, unknown> = {};
        if (name != null) updates.name = name;
        if (areaId !== undefined) updates.areaId = areaId;
        if (collectionId !== undefined) updates.collectionId = collectionId;
        if (Object.keys(updates).length === 0) {
          return { success: false, message: "No updates provided for update_end. Specify name, areaId, or collectionId." };
        }
        const end = await updateEnd(id, updates);
        if (!end) {
          return { success: false, message: `End with ID ${id} not found.` };
        }
        const parts = [`Updated end: ${end.name} (${end.id})`];
        if (collectionId !== undefined) parts.push("added to collection");
        return { success: true, message: parts.join(" - ") };
      }

      case "create_habit": {
        const { name, endIds, frequency, durationMinutes, areaId, teamId, personId } = params as {
          name?: string;
          endIds?: string[];
          frequency?: string;
          durationMinutes?: number;
          areaId?: string;
          teamId?: string;
          personId?: string;
        };
        if (!name || !endIds?.length) {
          return { success: false, message: "Missing name or endIds for create_habit" };
        }
        const habit = await createHabit({
          name,
          endIds,
          frequency,
          durationMinutes,
          areaId,
          teamId,
          personId,
        });
        const extras: string[] = [];
        if (habit.teamId) {
          const team = await getTeamById(habit.teamId);
          extras.push(`team: ${team?.name ?? habit.teamId}`);
        }
        if (habit.personId) {
          const p = await getPersonById(habit.personId);
          extras.push(`performed by: ${p ? `${p.firstName} ${p.lastName}` : habit.personId}`);
        }
        return {
          success: true,
          message: `Created habit: ${habit.name} (${habit.id})${extras.length ? ` - ${extras.join(", ")}` : ""}`,
        };
      }

      case "create_collection": {
        const { name, ownerType, ownerId, collectionType, description } = params as {
          name?: string;
          ownerType?: string;
          ownerId?: string;
          collectionType?: string;
          description?: string;
        };
        if (!name || !ownerType || !ownerId) {
          return {
            success: false,
            message:
              "Missing name, ownerType, or ownerId for create_collection. Specify the collection name and owner (organization, team, or person).",
          };
        }
        const validOwnerTypes = ["organization", "team", "person"];
        if (!validOwnerTypes.includes(ownerType)) {
          return {
            success: false,
            message: `Invalid ownerType. Use one of: ${validOwnerTypes.join(", ")}`,
          };
        }
        const collection = await createCollection({
          name,
          ownerType: ownerType as "organization" | "team" | "person",
          ownerId,
          collectionType: collectionType as "goals" | "projects" | "quarterly" | "backlog" | "operations" | "other" | undefined,
          description,
        });
        return {
          success: true,
          message: `Created collection: ${collection.name} (${collection.id}) owned by ${ownerType} ${ownerId}`,
        };
      }

      case "create_team": {
        const { name, organizationId } = params as { name?: string; organizationId?: string };
        if (!name || !organizationId) {
          return {
            success: false,
            message: "Missing name or organizationId for create_team. Please include the team name and organization (e.g. 'Create an Engineering team in Newco').",
          };
        }
        const team = await createTeam({ name, organizationId });
        return {
          success: true,
          message: `Created team: ${team.name} (${team.id}) in organization ${team.organizationId}`,
        };
      }

      case "suggest_habits": {
        const { query, suggestions } = params as { query?: string; suggestions?: string[] };
        if (!suggestions?.length) {
          return { success: false, message: "Could not generate habit suggestions." };
        }
        const lines = suggestions.map((s, i) => `${i + 1}. ${s}`);
        return {
          success: true,
          message: `Habits that could help with "${query ?? "your goal"}":\n\n${lines.join("\n")}`,
        };
      }

      case "create_person": {
        const { firstName, lastName, email, phone, title, notes, relationshipType, teamIds } = params as {
          firstName?: string;
          lastName?: string;
          email?: string;
          phone?: string;
          title?: string;
          notes?: string;
          relationshipType?: string;
          teamIds?: string[];
        };
        if (!firstName || !lastName || !email) {
          return {
            success: false,
            message: "Missing firstName, lastName, or email for create_person. Please include the person's full name and email.",
          };
        }
        const validRelationshipTypes = ["self", "spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"];
        const relationshipTypeValid =
          !relationshipType || validRelationshipTypes.includes(relationshipType);
        if (!relationshipTypeValid) {
          return { success: false, message: `Invalid relationshipType. Use one of: ${validRelationshipTypes.join(", ")}` };
        }
        const person = await createPerson({
          firstName,
          lastName,
          email,
          phone,
          title,
          notes,
          relationshipType: relationshipTypeValid && relationshipType ? (relationshipType as RelationshipType) : undefined,
          teamIds: teamIds ?? [],
        });
        return {
          success: true,
          message: `Created person: ${person.firstName} ${person.lastName} (${person.id})${person.relationshipType ? ` - ${person.relationshipType}` : ""}`,
        };
      }

      case "update_person": {
        const { id, teamIdsToAdd } = params as { id?: string; teamIdsToAdd?: string[] };
        if (!id) {
          return {
            success: false,
            message: "Missing id for update_person. Use the person's id from the Persons list.",
          };
        }
        const updates: { teamIdsToAdd?: string[] } = {};
        if (teamIdsToAdd != null && Array.isArray(teamIdsToAdd) && teamIdsToAdd.length > 0) {
          updates.teamIdsToAdd = teamIdsToAdd;
        }
        const person = await updatePerson(id, updates);
        if (!person) {
          return {
            success: false,
            message: `Person with ID ${id} not found.`,
          };
        }
        return {
          success: true,
          message: `Updated person: ${person.firstName} ${person.lastName}${teamIdsToAdd?.length ? ` - added to teams: ${teamIdsToAdd.join(", ")}` : ""}`,
        };
      }

      case "list_areas": {
        const areas = await listAreas();
        if (areas.length === 0) {
          return { success: true, message: "No areas found." };
        }
        const lines = areas.map((a) => `  ${a.name} (${a.id})`);
        return {
          success: true,
          message: `Areas:\n\n${lines.join("\n")}`,
        };
      }

      case "list_ends": {
        const { areaId, collectionId } = params as { areaId?: string; collectionId?: string };
        const ends = await listEnds(areaId || collectionId ? { areaId, collectionId } : undefined);
        if (ends.length === 0) {
          return {
            success: true,
            message: areaId ? "No ends found for this area." : "No ends found.",
          };
        }
        const lines = ends.map((e) => `  ${e.name} (${e.id})`);
        return {
          success: true,
          message: `Ends:\n\n${lines.join("\n")}`,
        };
      }

      case "list_habits": {
        const { endId, areaId, teamId, personId } = params as {
          endId?: string;
          areaId?: string;
          teamId?: string;
          personId?: string;
        };
        const habits = await listHabits({ endId, areaId, teamId, personId });
        if (habits.length === 0) {
          return { success: true, message: "No habits found." };
        }
        const allEnds = await listEnds();
        const lines = habits.map((h) => {
          const endNames = h.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid).join(", ");
          return `  ${h.name} (${h.id}) → serves: ${endNames}`;
        });
        return {
          success: true,
          message: `Habits:\n\n${lines.join("\n")}`,
        };
      }

      case "list_organizations": {
        const { expand } = params as { expand?: boolean };
        const orgs = await listOrganizations();
        if (orgs.length === 0) {
          return { success: true, message: "No organizations found." };
        }
        if (!expand) {
          const lines = orgs.map((o) => `  ${o.name} (${o.id})`);
          return { success: true, message: `Organizations:\n\n${lines.join("\n")}` };
        }
        const sections: string[] = [];
        for (const org of orgs) {
          const teams = await listTeams(org.id);
          const parts: string[] = [`  ${org.name} (${org.id})`, "    Teams:"];
          if (teams.length === 0) {
            parts.push("      (no teams)");
          } else {
            for (const t of teams) {
              const people = await listPersons({ teamId: t.id });
              const peopleNames = people.map((p) => `${p.firstName} ${p.lastName}`).join(", ");
              parts.push(`      - ${t.name} (${t.id})`);
              parts.push(`        ${peopleNames || "(no members)"}`);
            }
          }
          sections.push(parts.join("\n"));
        }
        return {
          success: true,
          message: `Organizations:\n\n${sections.join("\n\n")}`,
        };
      }

      case "list_collections": {
        const { ownerType, ownerId, collectionType } = params as {
          ownerType?: string;
          ownerId?: string;
          collectionType?: string;
        };
        const collections = await listCollections(
          ownerType || ownerId || collectionType
            ? { ownerType, ownerId, collectionType }
            : undefined
        );
        if (collections.length === 0) {
          return {
            success: true,
            message: "No collections found.",
          };
        }
        const lines = collections.map(
          (c) =>
            `  ${c.name} (${c.id}) - ${c.ownerType}: ${c.ownerId}${c.collectionType ? ` [${c.collectionType}]` : ""}`
        );
        return {
          success: true,
          message: `Collections:\n\n${lines.join("\n")}`,
        };
      }

      case "list_teams": {
        const { organizationId, personId } = params as { organizationId?: string; personId?: string };
        let teams = await listTeams(personId ? undefined : organizationId);
        if (personId) {
          const person = await getPersonById(personId);
          if (!person) {
            return { success: false, message: `Person with ID ${personId} not found.` };
          }
          const memberTeamIds = new Set(person.teamIds ?? []);
          teams = teams.filter((t) => memberTeamIds.has(t.id));
        }
        if (teams.length === 0) {
          return {
            success: true,
            message: personId
              ? "No teams found for this person."
              : organizationId
                ? "No teams found for this organization."
                : "No teams found.",
          };
        }
        const lines = teams.map((t) => `  ${t.name} (${t.id}) - Organization: ${t.organizationId}`);
        return {
          success: true,
          message: `Teams:\n\n${lines.join("\n")}`,
        };
      }

      case "list_people": {
        const { organizationId, teamId, relationshipType } = params as {
          organizationId?: string;
          teamId?: string;
          relationshipType?: string;
        };
        const people = await listPersons({ organizationId, teamId, relationshipType });
        if (people.length === 0) {
          return { success: true, message: "No people found." };
        }
        const lines = await Promise.all(
          people.map(async (p) => {
            const teamNames: string[] = [];
            for (const tId of p.teamIds ?? []) {
              const team = await getTeamById(tId);
              teamNames.push(team?.name ?? tId);
            }
            const parts = [
              `${p.firstName} ${p.lastName} (${p.id})`,
              `  Email: ${p.email}`,
              p.phone && `  Phone: ${p.phone}`,
              p.title && `  Title: ${p.title}`,
              p.relationshipType && `  Relationship: ${p.relationshipType}`,
              teamNames.length > 0 && `  Teams: ${teamNames.join(", ")}`,
            ].filter(Boolean);
            return parts.join("\n");
          })
        );
        return {
          success: true,
          message: `People:\n\n${lines.join("\n\n")}`,
        };
      }

      case "list_actions": {
        const { habitId, fromDate, toDate } = params as {
          habitId?: string;
          fromDate?: string;
          toDate?: string;
        };
        const actions = await listActions({ habitId, fromDate, toDate });
        if (actions.length === 0) {
          return { success: true, message: "No actions found." };
        }
        const habitMap = new Map((await listHabits()).map((h) => [h.id, h.name]));
        const lines = actions.map((a) => {
          const habitName = habitMap.get(a.habitId) ?? a.habitId;
          const date = a.completedAt.slice(0, 10);
          const extra = a.actualDurationMinutes != null ? ` (${a.actualDurationMinutes} min)` : "";
          return `  ${date}: ${habitName}${extra}`;
        });
        return {
          success: true,
          message: `Actions:\n\n${lines.join("\n")}`,
        };
      }

      case "list_ends_and_habits": {
        const { areaId } = params as { areaId?: string };
        const areas = await listAreas();
        const allEnds = await listEnds();
        const allHabits = await listHabits();
        const areaIdsToShow = areaId
          ? (await getAreaById(areaId) ? [areaId] : [])
          : areas.map((a) => a.id);
        if (areaId && areaIdsToShow.length === 0) {
          return { success: false, message: `Area with ID ${areaId} not found.` };
        }
        const sections: string[] = [];
        for (const aId of areaIdsToShow) {
          const area = areas.find((a) => a.id === aId);
          const areaName = area?.name ?? aId;
          const ends = allEnds.filter((e) => e.areaId === aId);
          if (ends.length === 0) continue;
          const parts: string[] = [`## ${areaName}`];
          for (const e of ends) {
            const habitsForEnd = allHabits.filter((h) => h.endIds.includes(e.id));
            parts.push(`  - ${e.name} (${e.id})`);
            habitsForEnd.forEach((h) => parts.push(`    - ${h.name} (${h.id})`));
          }
          sections.push(parts.join("\n"));
        }
        const uncategorizedEnds = allEnds.filter((e) => !e.areaId);
        if (uncategorizedEnds.length > 0) {
          const parts: string[] = ["## Uncategorized"];
          for (const e of uncategorizedEnds) {
            const habitsForEnd = allHabits.filter((h) => h.endIds.includes(e.id));
            parts.push(`  - ${e.name} (${e.id})`);
            habitsForEnd.forEach((h) => parts.push(`    - ${h.name} (${h.id})`));
          }
          sections.push(parts.join("\n"));
        }
        if (sections.length === 0) {
          return {
            success: true,
            message: areaId ? "No ends or habits found for this area." : "No ends or habits found.",
          };
        }
        return {
          success: true,
          message: sections.join("\n\n"),
        };
      }

      case "get_person": {
        const { personId } = params as { personId?: string };
        if (!personId) {
          return {
            success: false,
            message: "Missing personId for get_person. Match the person by name from the Persons list.",
          };
        }
        const person = await getPersonById(personId);
        if (!person) {
          return {
            success: false,
            message: `Person with ID ${personId} not found.`,
          };
        }
        const teamNames: string[] = [];
        for (const tId of person.teamIds ?? []) {
          const team = await getTeamById(tId);
          teamNames.push(team?.name ?? tId);
        }
        const parts = [
          `${person.firstName} ${person.lastName} (${person.id})`,
          `  Email: ${person.email}`,
          person.phone && `  Phone: ${person.phone}`,
          person.title && `  Title: ${person.title}`,
          person.relationshipType && `  Relationship: ${person.relationshipType}`,
          teamNames.length > 0 && `  Teams: ${teamNames.join(", ")}`,
          `  Created: ${person.createdAt}`,
        ].filter(Boolean);
        return {
          success: true,
          message: parts.join("\n"),
        };
      }

      case "unknown":
        return {
          success: false,
          message: `I couldn't understand that. Try phrases like "I went to the gym today for 60 minutes", "I want to be a better father", "What habits would help me be a better father?", "Create an Engineering group in Newco", "Add my wife Jennifer, jennifer@example.com", "show my habits", or "show me John".`,
        };

      default:
        return {
          success: false,
          message: `Unknown intent: ${intent}. Supported: create_action, create_end, create_habit, create_team, create_collection, create_person, update_person, update_end, suggest_habits, list_areas, list_ends, list_habits, list_organizations, list_teams, list_collections, list_people, list_actions, list_ends_and_habits, get_person.`,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Error: ${msg}` };
  }
}
