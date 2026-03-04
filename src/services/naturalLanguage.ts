import { createLLMProvider } from "../llm/index.js";
import { listHabits, createHabit, getHabitById } from "../store/habits.js";
import { listEnds, createEnd, getEndById } from "../store/ends.js";
import { listAreas, getAreaById } from "../store/areas.js";
import { listOrganizations } from "../store/organizations.js";
import { listGroups, createGroup, getGroupById } from "../store/groups.js";
import { createAction, listActions } from "../store/actions.js";
import type { RelationshipType } from "../schemas/person.js";
import { createPerson, listPersons, updatePerson, getPersonById, getSelfPerson } from "../store/persons.js";

const SELF_PLACEHOLDER = "__self__";

const INTENT_SCHEMA = `Respond with ONLY valid JSON, no other text. Use this schema:
{
  "intent": "create_action" | "create_end" | "create_habit" | "create_group" | "create_person" | "update_person" | "suggest_habits" | "list_areas" | "list_ends" | "list_habits" | "list_organizations" | "list_groups" | "list_people" | "list_actions" | "list_ends_and_habits" | "get_person" | "unknown",
  "params": { ... }
}

For create_action: { "habitId": "<id>", "completedAt": "YYYY-MM-DD", "actualDurationMinutes": number (optional), "notes": string (optional) }
- Match the user's habit reference (e.g. "gym", "guitar") to the closest habit by name. Use the habit's id.
- "today" = ${new Date().toISOString().slice(0, 10)}, "yesterday" = previous day
- Extract duration in minutes if mentioned (e.g. "60 minutes" -> 60)

For create_end: { "name": string, "areaId": string (optional) }
- Extract the aspiration/goal from the user's text
- Match area if mentioned (e.g. "family" -> Family area id)

For create_habit: { "name": string, "endIds": ["<id>"], "frequency": string (optional), "durationMinutes": number (optional), "areaId": string (optional), "groupId": string (optional), "personId": string (optional) }
- Extract habit name and which end(s) it serves
- If the end has an areaId in context, include it. Or infer area from the habit topic (e.g. sleep -> Health, work -> Career)
- Match group by name from Groups list if mentioned (e.g. "for Engineering" -> groupId)
- personId = the person expected to PERFORM the habit (the doer), NOT the focus/recipient. Match by name from Persons list (e.g. "John's habit", "assigned to Sarah" -> personId). When user says me, I, my, or myself -> use personId: "__self__"
- If both group and person are mentioned, include both groupId and personId

For create_group: { "name": string, "organizationId": "<id>" }
- Extract group name and match organization by name (use org id from context)
- e.g. "Create an Engineering group in Newco" -> name: Engineering, organizationId: Newco's id

For create_person: { "firstName": string, "lastName": string, "email": string, "phone": string (optional), "title": string (optional), "notes": string (optional), "relationshipType": "self"|"spouse"|"child"|"parent"|"sibling"|"friend"|"colleague"|"mentor"|"client"|"other" (optional), "groupIds": ["<id>"] (optional) }
- IMPORTANT: Check the Persons list first. If the person already exists (match by name or email), use update_person instead.
- Extract name and split into firstName and lastName (use last word as lastName, rest as firstName if full name given)
- Map relationship words to relationshipType: wife/husband/partner -> spouse, kid/son/daughter -> child, mom/dad/parent -> parent, brother/sister -> sibling, coworker -> colleague
- Match group by name if mentioned (use id from context). Person membership is through groups only.
- Email is required - use "unknown@example.com" only if truly not provided

For update_person: { "id": "<id>", "groupIdsToAdd": ["<id>", ...] (optional) }
- Use when the person ALREADY EXISTS in Persons list and you need to add them to a group.
- Match person by name from Persons list and use their id. When user says me, I, my, or myself -> use id: "__self__"
- Use groupIdsToAdd with the NEW group id(s) to add. This merges with existing groups; do not pass existing groups.

For suggest_habits: { "query": string, "suggestions": ["habit 1", "habit 2", ...] }
- Use when user asks for habit suggestions (e.g. "What habits would help me be a better father?", "Suggest habits for getting promoted")
- Extract the aspiration/goal from their message as query
- Generate 3-5 concrete, actionable habit suggestions

For list_areas: {}
- Use when user wants to see areas (e.g. "show areas", "list areas", "what areas do I have")

For list_ends: { "areaId": "<id>" (optional) }
- Use when user wants to see ends/aspirations (e.g. "show my ends", "list aspirations", "what ends do I have")
- Match area by name if mentioned (e.g. "ends in Career" -> areaId)

For list_habits: { "endId": "<id>" (optional), "areaId": "<id>" (optional), "groupId": "<id>" (optional), "personId": "<id>" (optional) }
- Use when user wants to see habits (e.g. "show my habits", "list habits", "habits for guitar end")
- Match end, area, group, or person by name from context if mentioned. When user says my habits -> use personId: "__self__"

For list_organizations: { "expand": boolean (optional) }
- Use when user wants to see organizations (e.g. "show organizations", "list orgs", "organizations with groups")
- Set expand: true if user wants to see groups and people under each org

For list_groups: { "organizationId": "<id>" (optional) }
- Use when user wants to see groups (e.g. "show groups", "list groups", "groups in Acme")
- Match organization by name if mentioned

For list_people: { "organizationId": "<id>" (optional), "groupId": "<id>" (optional), "relationshipType": "self"|"spouse"|"child"|"parent"|"sibling"|"friend"|"colleague"|"mentor"|"client"|"other" (optional) }
- Use when user wants to see people (e.g. "show people", "list people", "people in Engineering", "my colleagues")
- Match org or group by name. Map relationship words to relationshipType.

For list_actions: { "habitId": "<id>" (optional), "fromDate": "YYYY-MM-DD" (optional), "toDate": "YYYY-MM-DD" (optional) }
- Use when user wants to see tracked actions/completions (e.g. "show my actions", "what did I do", "gym completions this month")
- Match habit by name. "this month" = first and last day of current month. "this week" = Mon-Sun of current week.

For list_ends_and_habits: { "areaId": "<id>" (optional) }
- Use when user wants ends and habits grouped by area (e.g. "show my ends and habits", "ends and habits by area")
- Match area by name if mentioned

For get_person: { "personId": "<id>" }
- Use when user wants details for a specific person (e.g. "show me John", "get John Doe's details", "who is Sarah?", "show me" / "my details")
- Match person by name from Persons list and use their id. When user says show me, my details, who am I -> use personId: "__self__"

- Use "unknown" if the intent is unclear`;

export interface NLResult {
  success: boolean;
  message: string;
}

export async function interpretAndExecute(text: string): Promise<NLResult> {
  const habits = await listHabits();
  const ends = await listEnds();
  const areas = await listAreas();
  const organizations = await listOrganizations();
  const groups = await listGroups();

  const context = `
Habits (id, name):
${habits.map((h) => `  ${h.id}: ${h.name}`).join("\n")}

Ends (id, name, areaId):
${ends.map((e) => `  ${e.id}: ${e.name}${e.areaId ? ` (area: ${e.areaId})` : ""}`).join("\n")}

Areas (id, name):
${areas.map((a) => `  ${a.id}: ${a.name}`).join("\n")}

Organizations (id, name):
${organizations.map((o) => `  ${o.id}: ${o.name}`).join("\n")}

Groups (id, name, organizationId):
${groups.map((g) => `  ${g.id}: ${g.name} (org: ${g.organizationId})`).join("\n")}

Persons (id, firstName, lastName, email, relationshipType, groupIds):
${(await listPersons()).map((p) => `  ${p.id}: ${p.firstName} ${p.lastName}, ${p.email}${p.relationshipType ? ` (${p.relationshipType})` : ""}, groups: [${(p.groupIds ?? []).join(", ")}]`).join("\n") || "  (none)"}

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
  if (params && (params.personId === SELF_PLACEHOLDER || params.id === SELF_PLACEHOLDER)) {
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
        const { name, areaId } = params as { name?: string; areaId?: string };
        if (!name) {
          return { success: false, message: "Missing name for create_end" };
        }
        const end = await createEnd({ name, areaId });
        return {
          success: true,
          message: `Created end: ${end.name} (${end.id})`,
        };
      }

      case "create_habit": {
        const { name, endIds, frequency, durationMinutes, areaId, groupId, personId } = params as {
          name?: string;
          endIds?: string[];
          frequency?: string;
          durationMinutes?: number;
          areaId?: string;
          groupId?: string;
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
          groupId,
          personId,
        });
        const extras: string[] = [];
        if (habit.groupId) {
          const grp = await getGroupById(habit.groupId);
          extras.push(`group: ${grp?.name ?? habit.groupId}`);
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

      case "create_group": {
        const { name, organizationId } = params as { name?: string; organizationId?: string };
        if (!name || !organizationId) {
          return {
            success: false,
            message: "Missing name or organizationId for create_group. Please include the group name and organization (e.g. 'Create an Engineering group in Newco').",
          };
        }
        const group = await createGroup({ name, organizationId });
        return {
          success: true,
          message: `Created group: ${group.name} (${group.id}) in organization ${group.organizationId}`,
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
        const { firstName, lastName, email, phone, title, notes, relationshipType, groupIds } = params as {
          firstName?: string;
          lastName?: string;
          email?: string;
          phone?: string;
          title?: string;
          notes?: string;
          relationshipType?: string;
          groupIds?: string[];
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
          groupIds: groupIds ?? [],
        });
        return {
          success: true,
          message: `Created person: ${person.firstName} ${person.lastName} (${person.id})${person.relationshipType ? ` - ${person.relationshipType}` : ""}`,
        };
      }

      case "update_person": {
        const { id, groupIdsToAdd } = params as { id?: string; groupIdsToAdd?: string[] };
        if (!id) {
          return {
            success: false,
            message: "Missing id for update_person. Use the person's id from the Persons list.",
          };
        }
        const updates: { groupIdsToAdd?: string[] } = {};
        if (groupIdsToAdd != null && Array.isArray(groupIdsToAdd) && groupIdsToAdd.length > 0) {
          updates.groupIdsToAdd = groupIdsToAdd;
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
          message: `Updated person: ${person.firstName} ${person.lastName}${groupIdsToAdd?.length ? ` - added to groups: ${groupIdsToAdd.join(", ")}` : ""}`,
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
        const { areaId } = params as { areaId?: string };
        const ends = await listEnds(areaId);
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
        const { endId, areaId, groupId, personId } = params as {
          endId?: string;
          areaId?: string;
          groupId?: string;
          personId?: string;
        };
        const habits = await listHabits({ endId, areaId, groupId, personId });
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
          const groups = await listGroups(org.id);
          const parts: string[] = [`  ${org.name} (${org.id})`, "    Groups:"];
          if (groups.length === 0) {
            parts.push("      (no groups)");
          } else {
            for (const g of groups) {
              const people = await listPersons({ groupId: g.id });
              const peopleNames = people.map((p) => `${p.firstName} ${p.lastName}`).join(", ");
              parts.push(`      - ${g.name} (${g.id})`);
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

      case "list_groups": {
        const { organizationId } = params as { organizationId?: string };
        const groups = await listGroups(organizationId);
        if (groups.length === 0) {
          return {
            success: true,
            message: organizationId ? "No groups found for this organization." : "No groups found.",
          };
        }
        const lines = groups.map((g) => `  ${g.name} (${g.id}) - Organization: ${g.organizationId}`);
        return {
          success: true,
          message: `Groups:\n\n${lines.join("\n")}`,
        };
      }

      case "list_people": {
        const { organizationId, groupId, relationshipType } = params as {
          organizationId?: string;
          groupId?: string;
          relationshipType?: string;
        };
        const people = await listPersons({ organizationId, groupId, relationshipType });
        if (people.length === 0) {
          return { success: true, message: "No people found." };
        }
        const lines = await Promise.all(
          people.map(async (p) => {
            const groupNames: string[] = [];
            for (const gId of p.groupIds ?? []) {
              const grp = await getGroupById(gId);
              groupNames.push(grp?.name ?? gId);
            }
            const parts = [
              `${p.firstName} ${p.lastName} (${p.id})`,
              `  Email: ${p.email}`,
              p.phone && `  Phone: ${p.phone}`,
              p.title && `  Title: ${p.title}`,
              p.relationshipType && `  Relationship: ${p.relationshipType}`,
              groupNames.length > 0 && `  Groups: ${groupNames.join(", ")}`,
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
        const groupNames: string[] = [];
        for (const gId of person.groupIds ?? []) {
          const grp = await getGroupById(gId);
          groupNames.push(grp?.name ?? gId);
        }
        const parts = [
          `${person.firstName} ${person.lastName} (${person.id})`,
          `  Email: ${person.email}`,
          person.phone && `  Phone: ${person.phone}`,
          person.title && `  Title: ${person.title}`,
          person.relationshipType && `  Relationship: ${person.relationshipType}`,
          groupNames.length > 0 && `  Groups: ${groupNames.join(", ")}`,
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
          message: `Unknown intent: ${intent}. Supported: create_action, create_end, create_habit, create_group, create_person, update_person, suggest_habits, list_areas, list_ends, list_habits, list_organizations, list_groups, list_people, list_actions, list_ends_and_habits, get_person.`,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Error: ${msg}` };
  }
}
