import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AreaEntity } from "../schemas/area.js";
import { DEFAULT_AREAS } from "../schemas/area.js";

function getDataPath(): string {
  return join(process.cwd(), "data", "areas.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadAreas(): Promise<AreaEntity[]> {
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

async function saveAreas(areas: AreaEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(areas, null, 2), "utf-8");
}

async function seedIfEmpty(): Promise<AreaEntity[]> {
  const areas = await loadAreas();
  if (areas.length > 0) return areas;

  const seeded: AreaEntity[] = DEFAULT_AREAS.map((name) => ({
    id: randomUUID(),
    name,
    createdAt: new Date().toISOString(),
  }));
  await saveAreas(seeded);
  return seeded;
}

export async function listAreas(): Promise<AreaEntity[]> {
  return seedIfEmpty();
}

export async function getAreaById(id: string): Promise<AreaEntity | undefined> {
  const areas = await seedIfEmpty();
  return areas.find((a) => a.id === id);
}
