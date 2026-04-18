import { z } from "zod";

export const EndTypeEnum = z.enum(["journey", "destination", "inquiry"]);
export type EndType = z.infer<typeof EndTypeEnum>;

export const EndStateEnum = z.enum([
  "active",
  "paused",
  "archived",
  "completed",
  "abandoned",
  "resolved",
]);
export type EndState = z.infer<typeof EndStateEnum>;

/**
 * Valid states per end type.
 */
export const VALID_STATES: Record<EndType, readonly EndState[]> = {
  journey: ["active", "paused", "archived"],
  destination: ["active", "completed", "abandoned"],
  inquiry: ["active", "resolved", "abandoned"],
} as const;

/**
 * Valid state transitions per end type.
 * Maps current state → allowed target states.
 */
export const VALID_TRANSITIONS: Record<EndType, Record<string, readonly EndState[]>> = {
  journey: {
    active: ["paused", "archived"],
    paused: ["active", "archived"],
    archived: [],
  },
  destination: {
    active: ["completed", "abandoned"],
    completed: [],
    abandoned: [],
  },
  inquiry: {
    active: ["resolved", "abandoned"],
    resolved: [],
    abandoned: [],
  },
} as const;

/**
 * End - an aspiration, goal, or investigation.
 *
 * Three types:
 *  - journey: ongoing aspiration, no finish line (e.g. "Be a great father")
 *  - destination: bounded goal with a done state (e.g. "Launch LED Logo Panel")
 *  - inquiry: hypothesis under investigation (e.g. "Is this product line viable?")
 */
export const EndSchema = z.object({
  name: z.string().min(1, "End name is required"),
  areaId: z.string().optional().describe("Area this end belongs to"),
  portfolioId: z.string().optional().describe("Portfolio this end belongs to"),
  endType: EndTypeEnum.optional().describe("Type: journey | destination | inquiry"),
  state: EndStateEnum.optional().describe("Current state"),
  dueDate: z.string().optional().describe("Target date (YYYY-MM-DD)"),
  thesis: z.string().optional().describe("Inquiry thesis statement"),
  resolutionNotes: z.string().optional().describe("Inquiry resolution notes"),
});

export type End = z.infer<typeof EndSchema>;

export interface EndEntity extends End {
  id: string;
  /** Always populated from DB (NOT NULL DEFAULT). */
  endType: EndType;
  /** Always populated from DB (NOT NULL DEFAULT). */
  state: EndState;
  createdAt: string;
}

/**
 * Validate that a state is valid for the given end type.
 */
export function isValidState(endType: EndType, state: EndState): boolean {
  return VALID_STATES[endType].includes(state);
}

/**
 * Validate that a state transition is allowed.
 */
export function isValidTransition(
  endType: EndType,
  fromState: EndState,
  toState: EndState,
): boolean {
  const allowed = VALID_TRANSITIONS[endType][fromState];
  return allowed ? allowed.includes(toState) : false;
}

/**
 * Validate type-specific field constraints.
 * Returns an error message or null if valid.
 */
export function validateEndFields(
  endType: EndType,
  fields: { thesis?: string; resolutionNotes?: string },
): string | null {
  if (endType !== "inquiry") {
    if (fields.thesis) return "thesis is only valid for inquiry ends";
    if (fields.resolutionNotes) return "resolution_notes is only valid for inquiry ends";
  }
  return null;
}
