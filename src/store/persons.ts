import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Person } from "../schemas/person.js";
import type { PersonEntity } from "../schemas/person.js";
import { listTeams } from "./teams.js";

function getDataPath(): string {
  // Use cwd so data lives where the server was started (project root when run via CLI)
  return join(process.cwd(), "data", "persons.json");
}

async function ensureDataDir(): Promise<void> {
  const dataPath = getDataPath();
  await mkdir(dirname(dataPath), { recursive: true });
}

function normalizePerson(p: Record<string, unknown>): PersonEntity {
  const { organizationIds: _omit, ...rest } = p;
  return {
    ...rest,
    teamIds: Array.isArray(p.teamIds) ? p.teamIds : [],
    userId: typeof p.userId === "string" ? p.userId : undefined,
  } as PersonEntity;
}

async function loadPersons(): Promise<PersonEntity[]> {
  try {
    const data = await readFile(getDataPath(), "utf-8");
    const parsed = JSON.parse(data);
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr.map(normalizePerson);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function savePersons(persons: PersonEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(persons, null, 2), "utf-8");
}

export async function createPerson(data: Person): Promise<PersonEntity> {
  const persons = await loadPersons();
  const entity: PersonEntity = {
    ...data,
    teamIds: data.teamIds ?? [],
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  persons.push(entity);
  await savePersons(persons);
  return entity;
}

export async function getPersonById(id: string): Promise<PersonEntity | undefined> {
  const persons = await loadPersons();
  return persons.find((p) => p.id === id);
}

/** Returns the person with relationshipType "self" (the current user). Used to resolve "me"/"I" in NL. */
export async function getSelfPerson(): Promise<PersonEntity | undefined> {
  const persons = await listPersons({ relationshipType: "self" });
  return persons[0];
}

/** Removes a team from all persons' membership. Call before deleting a team. */
export async function removeTeamFromAllPersons(teamId: string): Promise<void> {
  const persons = await loadPersons();
  let changed = false;
  for (const p of persons) {
    const ids = p.teamIds ?? [];
    if (ids.includes(teamId)) {
      (p as PersonEntity).teamIds = ids.filter((id) => id !== teamId);
      changed = true;
    }
  }
  if (changed) await savePersons(persons);
}

export type PersonUpdate = Partial<Omit<Person, "teamIds">> & {
  teamIds?: string[];
  /** When provided, merges these team IDs with existing (add-only). Ignored if teamIds is also set. */
  teamIdsToAdd?: string[];
};

export async function updatePerson(
  id: string,
  updates: PersonUpdate
): Promise<PersonEntity | null> {
  const persons = await loadPersons();
  const index = persons.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const existing = persons[index];
  const existingTeamIds = existing.teamIds ?? [];
  let newTeamIds: string[];
  if (updates.teamIds !== undefined) {
    newTeamIds = updates.teamIds;
  } else if (updates.teamIdsToAdd?.length) {
    const toAdd = new Set(updates.teamIdsToAdd);
    newTeamIds = [...existingTeamIds];
    for (const id of toAdd) {
      if (!newTeamIds.includes(id)) newTeamIds.push(id);
    }
  } else {
    newTeamIds = existingTeamIds;
  }
  const updated: PersonEntity = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    teamIds: newTeamIds,
  };
  persons[index] = updated;
  await savePersons(persons);
  return updated;
}

export async function deletePerson(id: string): Promise<PersonEntity | null> {
  const persons = await loadPersons();
  const index = persons.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const [deleted] = persons.splice(index, 1);
  await savePersons(persons);
  return deleted;
}

export async function listPersons(options?: {
  organizationId?: string;
  teamId?: string;
  relationshipType?: string;
}): Promise<PersonEntity[]> {
  const persons = await loadPersons();
  let filtered = [...persons];

  if (options?.organizationId) {
    const teamsInOrg = await listTeams(options.organizationId);
    const teamIdsInOrg = new Set(teamsInOrg.map((t) => t.id));
    filtered = filtered.filter((p) =>
      (p.teamIds ?? []).some((id) => teamIdsInOrg.has(id))
    );
  }

  if (options?.teamId) {
    filtered = filtered.filter((p) =>
      (p.teamIds ?? []).includes(options.teamId!)
    );
  }

  if (options?.relationshipType) {
    filtered = filtered.filter(
      (p) => p.relationshipType === options.relationshipType
    );
  }

  return filtered;
}
