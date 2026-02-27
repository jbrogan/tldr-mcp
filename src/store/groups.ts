import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Group } from "../schemas/group.js";
import type { GroupEntity } from "../schemas/group.js";

function getDataPath(): string {
  return join(process.cwd(), "data", "groups.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadGroups(): Promise<GroupEntity[]> {
  try {
    const data = await readFile(getDataPath(), "utf-8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return [];
    throw err;
  }
}

async function saveGroups(groups: GroupEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(groups, null, 2), "utf-8");
}

export async function createGroup(data: Group): Promise<GroupEntity> {
  const groups = await loadGroups();
  const entity: GroupEntity = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  groups.push(entity);
  await saveGroups(groups);
  return entity;
}

export async function getGroupById(id: string): Promise<GroupEntity | undefined> {
  const groups = await loadGroups();
  return groups.find((g) => g.id === id);
}

export async function listGroups(organizationId?: string): Promise<GroupEntity[]> {
  const groups = await loadGroups();
  if (organizationId) {
    return groups.filter((g) => g.organizationId === organizationId);
  }
  return [...groups];
}

export async function deleteGroup(id: string): Promise<GroupEntity | null> {
  const groups = await loadGroups();
  const index = groups.findIndex((g) => g.id === id);
  if (index === -1) return null;
  const [deleted] = groups.splice(index, 1);
  await saveGroups(groups);
  return deleted;
}

export async function listGroupsByOrganizationId(
  organizationId: string
): Promise<GroupEntity[]> {
  return listGroups(organizationId);
}

export async function deleteGroupsByOrganizationId(
  organizationId: string
): Promise<number> {
  const groups = await loadGroups();
  const toDelete = groups.filter((g) => g.organizationId === organizationId);
  if (toDelete.length === 0) return 0;
  const remaining = groups.filter((g) => g.organizationId !== organizationId);
  await saveGroups(remaining);
  return toDelete.length;
}
