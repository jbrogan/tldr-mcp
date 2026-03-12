/**
 * Natural Language Orchestrator
 *
 * Thin pipeline: deterministic shortcuts → classify (LLM) → resolve (code) → execute (code)
 */

import { listEnds, updateEnd } from "../store/ends.js";
import { listCollections } from "../store/collections.js";
import { classify } from "./intents/classifier.js";
import { resolve } from "./intents/resolver.js";
import { execute, type ExecuteResult } from "./intents/executor.js";

export interface NLResult {
  success: boolean;
  message: string;
}

// --- Deterministic shortcuts (bypass LLM entirely) ---

function findBestMatch<T>(items: T[], name: string, getName: (t: T) => string): T | undefined {
  const lower = name.toLowerCase();
  const exact = items.find((i) => getName(i).toLowerCase() === lower);
  if (exact) return exact;
  return items.find(
    (i) => getName(i).toLowerCase().includes(lower) || lower.includes(getName(i).toLowerCase())
  );
}

/** Match "add X to Y collection", "put X in Y collection", "move X to Y collection" */
function parseAddEndToCollection(text: string): { endName: string; collectionName: string } | null {
  const trimmed = text.trim().replace(/[.!?]+$/, "");
  const addMatch = trimmed.match(/^add\s+(.+?)\s+to\s+(?:the\s+)?(.+?)\s+collection\s*$/i);
  if (addMatch) return { endName: addMatch[1].trim(), collectionName: addMatch[2].trim() };
  const putMatch = trimmed.match(/^put\s+(.+?)\s+in\s+(?:the\s+)?(.+?)\s+collection\s*$/i);
  if (putMatch) return { endName: putMatch[1].trim(), collectionName: putMatch[2].trim() };
  const moveMatch = trimmed.match(/^move\s+(.+?)\s+to\s+(?:the\s+)?(.+?)\s+collection\s*$/i);
  if (moveMatch) return { endName: moveMatch[1].trim(), collectionName: moveMatch[2].trim() };
  return null;
}

async function tryDeterministicShortcuts(text: string): Promise<NLResult | null> {
  const addToCollection = parseAddEndToCollection(text);
  if (!addToCollection) return null;

  const ends = await listEnds();
  const collections = await listCollections();
  const end = findBestMatch(ends, addToCollection.endName, (e) => e.name);
  const collection = findBestMatch(collections, addToCollection.collectionName, (c) => c.name);

  if (!end) {
    return { success: false, message: `End "${addToCollection.endName}" not found. Check the name or create it first.` };
  }
  if (!collection) {
    return { success: false, message: `Collection "${addToCollection.collectionName}" not found. Check the name or create it first.` };
  }

  const updated = await updateEnd(end.id, { collectionId: collection.id });
  return {
    success: true,
    message: `Updated end: ${updated?.name} (${updated?.id}) - added to collection ${collection.name}`,
  };
}

// --- Main orchestrator ---

export async function interpretAndExecute(text: string): Promise<NLResult> {
  // Stage 0: Deterministic shortcuts
  const shortcut = await tryDeterministicShortcuts(text);
  if (shortcut) return shortcut;

  try {
    // Stage 1: Classify intent (LLM — static prompt, no user data)
    const { intent, rawParams } = await classify(text);
    console.error(`[NL] Stage 1 — intent: ${intent}, rawParams: ${JSON.stringify(rawParams)}`);

    // Stage 2: Resolve raw params to IDs (deterministic, queries user data)
    const resolvedParams = await resolve(intent, rawParams);
    console.error(`[NL] Stage 2 — resolved: ${JSON.stringify(resolvedParams)}`);

    // Stage 3: Execute (store operations, format response)
    const result = await execute(intent, resolvedParams);
    console.error(`[NL] Stage 3 — ${result.success ? "OK" : "FAIL"}: ${result.message.slice(0, 100)}`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Error: ${msg}` };
  }
}
