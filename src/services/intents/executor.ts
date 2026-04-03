/**
 * Intent Executor (Stage 3)
 *
 * Receives resolved params (real UUIDs, parsed dates) and executes
 * the corresponding store operations. Returns a human-readable result.
 */

import { listHabits, listHabitsWithShared, createHabit, getHabitById, deleteHabit } from "../../store/habits.js";
import { listEnds, createEnd, getEndById, updateEnd, deleteEnd, shareEnd, unshareEnd, listSharedEnds, listMyShares } from "../../store/ends.js";
import { listAreas, getAreaById } from "../../store/areas.js";
import { listOrganizations, createOrganization, getOrganizationById, deleteOrganization } from "../../store/organizations.js";
import { listTeams, createTeam, getTeamById, updateTeam, deleteTeam } from "../../store/teams.js";
import { listCollections, createCollection, getCollectionById, updateCollection, deleteCollection } from "../../store/collections.js";
import { createAction, listActions, listActionsWithShared } from "../../store/actions.js";
import { createTask, listTasks, updateTask, deleteTask } from "../../store/tasks.js";
import type { RelationshipType } from "../../schemas/person.js";
import { createPerson, listPersons, updatePerson, getPersonById, deletePerson } from "../../store/persons.js";
import type { ResolvedParams } from "./resolver.js";

export interface ExecuteResult {
  success: boolean;
  message: string;
}

type ExecutorFn = (params: ResolvedParams) => Promise<ExecuteResult>;

async function resolveOwnerName(ownerType: string, ownerId: string): Promise<string> {
  if (ownerType === "organization") {
    const org = await getOrganizationById(ownerId);
    return org?.name ?? ownerId;
  }
  if (ownerType === "team") {
    const team = await getTeamById(ownerId);
    return team?.name ?? ownerId;
  }
  if (ownerType === "person") {
    const person = await getPersonById(ownerId);
    return person ? `${person.firstName} ${person.lastName}` : ownerId;
  }
  return ownerId;
}

const executors: Record<string, ExecutorFn> = {
  async create_action(p) {
    const { habitId, completedAt, actualDurationMinutes, notes, withPersonIds, forPersonIds } = p as {
      habitId: string;
      completedAt: string;
      actualDurationMinutes?: number;
      notes?: string;
      withPersonIds?: string[];
      forPersonIds?: string[];
    };
    const completedAtISO = completedAt.length === 10 ? `${completedAt}T12:00:00.000Z` : completedAt;
    await createAction({ habitId, completedAt: completedAtISO, actualDurationMinutes, notes, withPersonIds, forPersonIds });
    const habit = await getHabitById(habitId);
    const extras: string[] = [];
    if (withPersonIds?.length) extras.push(`with ${withPersonIds.length} person(s)`);
    if (forPersonIds?.length) extras.push(`for ${forPersonIds.length} person(s)`);
    return {
      success: true,
      message: `Recorded: ${habit?.name ?? habitId} on ${completedAt.slice(0, 10)}${actualDurationMinutes != null ? ` (${actualDurationMinutes} min)` : ""}${extras.length ? ` ${extras.join(", ")}` : ""}`,
    };
  },

  async delete_end(p) {
    const { endId } = p as { endId: string };
    const end = await deleteEnd(endId);
    if (!end) return { success: false, message: `End not found.` };
    return { success: true, message: `Deleted end: ${end.name}` };
  },

  async create_end(p) {
    const { name, areaId, collectionId } = p as { name: string; areaId?: string; collectionId?: string };
    const end = await createEnd({ name, areaId, collectionId });
    return { success: true, message: `Created end: ${end.name} (${end.id})` };
  },

  async update_end(p) {
    const { id, name, areaId, collectionId } = p as { id: string; name?: string; areaId?: string; collectionId?: string };
    const updates: Record<string, unknown> = {};
    if (name != null) updates.name = name;
    if (areaId !== undefined) updates.areaId = areaId;
    if (collectionId !== undefined) updates.collectionId = collectionId;
    if (Object.keys(updates).length === 0) {
      return { success: false, message: "No updates provided for update_end." };
    }
    const end = await updateEnd(id, updates);
    if (!end) return { success: false, message: `End with ID ${id} not found.` };
    const parts = [`Updated end: ${end.name} (${end.id})`];
    if (collectionId !== undefined) parts.push("added to collection");
    return { success: true, message: parts.join(" - ") };
  },

  async create_habit(p) {
    const { name, endIds, frequency, durationMinutes, areaId, teamId, personIds } = p as {
      name: string;
      endIds: string[];
      frequency?: string;
      durationMinutes?: number;
      areaId?: string;
      teamId?: string;
      personIds?: string[];
    };
    const habit = await createHabit({ name, endIds, frequency, durationMinutes, areaId, teamId, personIds });
    const extras: string[] = [];
    if (habit.teamId) {
      const team = await getTeamById(habit.teamId);
      extras.push(`team: ${team?.name ?? habit.teamId}`);
    }
    if (habit.personIds?.length) {
      const names: string[] = [];
      for (const pid of habit.personIds) {
        const person = await getPersonById(pid);
        names.push(person ? `${person.firstName} ${person.lastName}` : pid);
      }
      extras.push(`participants: ${names.join(", ")}`);
    }
    return {
      success: true,
      message: `Created habit: ${habit.name} (${habit.id})${extras.length ? ` - ${extras.join(", ")}` : ""}`,
    };
  },

  async create_organization(p) {
    const { name } = p as { name: string };
    const org = await createOrganization({ name });
    return { success: true, message: `Created organization: ${org.name} (${org.id})` };
  },

  async create_team(p) {
    const { name, organizationId } = p as { name: string; organizationId: string };
    const team = await createTeam({ name, organizationId });
    const org = await getOrganizationById(team.organizationId);
    return { success: true, message: `Created team: ${team.name} (${team.id}) in ${org?.name ?? team.organizationId}` };
  },

  async create_collection(p) {
    const { name, ownerType, ownerId, collectionType, description } = p as {
      name: string;
      ownerType: string;
      ownerId: string;
      collectionType?: string;
      description?: string;
    };
    const collection = await createCollection({
      name,
      ownerType: ownerType as "organization" | "team" | "person",
      ownerId,
      collectionType: collectionType as "goals" | "projects" | "quarterly" | "backlog" | "operations" | "other" | undefined,
      description,
    });
    const ownerLabel = await resolveOwnerName(ownerType, ownerId);
    return { success: true, message: `Created collection: ${collection.name} (${collection.id}) owned by ${ownerLabel} (${ownerType})` };
  },

  async create_person(p) {
    const { firstName, lastName, email, phone, title, notes, relationshipType, teamIds } = p as {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      title?: string;
      notes?: string;
      relationshipType?: string;
      teamIds?: string[];
    };
    const person = await createPerson({
      firstName,
      lastName,
      email,
      phone,
      title,
      notes,
      relationshipType: relationshipType as RelationshipType | undefined,
      teamIds: teamIds ?? [],
    });
    return {
      success: true,
      message: `Created person: ${person.firstName} ${person.lastName} (${person.id})${person.relationshipType ? ` - ${person.relationshipType}` : ""}`,
    };
  },

  async update_person(p) {
    const { id, teamIdsToAdd, relationshipType } = p as { id: string; teamIdsToAdd?: string[]; relationshipType?: string };
    const updates: { teamIdsToAdd?: string[]; relationshipType?: RelationshipType } = {};
    if (teamIdsToAdd?.length) updates.teamIdsToAdd = teamIdsToAdd;
    if (relationshipType) updates.relationshipType = relationshipType as RelationshipType;
    const person = await updatePerson(id, updates);
    if (!person) return { success: false, message: `Person with ID ${id} not found.` };
    const details: string[] = [];
    if (teamIdsToAdd?.length) details.push(`added to teams`);
    if (relationshipType) details.push(`relationship: ${relationshipType}`);
    return {
      success: true,
      message: `Updated person: ${person.firstName} ${person.lastName}${details.length ? ` - ${details.join(", ")}` : ""}`,
    };
  },

  async create_task(p) {
    const { name, endId, areaId, withPersonIds, forPersonIds, dueDate, notes } = p as {
      name: string;
      endId?: string;
      areaId?: string;
      withPersonIds?: string[];
      forPersonIds?: string[];
      dueDate?: string;
      notes?: string;
    };
    const task = await createTask({ name, endId, areaId, withPersonIds, forPersonIds, dueDate, notes });
    return {
      success: true,
      message: `Created task: ${task.name} (${task.id})${endId ? ` for end` : ""}${areaId ? ` in area` : ""}`,
    };
  },

  async update_task(p) {
    const { id, completedAt, reopen, dueDate, actualDurationMinutes, name, endId, areaId, withPersonIds, forPersonIds, notes } = p as {
      id: string;
      completedAt?: string;
      reopen?: boolean;
      dueDate?: string;
      actualDurationMinutes?: number;
      name?: string;
      endId?: string;
      areaId?: string;
      withPersonIds?: string[];
      forPersonIds?: string[];
      notes?: string;
    };
    const updates: Record<string, unknown> = {};
    if (name != null) updates.name = name;
    if (endId !== undefined) updates.endId = endId;
    if (areaId !== undefined) updates.areaId = areaId;
    if (withPersonIds !== undefined) updates.withPersonIds = withPersonIds;
    if (forPersonIds !== undefined) updates.forPersonIds = forPersonIds;
    if (actualDurationMinutes !== undefined) updates.actualDurationMinutes = actualDurationMinutes;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (reopen) {
      updates.completedAt = null;
      updates.actualDurationMinutes = null;
    } else if (completedAt !== undefined) {
      updates.completedAt = completedAt.length === 10 ? `${completedAt}T12:00:00.000Z` : completedAt;
    }
    if (notes !== undefined) updates.notes = notes;
    const task = await updateTask(id, updates as Parameters<typeof updateTask>[1]);
    if (!task) return { success: false, message: `Task with ID ${id} not found.` };
    if (reopen) {
      return { success: true, message: `Reopened task: ${task.name}` };
    }
    return {
      success: true,
      message: task.completedAt ? `Completed task: ${task.name}` : `Updated task: ${task.name}`,
    };
  },

  async suggest_habits(p) {
    const { query, suggestions } = p as { query: string; suggestions: string[] };
    if (!suggestions?.length) return { success: false, message: "Could not generate habit suggestions." };
    const lines = suggestions.map((s, i) => `${i + 1}. ${s}`);
    return { success: true, message: `Habits that could help with "${query}":\n\n${lines.join("\n")}` };
  },

  async get_end(p) {
    const { endId } = p as { endId: string };
    const end = await getEndById(endId);
    if (!end) return { success: false, message: `End not found.` };

    // Area
    const area = end.areaId ? await getAreaById(end.areaId) : undefined;

    // Collection
    const collections = await listCollections();
    const collection = end.collectionId ? collections.find((c) => c.id === end.collectionId) : undefined;

    // Habits — split into own vs shared
    const allHabits = await listHabitsWithShared({ endId });
    const myHabits = allHabits.filter((h) => !h.isShared);
    const sharedHabits = allHabits.filter((h) => h.isShared);

    async function formatHabitLine(h: typeof allHabits[0]): Promise<string> {
      const personNames: string[] = [];
      for (const pid of h.personIds ?? []) {
        const person = await getPersonById(pid);
        personNames.push(person ? `${person.firstName} ${person.lastName}` : pid);
      }
      const meta: string[] = [];
      if (h.frequency) meta.push(h.frequency);
      if (personNames.length) meta.push(`participants: ${personNames.join(", ")}`);
      if (h.isShared && h.ownerId) {
        // Resolve owner to person name via RLS co-participant visibility
        const { getSupabase } = await import("../../store/base.js");
        const supabase = getSupabase();
        const { data: ownerPerson } = await supabase
          .from("persons")
          .select("first_name, last_name")
          .eq("linked_user_id", h.ownerId)
          .eq("relationship_type", "self")
          .single();
        const ownerName = ownerPerson ? `${ownerPerson.first_name} ${ownerPerson.last_name}` : h.ownerDisplayName ?? "unknown";
        if (!personNames.includes(ownerName)) {
          meta.push(`by ${ownerName}`);
        }
      }
      return `    - ${h.name}${meta.length ? ` (${meta.join(", ")})` : ""}`;
    }

    const myHabitLines = await Promise.all(myHabits.map(formatHabitLine));
    const sharedHabitLines = await Promise.all(sharedHabits.map(formatHabitLine));

    // Beliefs
    const { listBeliefs: listAllBeliefs } = await import("../../store/beliefs.js");
    const allBeliefs = await listAllBeliefs();
    const linkedBeliefs = allBeliefs.filter((b) => b.endIds.includes(endId));
    const beliefLines = linkedBeliefs.map((b) => `    - ${b.name}`);

    // Sharing context — determine if owner or shared recipient
    const { getUserId: currentUserId } = await import("../../store/base.js");
    const shares = await listMyShares();
    const endShares = shares.filter((s) => s.endId === endId);
    const persons = await listPersons();

    // If we have shares for this end, we're the owner
    const isOwner = endShares.length > 0;
    let sharingLine: string | undefined;

    if (isOwner) {
      // Owner sees "Shared with: ..."
      const sharedWithLines = endShares.map((s) => {
        const person = persons.find((p) => p.userId === s.sharedWithUserId);
        return person ? `    - ${person.firstName} ${person.lastName}` : `    - ${s.sharedWithEmail}`;
      });
      if (sharedWithLines.length > 0) {
        sharingLine = `  Shared with:\n${sharedWithLines.join("\n")}`;
      }
    } else {
      // Check if this is a shared end (not owned by us)
      const sharedEnds = await listSharedEnds();
      const sharedEnd = sharedEnds.find((e) => e.id === endId);
      if (sharedEnd?.ownerDisplayName) {
        sharingLine = `  Shared by: ${sharedEnd.ownerDisplayName}`;
      }
    }

    const parts = [
      `${end.name} (${end.id})`,
      area && `  Area: ${area.name}`,
      collection && `  Collection: ${collection.name}`,
      `  Created: ${end.createdAt}`,
      linkedBeliefs.length > 0 ? `  Beliefs:\n${beliefLines.join("\n")}` : undefined,
      myHabitLines.length > 0 ? `  Your habits:\n${myHabitLines.join("\n")}` : "  Your habits: (none)",
      sharedHabitLines.length > 0 ? `  Shared habits:\n${sharedHabitLines.join("\n")}` : undefined,
      sharingLine,
    ].filter(Boolean);

    return { success: true, message: parts.join("\n") };
  },

  async list_areas() {
    const areas = await listAreas();
    if (areas.length === 0) return { success: true, message: "No areas found." };
    const lines = areas.map((a) => `  ${a.name} (${a.id})`);
    return { success: true, message: `Areas:\n\n${lines.join("\n")}` };
  },

  async list_ends(p) {
    const { areaId, collectionId } = p as { areaId?: string; collectionId?: string };
    const ends = await listEnds(areaId || collectionId ? { areaId, collectionId } : undefined);
    if (ends.length === 0) {
      return { success: true, message: areaId ? "No ends found for this area." : "No ends found." };
    }
    const lines = ends.map((e) => `  ${e.name} (${e.id})`);
    return { success: true, message: `Ends:\n\n${lines.join("\n")}` };
  },

  async list_habits(p) {
    const { endId, areaId, teamId, personId } = p as {
      endId?: string;
      areaId?: string;
      teamId?: string;
      personId?: string;
    };
    let habits = await listHabits({ endId, areaId, teamId, personId });

    // Also include habits linked to ends in this area (habit → end → area)
    if (areaId && !endId) {
      const allEnds = await listEnds({ includeShared: true });
      const endIdsInArea = new Set(allEnds.filter((e) => e.areaId === areaId).map((e) => e.id));
      const allHabits = await listHabits({ personId });
      const habitIds = new Set(habits.map((h) => h.id));
      for (const h of allHabits) {
        if (!habitIds.has(h.id) && h.endIds.some((eid) => endIdsInArea.has(eid))) {
          habits.push(h);
          habitIds.add(h.id);
        }
      }
    }

    if (habits.length === 0) return { success: true, message: "No habits found." };
    const allEnds = await listEnds({ includeShared: true });
    const lines = habits.map((h) => {
      const endNames = h.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid).join(", ");
      return `  ${h.name} (${h.id}) → serves: ${endNames}`;
    });
    return { success: true, message: `Habits:\n\n${lines.join("\n")}` };
  },

  async list_shared_habits(p) {
    const { endId } = p as { endId?: string };
    const habits = await listHabitsWithShared({ endId });
    const shared = habits.filter((h) => h.isShared);
    if (shared.length === 0) return { success: true, message: "No shared habits found." };
    const allEnds = await listEnds({ includeShared: true });
    const lines = shared.map((h) => {
      const endNames = h.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid).join(", ");
      return `  ${h.name} (${h.id}) → serves: ${endNames} — shared by ${h.ownerDisplayName ?? "Unknown"}`;
    });
    return { success: true, message: `Shared habits:\n\n${lines.join("\n")}` };
  },

  async list_organizations(p) {
    const { expand } = p as { expand?: boolean };
    const orgs = await listOrganizations();
    if (orgs.length === 0) return { success: true, message: "No organizations found." };
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
    return { success: true, message: `Organizations:\n\n${sections.join("\n\n")}` };
  },

  async get_collection(p) {
    const { collectionId } = p as { collectionId: string };
    const collection = await getCollectionById(collectionId);
    if (!collection) return { success: false, message: `Collection not found.` };
    const ownerLabel = await resolveOwnerName(collection.ownerType, collection.ownerId);
    const allEnds = await listEnds();
    const ends = allEnds.filter((e) => e.collectionId === collectionId);
    const endLines = ends.map((e) => `  - ${e.name} (${e.id})`);
    const parts = [
      `${collection.name} (${collection.id})`,
      `  Owner: ${ownerLabel} (${collection.ownerType})`,
      collection.collectionType && `  Type: ${collection.collectionType}`,
      collection.description && `  Description: ${collection.description}`,
      ends.length > 0 ? `  Ends:\n${endLines.join("\n")}` : "  Ends: (none)",
    ].filter(Boolean);
    return { success: true, message: parts.join("\n") };
  },

  async update_collection(p) {
    const { collectionId, name, collectionType, description } = p as {
      collectionId: string;
      name?: string;
      collectionType?: string;
      description?: string;
    };
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (collectionType) updates.collectionType = collectionType;
    if (description) updates.description = description;
    if (Object.keys(updates).length === 0) {
      return { success: false, message: "No updates provided." };
    }
    const collection = await updateCollection(collectionId, updates);
    if (!collection) return { success: false, message: `Collection not found.` };
    const details: string[] = [];
    if (name) details.push(`renamed to "${name}"`);
    if (collectionType) details.push(`type: ${collectionType}`);
    if (description) details.push(`description updated`);
    return { success: true, message: `Updated collection: ${collection.name} - ${details.join(", ")}` };
  },

  async delete_collection(p) {
    const { collectionId } = p as { collectionId: string };
    const collection = await getCollectionById(collectionId);
    if (!collection) return { success: false, message: `Collection not found.` };
    await deleteCollection(collectionId);
    return { success: true, message: `Deleted collection: ${collection.name}` };
  },

  async list_collections(p) {
    const { ownerType, ownerId, collectionType } = p as {
      ownerType?: string;
      ownerId?: string;
      collectionType?: string;
    };
    const collections = await listCollections(
      ownerType || ownerId || collectionType ? { ownerType, ownerId, collectionType } : undefined
    );
    if (collections.length === 0) return { success: true, message: "No collections found." };
    const lines = await Promise.all(collections.map(async (c) => {
      const ownerLabel = await resolveOwnerName(c.ownerType, c.ownerId);
      return `  ${c.name} (${c.id}) - ${c.ownerType}: ${ownerLabel}${c.collectionType ? ` [${c.collectionType}]` : ""}`;
    }));
    return { success: true, message: `Collections:\n\n${lines.join("\n")}` };
  },

  async list_teams(p) {
    const { organizationId, personId } = p as { organizationId?: string; personId?: string };
    let teams = await listTeams(personId ? undefined : organizationId);
    if (personId) {
      const person = await getPersonById(personId);
      if (!person) return { success: false, message: `Person with ID ${personId} not found.` };
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
    const lines = await Promise.all(teams.map(async (t) => {
      const org = await getOrganizationById(t.organizationId);
      return `  ${t.name} (${t.id}) - Organization: ${org?.name ?? t.organizationId}`;
    }));
    return { success: true, message: `Teams:\n\n${lines.join("\n")}` };
  },

  async list_people(p) {
    const { organizationId, teamId, relationshipType } = p as {
      organizationId?: string;
      teamId?: string;
      relationshipType?: string;
    };
    const people = await listPersons({ organizationId, teamId, relationshipType });
    if (people.length === 0) return { success: true, message: "No people found." };
    const lines = await Promise.all(
      people.map(async (p) => {
        const teamNames: string[] = [];
        for (const tId of p.teamIds ?? []) {
          const team = await getTeamById(tId);
          teamNames.push(team?.name ?? tId);
        }
        const parts = [
          `${p.firstName} ${p.lastName} (${p.id})${p.userId ? " [linked account]" : ""}`,
          `  Email: ${p.email}`,
          p.phone && `  Phone: ${p.phone}`,
          p.title && `  Title: ${p.title}`,
          p.relationshipType && `  Relationship: ${p.relationshipType}`,
          teamNames.length > 0 && `  Teams: ${teamNames.join(", ")}`,
        ].filter(Boolean);
        return parts.join("\n");
      })
    );
    return { success: true, message: `People:\n\n${lines.join("\n\n")}` };
  },

  async list_actions(p) {
    const { endId, habitId, fromDate, toDate, withPersonIds, forPersonIds } = p as {
      endId?: string;
      habitId?: string;
      fromDate?: string;
      toDate?: string;
      withPersonIds?: string[];
      forPersonIds?: string[];
    };
    // Use shared-aware query when filtering by end (includes other users' actions on shared ends)
    const useShared = !!endId;
    let actions: Array<{ id: string; habitId: string; completedAt: string; actualDurationMinutes?: number; notes?: string; withPersonIds?: string[]; forPersonIds?: string[]; createdAt: string; ownerDisplayName?: string }>;

    if (useShared) {
      const sharedActions = await listActionsWithShared({ habitId, fromDate, toDate });
      actions = sharedActions.map((a) => ({ ...a, ownerDisplayName: a.ownerDisplayName }));
    } else {
      actions = await listActions({ habitId, fromDate, toDate });
    }

    // Filter to actions for habits linked to the specified end
    if (endId && !habitId) {
      const habits = await listHabitsWithShared();
      const habitIdsForEnd = new Set(
        habits.filter((h) => h.endIds.includes(endId)).map((h) => h.id)
      );
      actions = actions.filter((a) => habitIdsForEnd.has(a.habitId));
    }
    if (withPersonIds?.length) {
      const withSet = new Set(withPersonIds);
      actions = actions.filter((a) => a.withPersonIds?.some((pid) => withSet.has(pid)));
    }
    if (forPersonIds?.length) {
      const forSet = new Set(forPersonIds);
      actions = actions.filter((a) => a.forPersonIds?.some((pid) => forSet.has(pid)));
    }
    if (actions.length === 0) return { success: true, message: "No actions found." };
    const habitMap = new Map((await listHabitsWithShared()).map((h) => [h.id, h.name]));
    const lines = await Promise.all(actions.map(async (a) => {
      const habitName = habitMap.get(a.habitId) ?? a.habitId;
      const date = a.completedAt.slice(0, 10);
      const parts: string[] = [];
      if (a.actualDurationMinutes != null) parts.push(`${a.actualDurationMinutes} min`);
      if (a.withPersonIds?.length) {
        const names = await Promise.all(a.withPersonIds.map(async (pid) => {
          const p = await getPersonById(pid);
          return p ? `${p.firstName} ${p.lastName}` : pid;
        }));
        parts.push(`with ${names.join(", ")}`);
      }
      if (a.forPersonIds?.length) {
        const names = await Promise.all(a.forPersonIds.map(async (pid) => {
          const p = await getPersonById(pid);
          return p ? `${p.firstName} ${p.lastName}` : pid;
        }));
        parts.push(`for ${names.join(", ")}`);
      }
      if (a.ownerDisplayName) parts.push(`by ${a.ownerDisplayName}`);
      const extra = parts.length > 0 ? ` (${parts.join(", ")})` : "";
      return `  ${date}: ${habitName}${extra}`;
    }));
    return { success: true, message: `Actions:\n\n${lines.join("\n")}` };
  },

  async get_task(p) {
    const { taskId } = p as { taskId: string };
    const { getTaskById } = await import("../../store/tasks.js");
    const task = await getTaskById(taskId);
    if (!task) return { success: false, message: `Task not found.` };
    const area = task.areaId ? await getAreaById(task.areaId) : undefined;
    const end = task.endId ? await getEndById(task.endId) : undefined;
    const withNames = await Promise.all((task.withPersonIds ?? []).map(async (pid) => {
      const person = await getPersonById(pid);
      return person ? `${person.firstName} ${person.lastName}` : pid;
    }));
    const forNames = await Promise.all((task.forPersonIds ?? []).map(async (pid) => {
      const person = await getPersonById(pid);
      return person ? `${person.firstName} ${person.lastName}` : pid;
    }));
    const parts = [
      `${task.name} (${task.id})`,
      task.completedAt ? `  Status: completed ${task.completedAt.slice(0, 10)}` : "  Status: open",
      end && `  End: ${end.name}`,
      area && `  Area: ${area.name}`,
      task.dueDate && `  Due: ${task.dueDate}`,
      task.actualDurationMinutes != null && `  Duration: ${task.actualDurationMinutes} min`,
      withNames.length > 0 && `  With: ${withNames.join(", ")}`,
      forNames.length > 0 && `  For: ${forNames.join(", ")}`,
      task.notes && `  Notes: ${task.notes}`,
      `  Created: ${task.createdAt}`,
    ].filter(Boolean);
    return { success: true, message: parts.join("\n") };
  },

  async list_tasks(p) {
    const { endId, areaId, completed, duePeriod } = p as {
      endId?: string;
      areaId?: string;
      completed?: boolean;
      duePeriod?: string;
    };
    let tasks = await listTasks({ endId, areaId, completed });

    // Filter by due date period
    if (duePeriod) {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const weekEnd = sunday.toISOString().slice(0, 10);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      tasks = tasks.filter((t) => {
        if (!t.dueDate) return duePeriod === "overdue" ? false : false;
        if (duePeriod === "today") return t.dueDate === today;
        if (duePeriod === "tomorrow") return t.dueDate === tomorrow;
        if (duePeriod === "this_week") return t.dueDate >= today && t.dueDate <= weekEnd;
        if (duePeriod === "this_month") return t.dueDate >= today && t.dueDate <= monthEnd;
        if (duePeriod === "overdue") return t.dueDate < today && !t.completedAt;
        return true;
      });
    }

    if (tasks.length === 0) return { success: true, message: "No tasks found." };
    const lines = tasks.map((t) => {
      const status = t.completedAt ? `✓ ${t.completedAt.slice(0, 10)}` : "open";
      return `  ${t.name} (${t.id}) [${status}]${t.dueDate ? ` due:${t.dueDate}` : ""}`;
    });
    return { success: true, message: `Tasks:\n\n${lines.join("\n")}` };
  },

  async list_ends_and_habits(p) {
    const { areaId, collectionId } = p as { areaId?: string; collectionId?: string };
    if (areaId && collectionId) {
      return { success: false, message: "Provide areaId OR collectionId, not both." };
    }
    const areas = await listAreas();
    const allEnds = await listEnds();
    const allHabits = await listHabits();

    if (collectionId) {
      const collection = await getCollectionById(collectionId);
      if (!collection) return { success: false, message: `Collection with ID ${collectionId} not found.` };
      const ends = allEnds.filter((e) => e.collectionId === collectionId);
      const parts: string[] = [`## ${collection.name}`];
      for (const e of ends) {
        const habitsForEnd = allHabits.filter((h) => h.endIds.includes(e.id));
        parts.push(`  - ${e.name} (${e.id})`);
        habitsForEnd.forEach((h) => parts.push(`    - ${h.name} (${h.id})`));
      }
      if (ends.length === 0) {
        return { success: true, message: `No ends or habits in collection "${collection.name}".` };
      }
      return { success: true, message: parts.join("\n") };
    }

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
    return { success: true, message: sections.join("\n\n") };
  },

  async update_habit(p) {
    const { habitId, personIdsToAdd, personIdsToRemove, newName, frequency, durationMinutes } = p as {
      habitId: string;
      personIdsToAdd?: string[];
      personIdsToRemove?: string[];
      newName?: string;
      frequency?: string;
      durationMinutes?: number;
    };
    const { updateHabit, addHabitPersons, removeHabitPersons, getHabitById: getHabit } = await import("../../store/habits.js");

    const details: string[] = [];

    // Update basic fields
    const fieldUpdates: { name?: string; frequency?: string; durationMinutes?: number } = {};
    if (newName) fieldUpdates.name = newName;
    if (frequency) fieldUpdates.frequency = frequency;
    if (durationMinutes != null) fieldUpdates.durationMinutes = durationMinutes;

    if (Object.keys(fieldUpdates).length > 0) {
      await updateHabit(habitId, fieldUpdates);
      if (newName) details.push(`renamed to "${newName}"`);
      if (frequency) details.push(`frequency: ${frequency}`);
      if (durationMinutes != null) details.push(`duration: ${durationMinutes} min`);
    }

    // Add participants
    if (personIdsToAdd?.length) {
      await addHabitPersons(habitId, personIdsToAdd);
      const names = await Promise.all(personIdsToAdd.map(async (pid) => {
        const person = await getPersonById(pid);
        return person ? `${person.firstName} ${person.lastName}` : pid;
      }));
      details.push(`added participants: ${names.join(", ")}`);
    }

    // Remove participants
    if (personIdsToRemove?.length) {
      await removeHabitPersons(habitId, personIdsToRemove);
      const names = await Promise.all(personIdsToRemove.map(async (pid) => {
        const person = await getPersonById(pid);
        return person ? `${person.firstName} ${person.lastName}` : pid;
      }));
      details.push(`removed participants: ${names.join(", ")}`);
    }

    if (details.length === 0) {
      return { success: false, message: "No updates provided." };
    }

    const habit = await getHabit(habitId);
    return { success: true, message: `Updated habit: ${habit?.name ?? habitId} — ${details.join(", ")}` };
  },

  async delete_habit(p) {
    const { habitId } = p as { habitId: string };
    const habit = await deleteHabit(habitId);
    if (!habit) return { success: false, message: `Habit not found.` };
    return { success: true, message: `Deleted habit: ${habit.name}` };
  },

  async get_habit(p) {
    const { habitId } = p as { habitId: string };
    const habit = await getHabitById(habitId);
    if (!habit) return { success: false, message: `Habit not found.` };
    const ends = await listEnds({ includeShared: true });
    const endNames = habit.endIds.map((eid) => ends.find((e) => e.id === eid)?.name ?? eid);
    const personNames: string[] = [];
    for (const pid of habit.personIds ?? []) {
      const person = await getPersonById(pid);
      personNames.push(person ? `${person.firstName} ${person.lastName}` : pid);
    }
    const area = habit.areaId ? await getAreaById(habit.areaId) : undefined;
    const team = habit.teamId ? await getTeamById(habit.teamId) : undefined;
    const actions = await listActionsWithShared({ habitId });
    const recentActions = actions.slice(0, 5);
    const parts = [
      `${habit.name} (${habit.id})`,
      `  Ends: ${endNames.join(", ")}`,
      area && `  Area: ${area.name}`,
      team && `  Team: ${team.name}`,
      personNames.length > 0 && `  Participants: ${personNames.join(", ")}`,
      habit.frequency && `  Frequency: ${habit.frequency}`,
      habit.durationMinutes != null && `  Duration: ${habit.durationMinutes} min`,
    ].filter(Boolean);
    if (recentActions.length > 0) {
      parts.push("  Recent actions:");
      for (const a of recentActions) {
        const extra = a.actualDurationMinutes != null ? ` (${a.actualDurationMinutes} min)` : "";
        const byLine = a.isShared && a.ownerDisplayName ? ` — by ${a.ownerDisplayName}` : "";
        parts.push(`    - ${a.completedAt.slice(0, 10)}${extra}${byLine}`);
      }
    }
    return { success: true, message: parts.join("\n") };
  },

  async update_team(p) {
    const { teamId, newName } = p as { teamId: string; newName: string };
    const team = await updateTeam(teamId, { name: newName });
    if (!team) return { success: false, message: `Team not found.` };
    return { success: true, message: `Renamed team to: ${team.name}` };
  },

  async delete_task(p) {
    const { taskId } = p as { taskId: string };
    const task = await deleteTask(taskId);
    if (!task) return { success: false, message: `Task not found.` };
    return { success: true, message: `Deleted task: ${task.name}` };
  },

  async delete_person(p) {
    const { personId } = p as { personId: string };
    const person = await deletePerson(personId);
    if (!person) return { success: false, message: `Person not found.` };
    return { success: true, message: `Deleted person: ${person.firstName} ${person.lastName}` };
  },

  async delete_organization(p) {
    const { organizationId } = p as { organizationId: string };
    const org = await deleteOrganization(organizationId);
    if (!org) return { success: false, message: `Organization not found.` };
    return { success: true, message: `Deleted organization: ${org.name}` };
  },

  async delete_team(p) {
    const { teamId } = p as { teamId: string };
    const team = await deleteTeam(teamId);
    if (!team) return { success: false, message: `Team not found.` };
    return { success: true, message: `Deleted team: ${team.name}` };
  },

  async get_team(p) {
    const { teamId } = p as { teamId: string };
    const team = await getTeamById(teamId);
    if (!team) return { success: false, message: `Team not found.` };
    const org = await getOrganizationById(team.organizationId);
    const members = await listPersons({ teamId });
    const memberLines = members.map((m) => {
      const meta: string[] = [];
      if (m.relationshipType) meta.push(m.relationshipType);
      if (m.userId) meta.push("linked account");
      return `  - ${m.firstName} ${m.lastName}${meta.length ? ` [${meta.join(", ")}]` : ""}`;
    });
    const parts = [
      `${team.name} (${team.id})`,
      org && `  Organization: ${org.name}`,
      members.length > 0 ? `  Members:\n${memberLines.join("\n")}` : "  Members: (none)",
    ].filter(Boolean);
    return { success: true, message: parts.join("\n") };
  },

  async get_person(p) {
    const { personId } = p as { personId: string };
    const person = await getPersonById(personId);
    if (!person) return { success: false, message: `Person with ID ${personId} not found.` };
    const teamNames: string[] = [];
    for (const tId of person.teamIds ?? []) {
      const team = await getTeamById(tId);
      teamNames.push(team?.name ?? tId);
    }
    const parts = [
      `${person.firstName} ${person.lastName} (${person.id})${person.userId ? " [linked account]" : ""}`,
      `  Email: ${person.email}`,
      person.phone && `  Phone: ${person.phone}`,
      person.title && `  Title: ${person.title}`,
      person.relationshipType && `  Relationship: ${person.relationshipType}`,
      teamNames.length > 0 && `  Teams: ${teamNames.join(", ")}`,
      `  Created: ${person.createdAt}`,
    ].filter(Boolean);
    return { success: true, message: parts.join("\n") };
  },

  async link_person(p) {
    const { personId, email: emailOverride } = p as { personId: string; email?: string };
    const person = await getPersonById(personId);
    if (!person) return { success: false, message: `Person not found.` };

    if (person.userId) {
      return { success: true, message: `${person.firstName} ${person.lastName} is already linked to an account.` };
    }

    const lookupEmail = emailOverride ?? person.email;
    if (!lookupEmail || lookupEmail === "unknown@example.com") {
      return { success: false, message: `${person.firstName} ${person.lastName} has no email on file. Provide an email to search for their account.` };
    }

    // If email override provided, update the person's email first
    if (emailOverride && emailOverride !== person.email) {
      await updatePerson(personId, { email: emailOverride });
    }

    // Look up profile by email
    const { getSupabase } = await import("../../store/base.js");
    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", lookupEmail)
      .single();

    if (!profile) {
      return { success: false, message: `No user account found for ${lookupEmail}. They may need to sign up first.` };
    }

    await updatePerson(personId, { userId: profile.id });
    return { success: true, message: `Linked ${person.firstName} ${person.lastName} to account ${lookupEmail}.` };
  },

  async share_end(p) {
    const { endId, sharedWithUserId } = p as { endId: string; sharedWithUserId: string };
    try {
      const share = await shareEnd(endId, sharedWithUserId);
      return { success: true, message: `Shared "${share.endName}" with ${share.sharedWithEmail}` };
    } catch (error) {
      return { success: false, message: `Failed to share: ${(error as Error).message}` };
    }
  },

  async unshare_end(p) {
    const { endId, sharedWithUserId } = p as { endId: string; sharedWithUserId: string };
    try {
      const removed = await unshareEnd(endId, sharedWithUserId);
      if (removed) return { success: true, message: "Sharing removed successfully." };
      return { success: false, message: "Share not found." };
    } catch (error) {
      return { success: false, message: `Failed to unshare: ${(error as Error).message}` };
    }
  },

  async list_shared_ends() {
    const sharedEnds = await listSharedEnds();
    if (sharedEnds.length === 0) {
      return { success: true, message: "No ends have been shared with you." };
    }
    const lines = sharedEnds.map(
      (e) => `  ${e.name} (${e.id}) - shared by ${e.ownerDisplayName ?? "Unknown"}`
    );
    return { success: true, message: `Ends shared with you:\n\n${lines.join("\n")}` };
  },

  async create_belief(p) {
    const { name, description } = p as { name: string; description?: string };
    const { createBelief } = await import("../../store/beliefs.js");
    const belief = await createBelief({ name, description });
    return { success: true, message: `Created belief: ${belief.name} (${belief.id})` };
  },

  async list_beliefs() {
    const { listBeliefs } = await import("../../store/beliefs.js");
    const beliefs = await listBeliefs();
    if (beliefs.length === 0) return { success: true, message: "No beliefs found." };
    const allEnds = await listEnds({ includeShared: true });
    const lines = beliefs.map((b) => {
      const endNames = b.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid);
      const endsPart = endNames.length > 0 ? ` → ${endNames.join(", ")}` : "";
      return `  ${b.name} (${b.id})${endsPart}`;
    });
    return { success: true, message: `Beliefs:\n\n${lines.join("\n")}` };
  },

  async get_belief(p) {
    const { beliefId } = p as { beliefId: string };
    const { getBeliefById } = await import("../../store/beliefs.js");
    const belief = await getBeliefById(beliefId);
    if (!belief) return { success: false, message: `Belief not found.` };
    const allEnds = await listEnds({ includeShared: true });
    const endNames = belief.endIds.map((eid) => allEnds.find((e) => e.id === eid)?.name ?? eid);
    const parts = [
      `${belief.name} (${belief.id})`,
      belief.description && `  Description: ${belief.description}`,
      endNames.length > 0 ? `  Linked ends:\n${endNames.map((n) => `    - ${n}`).join("\n")}` : "  Linked ends: (none)",
    ].filter(Boolean);
    return { success: true, message: parts.join("\n") };
  },

  async update_belief(p) {
    const { beliefId, newName, description } = p as { beliefId: string; newName?: string; description?: string };
    const { updateBelief } = await import("../../store/beliefs.js");
    const updates: { name?: string; description?: string } = {};
    if (newName) updates.name = newName;
    if (description) updates.description = description;
    if (Object.keys(updates).length === 0) {
      return { success: false, message: "No updates provided." };
    }
    const belief = await updateBelief(beliefId, updates);
    if (!belief) return { success: false, message: `Belief not found.` };
    return { success: true, message: `Updated belief: ${belief.name}` };
  },

  async delete_belief(p) {
    const { beliefId } = p as { beliefId: string };
    const { deleteBelief } = await import("../../store/beliefs.js");
    const belief = await deleteBelief(beliefId);
    if (!belief) return { success: false, message: `Belief not found.` };
    return { success: true, message: `Deleted belief: ${belief.name}` };
  },

  async suggest_belief_links(p) {
    const { beliefId } = p as { beliefId: string };
    const { getBeliefById } = await import("../../store/beliefs.js");
    const belief = await getBeliefById(beliefId);
    if (!belief) return { success: false, message: `Belief not found.` };

    const allEnds = await listEnds({ includeShared: true });
    const alreadyLinked = new Set(belief.endIds);
    const unlinkedEnds = allEnds.filter((e) => !alreadyLinked.has(e.id));

    if (unlinkedEnds.length === 0) {
      return { success: true, message: `All ends are already linked to "${belief.name}".` };
    }

    // Ask LLM to suggest which ends align with this belief
    const { createLLMProvider } = await import("../../llm/index.js");
    const provider = createLLMProvider();

    const endsList = unlinkedEnds.map((e) => `- "${e.name}" (${e.id})`).join("\n");
    const prompt = `Given this core belief: "${belief.name}"${belief.description ? ` — ${belief.description}` : ""}

Which of these ends (aspirations/goals) align with or are motivated by this belief? Only include ends that have a meaningful connection.

Available ends:
${endsList}

Respond with ONLY a JSON array of end IDs that align. Example: ["id1", "id2"]
If none align, respond with: []`;

    const raw = await provider.complete(prompt);
    let jsonStr = raw.trim();
    const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonStr = codeBlock[1].trim();

    let suggestedIds: string[];
    try {
      suggestedIds = JSON.parse(jsonStr);
    } catch {
      return { success: false, message: `Could not parse suggestions. LLM response: ${raw.slice(0, 200)}` };
    }

    if (!Array.isArray(suggestedIds) || suggestedIds.length === 0) {
      return { success: true, message: `No ends seem to align with "${belief.name}".` };
    }

    const suggestions = suggestedIds
      .map((id) => unlinkedEnds.find((e) => e.id === id))
      .filter(Boolean);

    if (suggestions.length === 0) {
      return { success: true, message: `No ends seem to align with "${belief.name}".` };
    }

    const lines = suggestions.map((e) => `  - ${e!.name}`);
    return {
      success: true,
      message: `Suggested ends for "${belief.name}":\n\n${lines.join("\n")}\n\nTo link, say: "link [end name] to ${belief.name}"`,
    };
  },

  async link_end_to_belief(p) {
    const { endId, beliefId } = p as { endId: string; beliefId: string };
    const { linkEndToBelief, getBeliefById } = await import("../../store/beliefs.js");
    await linkEndToBelief(beliefId, endId);
    const belief = await getBeliefById(beliefId);
    const end = await getEndById(endId);
    return { success: true, message: `Linked "${end?.name}" to belief "${belief?.name}"` };
  },

  async unlink_end_from_belief(p) {
    const { endId, beliefId } = p as { endId: string; beliefId: string };
    const { unlinkEndFromBelief, getBeliefById } = await import("../../store/beliefs.js");
    await unlinkEndFromBelief(beliefId, endId);
    const belief = await getBeliefById(beliefId);
    const end = await getEndById(endId);
    return { success: true, message: `Unlinked "${end?.name}" from belief "${belief?.name}"` };
  },

  async help(p) {
    const { topic } = p as { topic?: string };
    const { getHelpText } = await import("./help.js");
    return { success: true, message: getHelpText(topic) };
  },

  async unknown() {
    return {
      success: false,
      message: `I couldn't understand that. Try phrases like "I went to the gym today for 60 minutes", "I want to be a better father", "show my habits", or "share my fitness goal with john@example.com".`,
    };
  },
};

export async function execute(
  intent: string,
  resolvedParams: ResolvedParams
): Promise<ExecuteResult> {
  const executor = executors[intent];
  if (!executor) {
    return {
      success: false,
      message: `Unknown intent: ${intent}.`,
    };
  }
  return executor(resolvedParams);
}
