import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Collection } from "../schemas/collection.js";
import type { CollectionEntity } from "../schemas/collection.js";

function getDataPath(): string {
  return join(process.cwd(), "data", "collections.json");
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dirname(getDataPath()), { recursive: true });
}

async function loadCollections(): Promise<CollectionEntity[]> {
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

async function saveCollections(
  collections: CollectionEntity[]
): Promise<void> {
  await ensureDataDir();
  await writeFile(
    getDataPath(),
    JSON.stringify(collections, null, 2),
    "utf-8"
  );
}

export async function createCollection(
  data: Collection
): Promise<CollectionEntity> {
  const collections = await loadCollections();
  const entity: CollectionEntity = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  collections.push(entity);
  await saveCollections(collections);
  return entity;
}

export async function getCollectionById(
  id: string
): Promise<CollectionEntity | undefined> {
  const collections = await loadCollections();
  return collections.find((c) => c.id === id);
}

export async function listCollections(options?: {
  ownerType?: string;
  ownerId?: string;
  collectionType?: string;
}): Promise<CollectionEntity[]> {
  const collections = await loadCollections();
  if (!options) return [...collections];
  return collections.filter((c) => {
    if (options.ownerType && c.ownerType !== options.ownerType) return false;
    if (options.ownerId && c.ownerId !== options.ownerId) return false;
    if (
      options.collectionType &&
      c.collectionType !== options.collectionType
    )
      return false;
    return true;
  });
}

export async function updateCollection(
  id: string,
  updates: Partial<Collection>
): Promise<CollectionEntity | null> {
  const collections = await loadCollections();
  const index = collections.findIndex((c) => c.id === id);
  if (index === -1) return null;
  const updated: CollectionEntity = {
    ...collections[index],
    ...updates,
    id: collections[index].id,
    createdAt: collections[index].createdAt,
  };
  collections[index] = updated;
  await saveCollections(collections);
  return updated;
}

export async function deleteCollection(
  id: string
): Promise<CollectionEntity | null> {
  const collections = await loadCollections();
  const index = collections.findIndex((c) => c.id === id);
  if (index === -1) return null;
  const [deleted] = collections.splice(index, 1);
  await saveCollections(collections);
  return deleted;
}
