/**
 * Intent Classifier (Stage 1)
 *
 * Sends a static-size prompt to the LLM with only intent definitions.
 * No user data (IDs, entity lists) is included.
 * Returns the classified intent and raw extracted parameters.
 */

import { createLLMProvider } from "../../llm/index.js";
import { INTENT_CATALOG } from "./catalog.js";

export interface ClassifiedIntent {
  intent: string;
  rawParams: Record<string, unknown>;
}

function buildPrompt(userText: string): string {
  const intentLines = INTENT_CATALOG.map((def) => {
    const params = def.rawParams
      .map((p) => {
        const req = p.required ? ", REQUIRED" : "";
        const desc = p.description ? `: ${p.description}` : "";
        return `${p.name} (${p.type}${req}${desc})`;
      })
      .join("; ");
    return `- ${def.name}: ${def.description}${params ? `\n  Extract: ${params}` : ""}`;
  }).join("\n");

  const today = new Date().toISOString().slice(0, 10);

  return `Respond with ONLY valid JSON. Classify the user's intent and extract raw parameters (names, not IDs).

{
  "intent": "<intent_name>",
  "params": { ... }
}

Available intents:
${intentLines}

ROUTING RULES:
- "Add X to Y collection" / "Put X in Y" / "Move X to Y" -> update_end (NOT create_collection or create_end)
- "What teams is NAME in?" / "NAME's teams" / "teams for NAME" -> list_teams with personName (NOT organizationName, NOT get_person or list_people)
- When user says "me", "I", "my", "myself" for a person reference -> use the literal string "__self__"
- "__self__" is ONLY valid for personName/personNames/ownerName fields. NEVER put "__self__" in endName, endNames, habitName, teamName, areaName, organizationName, or collectionName.
- Only include "__self__" or personName when the user EXPLICITLY mentions a person by name or says "me"/"my"/"I". Do NOT infer personName from context. "list habits for [end]", "list teams in [org]" should NOT include personName.
- When user says "with [names]" while recording an action -> MUST include withPersonNames
- When user says "for [name]" while recording an action -> MUST include forPersonNames
- Preserve full task descriptions including reason/purpose (e.g. "call Alex to discuss security deposit" NOT "call Alex")
- When creating a habit with "for X", ALWAYS put X in endNames, NOT areaName. Only set areaName if the user explicitly says "in [area] area" or uses a well-known area name like Career, Family, Health, etc. NEVER leave endNames empty if the user mentions "for [something]".
- "what is X?" / "how does X work?" / "explain X" / "help" -> help intent (conceptual questions about the system). NOT help when user wants their actual data — "what are my habits?" -> list_habits, "show my ends" -> list_ends

Today's date: ${today}

User said: "${userText}"

JSON response:`;
}

export async function classify(text: string): Promise<ClassifiedIntent> {
  const prompt = buildPrompt(text);
  const provider = createLLMProvider();
  const raw = await provider.complete(prompt);

  let jsonStr = raw.trim();
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();

  let parsed: { intent: string; params?: Record<string, unknown> };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Could not parse LLM response: ${raw.slice(0, 200)}`);
  }

  return {
    intent: parsed.intent,
    rawParams: parsed.params ?? {},
  };
}
