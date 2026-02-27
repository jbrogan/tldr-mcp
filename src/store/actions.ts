import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Action } from "../schemas/action.js";
import type { ActionEntity } from "../schemas/action.js";

function getDataPath(): string {
  return join(process.cwd(), "data", "actions.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadActions(): Promise<ActionEntity[]> {
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

async function saveActions(actions: ActionEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(actions, null, 2), "utf-8");
}

export async function createAction(data: Action): Promise<ActionEntity> {
  const actions = await loadActions();
  const entity: ActionEntity = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  actions.push(entity);
  await saveActions(actions);
  return entity;
}

export async function listActions(options?: {
  habitId?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<ActionEntity[]> {
  const actions = await loadActions();
  let filtered = [...actions];
  if (options?.habitId) {
    filtered = filtered.filter((a) => a.habitId === options.habitId);
  }
  if (options?.fromDate || options?.toDate) {
    filtered = filtered.filter((a) => {
      const d = a.completedAt.slice(0, 10);
      if (options.fromDate && d < options.fromDate) return false;
      if (options.toDate && d > options.toDate) return false;
      return true;
    });
  }
  return filtered;
}

export async function deleteActionsByHabitId(habitId: string): Promise<number> {
  const actions = await loadActions();
  const remaining = actions.filter((a) => a.habitId !== habitId);
  if (remaining.length === actions.length) return 0;
  await saveActions(remaining);
  return actions.length - remaining.length;
}

export async function deleteAction(id: string): Promise<ActionEntity | null> {
  const actions = await loadActions();
  const index = actions.findIndex((a) => a.id === id);
  if (index === -1) return null;
  const [deleted] = actions.splice(index, 1);
  await saveActions(actions);
  return deleted;
}
