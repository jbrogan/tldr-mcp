/**
 * Flow Controller — manages multi-step conversational flows.
 *
 * Stores pending flow state per user. Before classification, the orchestrator
 * checks if there's an active flow and routes the input to the flow handler
 * instead of the classifier.
 *
 * Currently supports: create_action → create_habit → link_end → link_belief
 */

import { getUserId } from "../../store/base.js";
import { createLLMProvider } from "../../llm/index.js";
import type { ExecuteResult } from "./executor.js";

export interface FlowStep {
  type: string;
  data: Record<string, unknown>;
}

interface FlowState {
  steps: FlowStep[];
  currentStep: string;
  createdAt: number;
}

// In-memory per-user flow state
const activeFlows = new Map<string, FlowState>();

const FLOW_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if there's an active flow for the current user.
 */
export function hasActiveFlow(): boolean {
  const userId = getUserId();
  const flow = activeFlows.get(userId);
  if (!flow) return false;

  // Expire stale flows
  if (Date.now() - flow.createdAt > FLOW_TTL_MS) {
    activeFlows.delete(userId);
    return false;
  }

  return true;
}

/**
 * Get the active flow for the current user.
 */
export function getActiveFlow(): FlowState | undefined {
  const userId = getUserId();
  const flow = activeFlows.get(userId);
  if (!flow) return undefined;

  if (Date.now() - flow.createdAt > FLOW_TTL_MS) {
    activeFlows.delete(userId);
    return undefined;
  }

  return flow;
}

/**
 * Start a new flow for the current user.
 */
export function startFlow(currentStep: string, data: Record<string, unknown>): void {
  const userId = getUserId();
  activeFlows.set(userId, {
    steps: [{ type: currentStep, data }],
    currentStep,
    createdAt: Date.now(),
  });
}

/**
 * Advance the flow to the next step.
 */
export function advanceFlow(nextStep: string, data: Record<string, unknown>): void {
  const userId = getUserId();
  const flow = activeFlows.get(userId);
  if (!flow) return;

  flow.steps.push({ type: nextStep, data });
  flow.currentStep = nextStep;
}

/**
 * End the current flow.
 */
export function endFlow(): void {
  const userId = getUserId();
  activeFlows.delete(userId);
}

/**
 * Get accumulated data from all steps in the flow.
 */
export function getFlowData(): Record<string, unknown> {
  const flow = getActiveFlow();
  if (!flow) return {};

  const merged: Record<string, unknown> = {};
  for (const step of flow.steps) {
    Object.assign(merged, step.data);
  }
  return merged;
}

// Cancel phrases — user wants to abandon the flow
const CANCEL_PHRASES = new Set([
  "cancel", "nevermind", "never mind", "stop", "quit", "no", "nope", "skip", "forget it",
]);

/**
 * Check if user input is a cancel command.
 */
export function isCancelPhrase(text: string): boolean {
  return CANCEL_PHRASES.has(text.toLowerCase().trim());
}

/**
 * Handle input during an active flow.
 * Returns an ExecuteResult if handled, or null if the input should
 * be routed to normal classification (e.g., it looks like a new command).
 */
export async function handleFlowInput(text: string): Promise<ExecuteResult | null> {
  const flow = getActiveFlow();
  if (!flow) return null;

  // Cancel
  if (isCancelPhrase(text)) {
    endFlow();
    return { success: true, message: "Flow cancelled." };
  }

  const handler = flowHandlers[flow.currentStep];
  if (!handler) {
    endFlow();
    return null;
  }

  return handler(text, flow);
}

// --- Flow step handlers ---

type FlowHandler = (input: string, flow: FlowState) => Promise<ExecuteResult | null>;

/**
 * Use LLM to suggest end names based on a habit name.
 */
async function suggestEndNames(habitName: string, existingEndNames: string[]): Promise<string[]> {
  try {
    const provider = createLLMProvider();
    const existingList = existingEndNames.length > 0
      ? `\nExisting ends (do NOT repeat these): ${existingEndNames.join(", ")}`
      : "";
    const prompt = `Given a habit called "${habitName}", suggest 2-3 concise end/aspiration names that this habit could serve. An end is an ongoing aspiration like "Be a great father" or "Stay physically fit".${existingList}

Respond with ONLY a JSON array of strings. Example: ["Learn Guitar", "Develop Musical Skills"]`;

    const raw = await provider.complete(prompt);
    let jsonStr = raw.trim();
    const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonStr = codeBlock[1].trim();
    const suggestions = JSON.parse(jsonStr);
    return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
  } catch {
    return []; // Fail silently — suggestions are optional
  }
}

/**
 * Use LLM to suggest belief names based on an end name.
 */
async function suggestBeliefNames(endName: string, existingBeliefNames: string[]): Promise<string[]> {
  try {
    const provider = createLLMProvider();
    const existingList = existingBeliefNames.length > 0
      ? `\nExisting beliefs (do NOT repeat these): ${existingBeliefNames.join(", ")}`
      : "";
    const prompt = `Given an aspiration/end called "${endName}", suggest 2-3 concise core belief statements that could motivate this aspiration. A belief is a fundamental value like "Family comes first" or "Health is the foundation for everything".${existingList}

Respond with ONLY a JSON array of strings. Example: ["Family comes first", "Being present matters"]`;

    const raw = await provider.complete(prompt);
    let jsonStr = raw.trim();
    const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonStr = codeBlock[1].trim();
    const suggestions = JSON.parse(jsonStr);
    return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
  } catch {
    return [];
  }
}

const flowHandlers: Record<string, FlowHandler> = {
  async confirm_create_habit(input, flow) {
    const lower = input.toLowerCase().trim();

    // Yes — create the habit, record the action, and ask about end
    if (lower === "yes" || lower === "y" || lower === "sure" || lower === "ok" || lower === "yeah") {
      const { createHabit } = await import("../../store/habits.js");
      const { createAction } = await import("../../store/actions.js");
      const { listEnds } = await import("../../store/ends.js");
      const { getSelfPerson } = await import("../../store/persons.js");

      const data = getFlowData();
      const selfPerson = await getSelfPerson();
      const personIds = selfPerson ? [selfPerson.id] : [];

      // Create habit with no end for now
      const habit = await createHabit({
        name: data.habitName as string,
        endIds: [],
        frequency: data.frequency as string | undefined,
        durationMinutes: data.durationMinutes as number | undefined,
        personIds,
      });

      // Record the original action
      const completedDate = data.completedDate as string;
      const completedAt = completedDate && completedDate.length === 10
        ? `${completedDate}T12:00:00.000Z`
        : completedDate || new Date().toISOString();
      await createAction({
        habitId: habit.id,
        completedAt,
        actualDurationMinutes: data.durationMinutes as number | undefined,
        notes: data.notes as string | undefined,
      });

      advanceFlow("ask_end", { habitId: habit.id, habitName: habit.name });

      const ends = await listEnds();
      const existingEndNames = ends.map((e) => e.name);
      const suggestions = await suggestEndNames(habit.name, existingEndNames);
      const suggestLines = suggestions.length > 0
        ? `\nSuggested new ends:\n${suggestions.map((s) => `  - ${s}`).join("\n")}\n`
        : "";

      if (ends.length === 0) {
        advanceFlow("ask_create_end", { habitId: habit.id });
        return {
          success: true,
          message: `Created habit: ${habit.name} and recorded action.\n\nWhat end (aspiration) does this habit serve?${suggestLines}\nType a name to create it.`,
        };
      }

      const endNameLines = ends.map((e) => `  - ${e.name}`).join("\n");
      return {
        success: true,
        message: `Created habit: ${habit.name} and recorded action.\n\nWhich end does this habit serve?\n\nExisting ends:\n${endNameLines}${suggestLines}\nType a name to link or create.`,
      };
    }

    // No — cancel flow, but still log the action if we can
    endFlow();
    return { success: true, message: "OK, no habit created. Action was not recorded." };
  },

  async ask_end(input, _flow) {
    const { listEnds } = await import("../../store/ends.js");
    const { createEnd } = await import("../../store/ends.js");
    const { listBeliefs } = await import("../../store/beliefs.js");

    const data = getFlowData();
    const habitId = data.habitId as string;

    // Try to match input to an existing end
    const ends = await listEnds();
    const lower = input.toLowerCase().trim();
    const match = ends.find(
      (e) => e.name.toLowerCase() === lower ||
        e.name.toLowerCase().includes(lower) ||
        lower.includes(e.name.toLowerCase())
    );

    let endId: string;
    let endName: string;

    const supabase = (await import("../../store/base.js")).getSupabase();
    let isNewEnd = false;

    if (match) {
      endId = match.id;
      endName = match.name;
    } else {
      // Create new end
      const newEnd = await createEnd({ name: input.trim() });
      endId = newEnd.id;
      endName = newEnd.name;
      isNewEnd = true;
    }

    // Link habit to end
    await supabase.from("habit_ends").insert({ habit_id: habitId, end_id: endId });
    const linkedMsg = isNewEnd ? `Created end: ${endName} and linked to habit.` : `Linked habit to "${endName}".`;

    // Check if this end has any belief links
    const beliefs = await listBeliefs();
    const endHasBeliefs = beliefs.some((b) => b.endIds.includes(endId));

    if (!isNewEnd && endHasBeliefs) {
      // Existing end already linked to beliefs — done
      endFlow();
      return { success: true, message: `${linkedMsg} Done!` };
    }

    // Ask about beliefs: existing end without beliefs, or new end
    advanceFlow("ask_belief", { endId, endName });

    const existingBeliefNames = beliefs.map((b) => b.name);
    const beliefSuggestions = await suggestBeliefNames(endName, existingBeliefNames);
    const suggestLines = beliefSuggestions.length > 0
      ? `\nSuggested beliefs:\n${beliefSuggestions.map((s) => `  - ${s}`).join("\n")}\n`
      : "";

    if (beliefs.length > 0) {
      const beliefNameLines = beliefs.map((b) => `  - ${b.name}`).join("\n");
      return {
        success: true,
        message: `${linkedMsg}\n\nDoes this end connect to any of your beliefs?\n\nExisting beliefs:\n${beliefNameLines}${suggestLines}\nType a name to link or create. "skip" to finish.`,
      };
    }

    // No beliefs exist — prompt to create one
    return {
      success: true,
      message: `${linkedMsg}\n\nYou don't have any core beliefs yet. A belief is a core value that motivates your ends.${suggestLines}\nType a belief to create, or "skip" to finish.`,
    };
  },

  async ask_belief(input, _flow) {
    const { listBeliefs, linkEndToBelief, createBelief } = await import("../../store/beliefs.js");

    const lower = input.toLowerCase().trim();

    // Skip
    if (lower === "skip" || lower === "none" || lower === "done") {
      endFlow();
      return { success: true, message: "Done!" };
    }

    const data = getFlowData();
    const endId = data.endId as string;
    const endName = data.endName as string;

    // Try to match an existing belief
    const beliefs = await listBeliefs();
    const match = beliefs.find(
      (b) => b.name.toLowerCase() === lower ||
        b.name.toLowerCase().includes(lower) ||
        lower.includes(b.name.toLowerCase())
    );

    if (match) {
      await linkEndToBelief(match.id, endId);
      endFlow();
      return {
        success: true,
        message: `Linked "${endName}" to belief "${match.name}". Done!`,
      };
    }

    // No match — create a new belief and link it
    const newBelief = await createBelief({ name: input.trim() });
    await linkEndToBelief(newBelief.id, endId);
    endFlow();
    return {
      success: true,
      message: `Created belief: "${newBelief.name}" and linked to "${endName}". Done!`,
    };
  },

  async ask_create_end(input, _flow) {
    const { createEnd } = await import("../../store/ends.js");
    const { listBeliefs } = await import("../../store/beliefs.js");

    const data = getFlowData();
    const habitId = data.habitId as string;

    // Create the end
    const newEnd = await createEnd({ name: input.trim() });

    // Link habit to end
    const supabase = (await import("../../store/base.js")).getSupabase();
    await supabase.from("habit_ends").insert({ habit_id: habitId, end_id: newEnd.id });

    // Ask about beliefs for newly created end
    const beliefs = await listBeliefs();
    advanceFlow("ask_belief", { endId: newEnd.id, endName: newEnd.name });

    const existingBeliefNames = beliefs.map((b) => b.name);
    const beliefSuggestions = await suggestBeliefNames(newEnd.name, existingBeliefNames);
    const suggestLines = beliefSuggestions.length > 0
      ? `\nSuggested beliefs:\n${beliefSuggestions.map((s) => `  - ${s}`).join("\n")}\n`
      : "";

    if (beliefs.length > 0) {
      const beliefNameLines = beliefs.map((b) => `  - ${b.name}`).join("\n");
      return {
        success: true,
        message: `Created end: ${newEnd.name} and linked to habit.\n\nDoes this end connect to any of your beliefs?\n\nExisting beliefs:\n${beliefNameLines}${suggestLines}\nType a name to link or create. "skip" to finish.`,
      };
    }

    return {
      success: true,
      message: `Created end: ${newEnd.name} and linked to habit.\n\nYou don't have any core beliefs yet. A belief is a core value that motivates your ends.${suggestLines}\nType a belief to create, or "skip" to finish.`,
    };
  },
};
