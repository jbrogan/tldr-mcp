/**
 * Intent Resolver (Stage 2)
 *
 * Deterministically resolves raw string parameters (names, date expressions)
 * into concrete IDs, dates, and validated enums by querying the user's data.
 * No LLM calls — purely code-based resolution.
 */

import { listHabits } from "../../store/habits.js";
import { listEnds } from "../../store/ends.js";
import { listAreas } from "../../store/areas.js";
import { listOrganizations } from "../../store/organizations.js";
import { listTeams } from "../../store/teams.js";
import { listCollections } from "../../store/collections.js";
import { listTasks } from "../../store/tasks.js";
import { listPersons, getSelfPerson, getPersonById } from "../../store/persons.js";

const SELF_PLACEHOLDER = "__self__";

// --- Shared resolution helpers ---

function findBestMatch<T>(items: T[], name: string, getName: (t: T) => string): T | undefined {
  const lower = name.toLowerCase();
  const exact = items.find((i) => getName(i).toLowerCase() === lower);
  if (exact) return exact;
  return items.find(
    (i) => getName(i).toLowerCase().includes(lower) || lower.includes(getName(i).toLowerCase())
  );
}

function resolveDate(expr: string | undefined): string | undefined {
  if (!expr) return undefined;
  const lower = expr.toLowerCase().trim();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (lower === "today") return today;
  if (lower === "yesterday") {
    return new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  }
  if (lower === "tomorrow") {
    return new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  }
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower;
  return lower;
}

function resolvePeriod(period: string): { fromDate: string; toDate: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

  switch (period) {
    case "today":
      return { fromDate: today, toDate: today };
    case "yesterday":
      return { fromDate: yesterday, toDate: yesterday };
    case "this_week": {
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        fromDate: monday.toISOString().slice(0, 10),
        toDate: sunday.toISOString().slice(0, 10),
      };
    }
    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        fromDate: firstDay.toISOString().slice(0, 10),
        toDate: lastDay.toISOString().slice(0, 10),
      };
    }
    default:
      return { fromDate: today, toDate: today };
  }
}

async function resolveSelf(): Promise<string> {
  const self = await getSelfPerson();
  if (!self) {
    throw new Error(
      'No person with relationshipType "self" found. Create yourself first with relationshipType "self".'
    );
  }
  return self.id;
}

async function resolvePersonName(name: string): Promise<string | undefined> {
  if (name === SELF_PLACEHOLDER) return resolveSelf();
  const persons = await listPersons();
  const match = findBestMatch(persons, name, (p) => `${p.firstName} ${p.lastName}`)
    ?? findBestMatch(persons, name, (p) => p.firstName);
  return match?.id;
}

async function resolvePersonNames(names: unknown): Promise<string[] | undefined> {
  if (!Array.isArray(names) || names.length === 0) return undefined;
  const ids: string[] = [];
  for (const name of names) {
    if (typeof name !== "string") continue;
    const id = await resolvePersonName(name);
    if (id) ids.push(id);
  }
  return ids.length > 0 ? ids : undefined;
}

async function resolveAreaName(name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const areas = await listAreas();
  return findBestMatch(areas, name, (a) => a.name)?.id;
}

async function resolveEndName(name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const ends = await listEnds();
  return findBestMatch(ends, name, (e) => e.name)?.id;
}

async function resolveEndNames(names: unknown): Promise<string[] | undefined> {
  if (!Array.isArray(names) || names.length === 0) return undefined;
  const ends = await listEnds();
  const ids: string[] = [];
  for (const name of names) {
    if (typeof name !== "string") continue;
    const match = findBestMatch(ends, name, (e) => e.name);
    if (match) ids.push(match.id);
  }
  return ids.length > 0 ? ids : undefined;
}

async function resolveOrgName(name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const orgs = await listOrganizations();
  return findBestMatch(orgs, name, (o) => o.name)?.id;
}

async function resolveTeamName(name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const teams = await listTeams();
  return findBestMatch(teams, name, (t) => t.name)?.id;
}

async function resolveTeamNames(names: unknown): Promise<string[] | undefined> {
  if (!Array.isArray(names) || names.length === 0) return undefined;
  const teams = await listTeams();
  const ids: string[] = [];
  for (const name of names) {
    if (typeof name !== "string") continue;
    const match = findBestMatch(teams, name, (t) => t.name);
    if (match) ids.push(match.id);
  }
  return ids.length > 0 ? ids : undefined;
}

async function resolveCollectionName(name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const collections = await listCollections();
  return findBestMatch(collections, name, (c) => c.name)?.id;
}

async function resolveHabitName(name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const habits = await listHabits();
  return findBestMatch(habits, name, (h) => h.name)?.id;
}

async function resolveTaskName(name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  const tasks = await listTasks();
  return findBestMatch(tasks, name, (t) => t.name)?.id;
}

async function resolveOwner(
  ownerType: string | undefined,
  ownerName: string | undefined
): Promise<string | undefined> {
  if (!ownerType || !ownerName) return undefined;
  if (ownerName === SELF_PLACEHOLDER) return resolveSelf();
  switch (ownerType) {
    case "organization":
      return resolveOrgName(ownerName);
    case "team":
      return resolveTeamName(ownerName);
    case "person":
      return resolvePersonName(ownerName);
    default:
      return undefined;
  }
}

/** Infer Family area when task involves family members */
async function inferFamilyArea(personIds: string[] | undefined): Promise<string | undefined> {
  if (!personIds?.length) return undefined;
  const familyTypes = new Set(["spouse", "child", "parent", "sibling"]);
  for (const pid of personIds) {
    const person = await getPersonById(pid);
    if (person?.relationshipType && familyTypes.has(person.relationshipType)) {
      const areas = await listAreas();
      return areas.find((a) => a.name.toLowerCase() === "family")?.id;
    }
  }
  return undefined;
}

// --- Per-intent resolvers ---

export type ResolvedParams = Record<string, unknown>;

type ResolverFn = (raw: Record<string, unknown>) => Promise<ResolvedParams>;

const resolvers: Record<string, ResolverFn> = {
  async create_action(raw) {
    const habitId = await resolveHabitName(raw.habitName as string);
    if (!habitId) throw new Error(`Habit "${raw.habitName}" not found.`);
    const completedAt = resolveDate(raw.completedDate as string);
    if (!completedAt) throw new Error("Missing completion date for action.");
    return {
      habitId,
      completedAt,
      actualDurationMinutes: raw.durationMinutes as number | undefined,
      notes: raw.notes as string | undefined,
      withPersonIds: await resolvePersonNames(raw.withPersonNames),
      forPersonIds: await resolvePersonNames(raw.forPersonNames),
    };
  },

  async create_end(raw) {
    return {
      name: raw.name as string,
      areaId: await resolveAreaName(raw.areaName as string),
      collectionId: await resolveCollectionName(raw.collectionName as string),
    };
  },

  async update_end(raw) {
    const id = await resolveEndName(raw.endName as string);
    if (!id) throw new Error(`End "${raw.endName}" not found.`);
    return {
      id,
      name: raw.newName as string | undefined,
      areaId: await resolveAreaName(raw.areaName as string),
      collectionId: await resolveCollectionName(raw.collectionName as string),
    };
  },

  async create_habit(raw) {
    const endIds = await resolveEndNames(raw.endNames);
    if (!endIds?.length) throw new Error(`Could not find end(s): ${JSON.stringify(raw.endNames)}`);
    const personName = raw.personName as string | undefined;
    let personId: string | undefined;
    if (personName) {
      personId = await resolvePersonName(personName);
    } else {
      // Default to self when no person specified
      personId = await resolveSelf();
    }
    return {
      name: raw.name as string,
      endIds,
      frequency: raw.frequency as string | undefined,
      durationMinutes: raw.durationMinutes as number | undefined,
      areaId: await resolveAreaName(raw.areaName as string),
      teamId: await resolveTeamName(raw.teamName as string),
      personId,
    };
  },

  async create_organization(raw) {
    return { name: raw.name as string };
  },

  async create_team(raw) {
    const organizationId = await resolveOrgName(raw.organizationName as string);
    if (!organizationId) throw new Error(`Organization "${raw.organizationName}" not found.`);
    return { name: raw.name as string, organizationId };
  },

  async create_collection(raw) {
    const ownerType = raw.ownerType as string;
    const ownerId = await resolveOwner(ownerType, raw.ownerName as string);
    if (!ownerId) throw new Error(`Could not resolve owner "${raw.ownerName}" (${ownerType}).`);
    return {
      name: raw.name as string,
      ownerType,
      ownerId,
      collectionType: raw.collectionType as string | undefined,
      description: raw.description as string | undefined,
    };
  },

  async create_person(raw) {
    return {
      firstName: raw.firstName as string,
      lastName: raw.lastName as string,
      email: raw.email as string,
      phone: raw.phone as string | undefined,
      title: raw.title as string | undefined,
      notes: raw.notes as string | undefined,
      relationshipType: raw.relationshipType as string | undefined,
      teamIds: await resolveTeamNames(raw.teamNames),
    };
  },

  async update_person(raw) {
    const personName = raw.personName as string;
    const id = await resolvePersonName(personName);
    if (!id) throw new Error(`Person "${personName}" not found.`);
    return {
      id,
      teamIdsToAdd: await resolveTeamNames(raw.teamNamesToAdd),
    };
  },

  async create_task(raw) {
    const withPersonIds = await resolvePersonNames(raw.withPersonNames);
    const forPersonIds = await resolvePersonNames(raw.forPersonNames);
    let areaId = await resolveAreaName(raw.areaName as string);
    // Infer Family area for tasks involving family members
    if (!areaId) {
      const allPersonIds = [...(withPersonIds ?? []), ...(forPersonIds ?? [])];
      areaId = await inferFamilyArea(allPersonIds);
    }
    return {
      name: raw.name as string,
      endId: await resolveEndName(raw.endName as string),
      areaId,
      withPersonIds,
      forPersonIds,
      dueDate: resolveDate(raw.dueDate as string),
      notes: raw.notes as string | undefined,
    };
  },

  async update_task(raw) {
    const id = await resolveTaskName(raw.taskName as string);
    if (!id) throw new Error(`Task "${raw.taskName}" not found.`);
    return {
      id,
      completedAt: resolveDate(raw.completedDate as string),
      actualDurationMinutes: raw.durationMinutes as number | undefined,
      name: raw.name as string | undefined,
      endId: await resolveEndName(raw.endName as string),
      areaId: await resolveAreaName(raw.areaName as string),
      withPersonIds: await resolvePersonNames(raw.withPersonNames),
      forPersonIds: await resolvePersonNames(raw.forPersonNames),
      notes: raw.notes as string | undefined,
    };
  },

  async suggest_habits(raw) {
    // Generative intent — params pass through from LLM
    return {
      query: raw.query as string,
      suggestions: raw.suggestions as string[],
    };
  },

  async list_areas() {
    return {};
  },

  async list_ends(raw) {
    return {
      areaId: await resolveAreaName(raw.areaName as string),
      collectionId: await resolveCollectionName(raw.collectionName as string),
    };
  },

  async list_habits(raw) {
    const personName = raw.personName as string | undefined;
    let personId: string | undefined;
    if (personName) {
      personId = await resolvePersonName(personName);
    } else {
      // Default to self — all habits have a personId after backfill
      personId = await resolveSelf();
    }
    return {
      endId: await resolveEndName(raw.endName as string),
      areaId: await resolveAreaName(raw.areaName as string),
      teamId: await resolveTeamName(raw.teamName as string),
      personId,
    };
  },

  async list_organizations(raw) {
    return { expand: raw.expand as boolean | undefined };
  },

  async list_collections(raw) {
    const ownerType = raw.ownerType as string | undefined;
    const ownerId = ownerType
      ? await resolveOwner(ownerType, raw.ownerName as string)
      : undefined;
    return {
      ownerType,
      ownerId,
      collectionType: raw.collectionType as string | undefined,
    };
  },

  async list_teams(raw) {
    const orgName = raw.organizationName as string | undefined;
    const personName = raw.personName as string | undefined;
    // If org is specified, use org filter (ignore spurious personName)
    if (orgName) {
      return {
        organizationId: await resolveOrgName(orgName),
      };
    }
    let personId: string | undefined;
    if (personName) personId = await resolvePersonName(personName);
    return { personId };
  },

  async list_people(raw) {
    const orgName = raw.organizationName as string | undefined;
    const teamName = raw.teamName as string | undefined;
    let organizationId = await resolveOrgName(orgName);
    let teamId = await resolveTeamName(teamName);
    // If classifier put a name in orgName but it's actually a team, try team lookup
    if (orgName && !organizationId) {
      teamId = teamId ?? await resolveTeamName(orgName);
    }
    // If classifier put a name in teamName but it's actually an org, try org lookup
    if (teamName && !teamId) {
      organizationId = organizationId ?? await resolveOrgName(teamName);
    }
    return {
      organizationId,
      teamId,
      relationshipType: raw.relationshipType as string | undefined,
    };
  },

  async list_actions(raw) {
    const period = raw.period as string | undefined;
    let fromDate = raw.fromDate as string | undefined;
    let toDate = raw.toDate as string | undefined;
    if (period) {
      const resolved = resolvePeriod(period);
      fromDate = resolved.fromDate;
      toDate = resolved.toDate;
    }
    return {
      habitId: await resolveHabitName(raw.habitName as string),
      fromDate,
      toDate,
    };
  },

  async list_tasks(raw) {
    return {
      endId: await resolveEndName(raw.endName as string),
      areaId: await resolveAreaName(raw.areaName as string),
      completed: raw.completed as boolean | undefined,
    };
  },

  async list_ends_and_habits(raw) {
    return {
      areaId: await resolveAreaName(raw.areaName as string),
      collectionId: await resolveCollectionName(raw.collectionName as string),
    };
  },

  async get_person(raw) {
    const personName = raw.personName as string;
    const personId = await resolvePersonName(personName);
    if (!personId) throw new Error(`Person "${personName}" not found.`);
    return { personId };
  },

  async share_end(raw) {
    const endId = await resolveEndName(raw.endName as string);
    if (!endId) throw new Error(`End "${raw.endName}" not found.`);
    return { endId, email: raw.email as string };
  },

  async unshare_end(raw) {
    const endId = await resolveEndName(raw.endName as string);
    if (!endId) throw new Error(`End "${raw.endName}" not found.`);
    return { endId, email: raw.email as string };
  },

  async list_shared_ends() {
    return {};
  },

  async unknown() {
    return {};
  },
};

export async function resolve(
  intent: string,
  rawParams: Record<string, unknown>
): Promise<ResolvedParams> {
  const resolver = resolvers[intent];
  if (!resolver) {
    throw new Error(`No resolver for intent: ${intent}`);
  }
  return resolver(rawParams);
}
