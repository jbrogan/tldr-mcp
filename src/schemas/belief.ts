import { z } from "zod";

/**
 * Belief - a core value or conviction that motivates ends.
 * Sits above ends in the hierarchy: beliefs -> ends -> habits -> actions.
 */
export const BeliefSchema = z.object({
  name: z.string().min(1, "Belief name is required"),
  description: z.string().optional(),
});

export type Belief = z.infer<typeof BeliefSchema>;

export interface BeliefEntity extends Belief {
  id: string;
  endIds: string[];
  createdAt: string;
}
