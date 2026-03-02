import { createLLMProvider } from "../llm/index.js";
import { listHabits, createHabit, getHabitById } from "../store/habits.js";
import { listEnds, createEnd } from "../store/ends.js";
import { listDomains } from "../store/domains.js";
import { listOrganizations } from "../store/organizations.js";
import { listGroups, createGroup, getGroupById } from "../store/groups.js";
import { createAction } from "../store/actions.js";
import { createPerson, listPersons, updatePerson, getPersonById } from "../store/persons.js";

const INTENT_SCHEMA = `Respond with ONLY valid JSON, no other text. Use this schema:
{
  "intent": "create_action" | "create_end" | "create_habit" | "create_group" | "create_person" | "update_person" | "suggest_habits" | "unknown",
  "params": { ... }
}

For create_action: { "habitId": "<id>", "completedAt": "YYYY-MM-DD", "actualDurationMinutes": number (optional), "notes": string (optional) }
- Match the user's habit reference (e.g. "gym", "guitar") to the closest habit by name. Use the habit's id.
- "today" = ${new Date().toISOString().slice(0, 10)}, "yesterday" = previous day
- Extract duration in minutes if mentioned (e.g. "60 minutes" -> 60)

For create_end: { "name": string, "domainId": string (optional) }
- Extract the aspiration/goal from the user's text
- Match domain if mentioned (e.g. "family" -> Family domain id)

For create_habit: { "name": string, "endIds": ["<id>"], "frequency": string (optional), "durationMinutes": number (optional), "domainId": string (optional), "groupId": string (optional), "personId": string (optional) }
- Extract habit name and which end(s) it serves
- If the end has a domainId in context, include it. Or infer domain from the habit topic (e.g. sleep -> Health, work -> Career)
- Match group by name from Groups list if mentioned (e.g. "for Engineering" -> groupId)
- personId = the person expected to PERFORM the habit (the doer), NOT the focus/recipient. Match by name from Persons list (e.g. "John's habit", "assigned to Sarah" -> personId)
- If both group and person are mentioned, include both groupId and personId

For create_group: { "name": string, "organizationId": "<id>" }
- Extract group name and match organization by name (use org id from context)
- e.g. "Create an Engineering group in Newco" -> name: Engineering, organizationId: Newco's id

For create_person: { "firstName": string, "lastName": string, "email": string, "phone": string (optional), "title": string (optional), "notes": string (optional), "relationshipType": "spouse"|"child"|"parent"|"sibling"|"friend"|"colleague"|"mentor"|"client"|"other" (optional), "groupIds": ["<id>"] (optional) }
- IMPORTANT: Check the Persons list first. If the person already exists (match by name or email), use update_person instead.
- Extract name and split into firstName and lastName (use last word as lastName, rest as firstName if full name given)
- Map relationship words to relationshipType: wife/husband/partner -> spouse, kid/son/daughter -> child, mom/dad/parent -> parent, brother/sister -> sibling, coworker -> colleague
- Match group by name if mentioned (use id from context). Person membership is through groups only.
- Email is required - use "unknown@example.com" only if truly not provided

For update_person: { "id": "<id>", "groupIdsToAdd": ["<id>", ...] (optional) }
- Use when the person ALREADY EXISTS in Persons list and you need to add them to a group.
- Match person by name from Persons list and use their id.
- Use groupIdsToAdd with the NEW group id(s) to add. This merges with existing groups; do not pass existing groups.

For suggest_habits: { "query": string, "suggestions": ["habit 1", "habit 2", ...] }
- Use when user asks for habit suggestions (e.g. "What habits would help me be a better father?", "Suggest habits for getting promoted")
- Extract the aspiration/goal from their message as query
- Generate 3-5 concrete, actionable habit suggestions
- Use "unknown" if the intent is unclear`;

export interface NLResult {
  success: boolean;
  message: string;
}

export async function interpretAndExecute(text: string): Promise<NLResult> {
  const habits = await listHabits();
  const ends = await listEnds();
  const domains = await listDomains();
  const organizations = await listOrganizations();
  const groups = await listGroups();

  const context = `
Habits (id, name):
${habits.map((h) => `  ${h.id}: ${h.name}`).join("\n")}

Ends (id, name, domainId):
${ends.map((e) => `  ${e.id}: ${e.name}${e.domainId ? ` (domain: ${e.domainId})` : ""}`).join("\n")}

Domains (id, name):
${domains.map((d) => `  ${d.id}: ${d.name}`).join("\n")}

Organizations (id, name):
${organizations.map((o) => `  ${o.id}: ${o.name}`).join("\n")}

Groups (id, name, organizationId):
${groups.map((g) => `  ${g.id}: ${g.name} (org: ${g.organizationId})`).join("\n")}

Persons (id, firstName, lastName, email, groupIds):
${(await listPersons()).map((p) => `  ${p.id}: ${p.firstName} ${p.lastName}, ${p.email}, groups: [${(p.groupIds ?? []).join(", ")}]`).join("\n") || "  (none)"}

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
        const { name, domainId } = params as { name?: string; domainId?: string };
        if (!name) {
          return { success: false, message: "Missing name for create_end" };
        }
        const end = await createEnd({ name, domainId });
        return {
          success: true,
          message: `Created end: ${end.name} (${end.id})`,
        };
      }

      case "create_habit": {
        const { name, endIds, frequency, durationMinutes, domainId, groupId, personId } = params as {
          name?: string;
          endIds?: string[];
          frequency?: string;
          durationMinutes?: number;
          domainId?: string;
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
          domainId,
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
        const validRelationshipTypes = ["spouse", "child", "parent", "sibling", "friend", "colleague", "mentor", "client", "other"];
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
          relationshipType: relationshipTypeValid && relationshipType ? (relationshipType as "spouse" | "child" | "parent" | "sibling" | "friend" | "colleague" | "mentor" | "client" | "other") : undefined,
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

      case "unknown":
        return {
          success: false,
          message: `I couldn't understand that. Try phrases like "I went to the gym today for 60 minutes", "I want to be a better father", "What habits would help me be a better father?", "Create an Engineering group in Newco", or "Add my wife Jennifer, jennifer@example.com".`,
        };

      default:
        return {
          success: false,
          message: `Unknown intent: ${intent}. Supported: create_action, create_end, create_habit, create_group, create_person, update_person, suggest_habits.`,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Error: ${msg}` };
  }
}
