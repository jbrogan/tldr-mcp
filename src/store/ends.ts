import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { End } from "../schemas/end.js";
import type { EndEntity } from "../schemas/end.js";

function getDataPath(): string {
  return join(process.cwd(), "data", "ends.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadEnds(): Promise<EndEntity[]> {
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

async function saveEnds(ends: EndEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(ends, null, 2), "utf-8");
}

export async function createEnd(data: End): Promise<EndEntity> {
  const ends = await loadEnds();
  const entity: EndEntity = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  ends.push(entity);
  await saveEnds(ends);
  return entity;
}

export async function getEndById(id: string): Promise<EndEntity | undefined> {
  const ends = await loadEnds();
  return ends.find((e) => e.id === id);
}

export async function listEnds(areaId?: string): Promise<EndEntity[]> {
  const ends = await loadEnds();
  if (areaId) return ends.filter((e) => e.areaId === areaId);
  return [...ends];
}

export async function deleteEnd(id: string): Promise<EndEntity | null> {
  const ends = await loadEnds();
  const index = ends.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const [deleted] = ends.splice(index, 1);
  await saveEnds(ends);
  return deleted;
}
