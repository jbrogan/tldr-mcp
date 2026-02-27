import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Person } from "../schemas/person.js";
import type { PersonEntity } from "../schemas/person.js";
import { listOrganizations } from "./organizations.js";

function getDataPath(): string {
  // Use cwd so data lives where the server was started (project root when run via CLI)
  return join(process.cwd(), "data", "persons.json");
}

async function ensureDataDir(): Promise<void> {
  const dataPath = getDataPath();
  await mkdir(dirname(dataPath), { recursive: true });
}

function normalizePerson(p: Record<string, unknown>): PersonEntity {
  return {
    ...p,
    organizationIds: Array.isArray(p.organizationIds) ? p.organizationIds : [],
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
    organizationIds: data.organizationIds ?? [],
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

/** Removes an organization from all persons' membership. Call before deleting an org. */
export async function removeOrganizationFromAllPersons(
  organizationId: string
): Promise<void> {
  const persons = await loadPersons();
  let changed = false;
  for (const p of persons) {
    const ids = p.organizationIds ?? [];
    if (ids.includes(organizationId)) {
      (p as PersonEntity).organizationIds = ids.filter((id) => id !== organizationId);
      changed = true;
    }
  }
  if (changed) await savePersons(persons);
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

export type PersonUpdate = Partial<Omit<Person, "organizationIds" | "groupIds">> & {
  organizationIds?: string[];
  groupIds?: string[];
};

export async function updatePerson(
  id: string,
  updates: PersonUpdate
): Promise<PersonEntity | null> {
  const persons = await loadPersons();
  const index = persons.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const existing = persons[index];
  const updated: PersonEntity = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    organizationIds: updates.organizationIds ?? existing.organizationIds ?? [],
    groupIds: updates.groupIds ?? existing.groupIds ?? [],
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
  domainId?: string;
  organizationId?: string;
  groupId?: string;
  relationshipType?: string;
}): Promise<PersonEntity[]> {
  const persons = await loadPersons();
  let filtered = [...persons];

  if (options?.organizationId) {
    filtered = filtered.filter((p) =>
      (p.organizationIds ?? []).includes(options.organizationId!)
    );
  } else if (options?.domainId) {
    const orgs = await listOrganizations(options.domainId);
    const orgIds = new Set(orgs.map((o) => o.id));
    filtered = filtered.filter((p) =>
      (p.organizationIds ?? []).some((id) => orgIds.has(id))
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
