import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DomainEntity } from "../schemas/domain.js";
import { DEFAULT_DOMAINS } from "../schemas/domain.js";

function getDataPath(): string {
  // Use cwd so data lives where the server was started (project root when run via CLI)
  return join(process.cwd(), "data", "domains.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadDomains(): Promise<DomainEntity[]> {
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

async function saveDomains(domains: DomainEntity[]): Promise<void> {
  await ensureDataDir();
  await writeFile(getDataPath(), JSON.stringify(domains, null, 2), "utf-8");
}

async function seedIfEmpty(): Promise<DomainEntity[]> {
  const domains = await loadDomains();
  if (domains.length > 0) return domains;

  const seeded: DomainEntity[] = DEFAULT_DOMAINS.map((name) => ({
    id: randomUUID(),
    name,
    createdAt: new Date().toISOString(),
  }));
  await saveDomains(seeded);
  return seeded;
}

export async function listDomains(): Promise<DomainEntity[]> {
  return seedIfEmpty();
}

export async function getDomainById(id: string): Promise<DomainEntity | undefined> {
  const domains = await seedIfEmpty();
  return domains.find((d) => d.id === id);
}
