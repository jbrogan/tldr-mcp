import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Person } from "../schemas/person.js";
import type { PersonEntity } from "../schemas/person.js";
import { listGroups } from "./groups.js";

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
    groupIds: Array.isArray(p.groupIds) ? p.groupIds : [],
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
    groupIds: data.groupIds ?? [],
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

/** Removes a group from all persons' membership. Call before deleting a group. */
export async function removeGroupFromAllPersons(groupId: string): Promise<void> {
  const persons = await loadPersons();
  let changed = false;
  for (const p of persons) {
    const ids = p.groupIds ?? [];
    if (ids.includes(groupId)) {
      (p as PersonEntity).groupIds = ids.filter((id) => id !== groupId);
      changed = true;
    }
  }
  if (changed) await savePersons(persons);
}

export type PersonUpdate = Partial<Omit<Person, "groupIds">> & {
  groupIds?: string[];
  /** When provided, merges these group IDs with existing (add-only). Ignored if groupIds is also set. */
  groupIdsToAdd?: string[];
};

export async function updatePerson(
  id: string,
  updates: PersonUpdate
): Promise<PersonEntity | null> {
  const persons = await loadPersons();
  const index = persons.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const existing = persons[index];
  const existingGroupIds = existing.groupIds ?? [];
  let newGroupIds: string[];
  if (updates.groupIds !== undefined) {
    newGroupIds = updates.groupIds;
  } else if (updates.groupIdsToAdd?.length) {
    const toAdd = new Set(updates.groupIdsToAdd);
    newGroupIds = [...existingGroupIds];
    for (const id of toAdd) {
      if (!newGroupIds.includes(id)) newGroupIds.push(id);
    }
  } else {
    newGroupIds = existingGroupIds;
  }
  const updated: PersonEntity = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    groupIds: newGroupIds,
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
  groupId?: string;
  relationshipType?: string;
}): Promise<PersonEntity[]> {
  const persons = await loadPersons();
  let filtered = [...persons];

  if (options?.organizationId) {
    const groupsInOrg = await listGroups(options.organizationId);
    const groupIdsInOrg = new Set(groupsInOrg.map((g) => g.id));
    filtered = filtered.filter((p) =>
      (p.groupIds ?? []).some((id) => groupIdsInOrg.has(id))
    );
  }

  if (options?.groupId) {
    filtered = filtered.filter((p) =>
      (p.groupIds ?? []).includes(options.groupId!)
    );
  }

  if (options?.relationshipType) {
    filtered = filtered.filter(
      (p) => p.relationshipType === options.relationshipType
    );
  }

  return filtered;
}
