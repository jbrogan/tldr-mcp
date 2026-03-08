import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Task } from "../schemas/task.js";
import type { TaskEntity } from "../schemas/task.js";

function getDataPath(): string {
  return join(process.cwd(), "data", "tasks.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadTasks(): Promise<TaskEntity[]> {
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

async function saveTasks(tasks: TaskEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(tasks, null, 2), "utf-8");
}

export async function createTask(data: Task): Promise<TaskEntity> {
  const tasks = await loadTasks();
  const entity: TaskEntity = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  tasks.push(entity);
  await saveTasks(tasks);
  return entity;
}

export async function getTaskById(id: string): Promise<TaskEntity | undefined> {
  const tasks = await loadTasks();
  return tasks.find((t) => t.id === id);
}

export async function updateTask(
  id: string,
  updates: Partial<Pick<TaskEntity, "name" | "endId" | "areaId" | "withPersonIds" | "forPersonIds" | "actualDurationMinutes" | "dueDate" | "completedAt" | "notes">>
): Promise<TaskEntity | null> {
  const tasks = await loadTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const updated = { ...tasks[index], ...updates };
  tasks[index] = updated;
  await saveTasks(tasks);
  return updated;
}

export async function listTasks(options?: {
  endId?: string;
  areaId?: string;
  completed?: boolean;
}): Promise<TaskEntity[]> {
  const tasks = await loadTasks();
  let filtered = [...tasks];
  if (options?.endId) {
    filtered = filtered.filter((t) => t.endId === options.endId);
  }
  if (options?.areaId) {
    filtered = filtered.filter((t) => t.areaId === options.areaId);
  }
  if (options?.completed !== undefined) {
    filtered = filtered.filter((t) => (t.completedAt != null) === options.completed);
  }
  return filtered;
}

export async function deleteTask(id: string): Promise<TaskEntity | null> {
  const tasks = await loadTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const [deleted] = tasks.splice(index, 1);
  await saveTasks(tasks);
  return deleted;
}
