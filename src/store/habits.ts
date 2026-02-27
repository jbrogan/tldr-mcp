import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Habit } from "../schemas/habit.js";
import type { HabitEntity } from "../schemas/habit.js";

function getDataPath(): string {
  return join(process.cwd(), "data", "habits.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadHabits(): Promise<HabitEntity[]> {
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

async function saveHabits(habits: HabitEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(habits, null, 2), "utf-8");
}

export async function createHabit(data: Habit): Promise<HabitEntity> {
  const habits = await loadHabits();
  const entity: HabitEntity = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  habits.push(entity);
  await saveHabits(habits);
  return entity;
}

export async function getHabitById(id: string): Promise<HabitEntity | undefined> {
  const habits = await loadHabits();
  return habits.find((h) => h.id === id);
}

export async function listHabits(options?: {
  endId?: string;
  domainId?: string;
  organizationId?: string;
  personId?: string;
}): Promise<HabitEntity[]> {
  const habits = await loadHabits();
  if (!options) return [...habits];
  return habits.filter((h) => {
    if (options.endId && !h.endIds.includes(options.endId)) return false;
    if (options.domainId && h.domainId !== options.domainId) return false;
    if (options.organizationId && h.organizationId !== options.organizationId)
      return false;
    if (options.personId && h.personId !== options.personId) return false;
    return true;
  });
}

export async function deleteHabit(id: string): Promise<HabitEntity | null> {
  const habits = await loadHabits();
  const index = habits.findIndex((h) => h.id === id);
  if (index === -1) return null;
  const [deleted] = habits.splice(index, 1);
  await saveHabits(habits);
  return deleted;
}
