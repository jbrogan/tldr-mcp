import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Organization } from "../schemas/organization.js";
import type { OrganizationEntity } from "../schemas/organization.js";

function getDataPath(): string {
  // Use cwd so data lives where the server was started (project root when run via CLI)
  return join(process.cwd(), "data", "organizations.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadOrganizations(): Promise<OrganizationEntity[]> {
  try {
    const data = await readFile(getDataPath(), "utf-8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function saveOrganizations(orgs: OrganizationEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(orgs, null, 2), "utf-8");
}

export async function createOrganization(
  data: Organization
): Promise<OrganizationEntity> {
  const orgs = await loadOrganizations();
  const entity: OrganizationEntity = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  orgs.push(entity);
  await saveOrganizations(orgs);
  return entity;
}

export async function getOrganizationById(
  id: string
): Promise<OrganizationEntity | undefined> {
  const orgs = await loadOrganizations();
  return orgs.find((o) => o.id === id);
}

export async function listOrganizations(
  domainId?: string
): Promise<OrganizationEntity[]> {
  const orgs = await loadOrganizations();
  if (domainId) {
    return orgs.filter((o) => o.domainId === domainId);
  }
  return [...orgs];
}

export async function deleteOrganization(
  id: string
): Promise<OrganizationEntity | null> {
  const orgs = await loadOrganizations();
  const index = orgs.findIndex((o) => o.id === id);
  if (index === -1) return null;
  const [deleted] = orgs.splice(index, 1);
  await saveOrganizations(orgs);
  return deleted;
}
