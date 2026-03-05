import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Team } from "../schemas/team.js";
import type { TeamEntity } from "../schemas/team.js";

function getDataPath(): string {
  return join(process.cwd(), "data", "teams.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadTeams(): Promise<TeamEntity[]> {
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

async function saveTeams(teams: TeamEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(teams, null, 2), "utf-8");
}

export async function createTeam(data: Team): Promise<TeamEntity> {
  const teams = await loadTeams();
  const entity: TeamEntity = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  teams.push(entity);
  await saveTeams(teams);
  return entity;
}

export async function getTeamById(id: string): Promise<TeamEntity | undefined> {
  const teams = await loadTeams();
  return teams.find((t) => t.id === id);
}

export async function listTeams(organizationId?: string): Promise<TeamEntity[]> {
  const teams = await loadTeams();
  if (organizationId) {
    return teams.filter((t) => t.organizationId === organizationId);
  }
  return [...teams];
}

export async function deleteTeam(id: string): Promise<TeamEntity | null> {
  const teams = await loadTeams();
  const index = teams.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const [deleted] = teams.splice(index, 1);
  await saveTeams(teams);
  return deleted;
}

export async function listTeamsByOrganizationId(
  organizationId: string
): Promise<TeamEntity[]> {
  return listTeams(organizationId);
}

export async function deleteTeamsByOrganizationId(
  organizationId: string
): Promise<number> {
  const teams = await loadTeams();
  const toDelete = teams.filter((t) => t.organizationId === organizationId);
  if (toDelete.length === 0) return 0;
  const remaining = teams.filter((t) => t.organizationId !== organizationId);
  await saveTeams(remaining);
  return toDelete.length;
}
