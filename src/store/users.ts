import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { User } from "../schemas/user.js";
import type { UserEntity } from "../schemas/user.js";

function getDataPath(): string {
  return join(process.cwd(), "data", "users.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadUsers(): Promise<UserEntity[]> {
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

async function saveUsers(users: UserEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(users, null, 2), "utf-8");
}

export async function createUser(data: User): Promise<UserEntity> {
  const users = await loadUsers();
  const entity: UserEntity = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  users.push(entity);
  await saveUsers(users);
  return entity;
}

export async function getUserById(id: string): Promise<UserEntity | undefined> {
  const users = await loadUsers();
  return users.find((u) => u.id === id);
}

export async function getUserByEmail(email: string): Promise<UserEntity | undefined> {
  const users = await loadUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function listUsers(): Promise<UserEntity[]> {
  return loadUsers();
}

export async function deleteUser(id: string): Promise<UserEntity | null> {
  const users = await loadUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  const [deleted] = users.splice(index, 1);
  await saveUsers(users);
  return deleted;
}
