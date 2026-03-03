import { z } from "zod";

/**
 * End - an ongoing aspiration you work toward (e.g., "Be a better father", "Practice guitar").
 */
export const EndSchema = z.object({
  name: z.string().min(1, "End name is required"),
  areaId: z.string().optional().describe("Area this end belongs to"),
});

export type End = z.infer<typeof EndSchema>;

export interface EndEntity extends End {
  id: string;
  createdAt: string;
}
