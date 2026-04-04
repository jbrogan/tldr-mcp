/**
 * Natural Language Orchestrator
 *
 * Thin pipeline: deterministic shortcuts → classify (LLM) → resolve (code) → execute (code)
 */

import { listEnds, updateEnd } from "../store/ends.js";
import { listPortfolios } from "../store/portfolios.js";
import { classify } from "./intents/classifier.js";
import { resolve } from "./intents/resolver.js";
import { execute, type ExecuteResult } from "./intents/executor.js";
import { hasActiveFlow, handleFlowInput, startFlow } from "./intents/flow.js";

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

/** Match "add X to Y portfolio", "put X in Y portfolio", "move X to Y portfolio" */
function parseAddEndToPortfolio(text: string): { endName: string; portfolioName: string } | null {
  const trimmed = text.trim().replace(/[.!?]+$/, "");
  const addMatch = trimmed.match(/^add\s+(.+?)\s+to\s+(?:the\s+)?(.+?)\s+portfolio\s*$/i);
  if (addMatch) return { endName: addMatch[1].trim(), portfolioName: addMatch[2].trim() };
  const putMatch = trimmed.match(/^put\s+(.+?)\s+in\s+(?:the\s+)?(.+?)\s+portfolio\s*$/i);
  if (putMatch) return { endName: putMatch[1].trim(), portfolioName: putMatch[2].trim() };
  const moveMatch = trimmed.match(/^move\s+(.+?)\s+to\s+(?:the\s+)?(.+?)\s+portfolio\s*$/i);
  if (moveMatch) return { endName: moveMatch[1].trim(), portfolioName: moveMatch[2].trim() };
  return null;
}

async function tryDeterministicShortcuts(text: string): Promise<NLResult | null> {
  const addToPortfolio = parseAddEndToPortfolio(text);
  if (!addToPortfolio) return null;

  const ends = await listEnds();
  const portfolios = await listPortfolios();
  const end = findBestMatch(ends, addToPortfolio.endName, (e) => e.name);
  const portfolio = findBestMatch(portfolios, addToPortfolio.portfolioName, (c) => c.name);

  if (!end) {
    return { success: false, message: `End "${addToPortfolio.endName}" not found. Check the name or create it first.` };
  }
  if (!portfolio) {
    return { success: false, message: `Portfolio "${addToPortfolio.portfolioName}" not found. Check the name or create it first.` };
  }

  const updated = await updateEnd(end.id, { portfolioId: portfolio.id });
  return {
    success: true,
    message: `Updated end: ${updated?.name} (${updated?.id}) - added to portfolio ${portfolio.name}`,
  };
}

// --- Main orchestrator ---

export async function interpretAndExecute(text: string): Promise<NLResult> {
  // Stage -1: Active flow check
  if (hasActiveFlow()) {
    const flowResult = await handleFlowInput(text);
    if (flowResult) {
      console.error(`[NL] Flow — ${flowResult.success ? "OK" : "FAIL"}: ${flowResult.message.slice(0, 100)}`);
      return flowResult;
    }
    // Flow returned null — input looks like a new command, fall through to normal pipeline
  }

  // Stage 0: Deterministic shortcuts
  const shortcut = await tryDeterministicShortcuts(text);
  if (shortcut) {
    console.error(`[NL] Stage 0 — deterministic shortcut: ${shortcut.success ? "OK" : "FAIL"}: ${shortcut.message.slice(0, 100)}`);
    return shortcut;
  }

  try {
    // Stage 1: Classify intent (LLM — static prompt, no user data)
    const { intent, rawParams } = await classify(text);
    console.error(`[NL] Stage 1 — intent: ${intent}, rawParams: ${JSON.stringify(rawParams)}`);

    // Stage 2: Resolve raw params to IDs (deterministic, queries user data)
    let resolvedParams;
    try {
      resolvedParams = await resolve(intent, rawParams);
    } catch (resolveErr) {
      // If create_action failed because habit not found, start guided flow
      const msg = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
      if (intent === "create_action" && msg.includes("not found")) {
        const habitName = rawParams.habitName as string;
        const completedDate = rawParams.completedDate as string;
        const durationMinutes = rawParams.durationMinutes as number | undefined;
        const notes = rawParams.notes as string | undefined;

        startFlow("confirm_create_habit", {
          habitName,
          completedDate,
          durationMinutes: typeof durationMinutes === "number" ? durationMinutes : undefined,
          notes,
          originalText: text,
        });

        console.error(`[NL] Flow started — no habit "${habitName}", asking to create`);
        return {
          success: true,
          message: `I don't have a habit called "${habitName}". Would you like me to create it? (yes/no)`,
        };
      }
      throw resolveErr;
    }
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
