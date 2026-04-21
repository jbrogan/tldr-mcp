/**
 * Server-side recurrence computation.
 *
 * Two-tier approach:
 * 1. Fast regex parser for common patterns (free, instant).
 * 2. LLM fallback for anything the regex can't handle (e.g. "second tuesday",
 *    "twice a week", "every other month").
 *
 * The MCP tool caller (Claude/etc.) is the primary compute path for nextDueAt.
 * This module is the server-side safety net — belts and suspenders.
 */

import Anthropic from "@anthropic-ai/sdk";

/**
 * Compute the next due date from a recurrence string and a reference date.
 * Tries the fast regex parser first; falls back to an LLM call for
 * unusual patterns.
 *
 * @param recurrence - Natural language recurrence (e.g. "weekly", "every 6 weeks")
 * @param fromDate - Reference date as ISO string (completion date or created_at)
 * @returns ISO string of the next due date, or null if computation fails
 */
export async function computeNextDueAt(
  recurrence: string,
  fromDate: string,
): Promise<string | null> {
  // Try fast regex parser first
  const fast = computeNextDueAtFast(recurrence, fromDate);
  if (fast) return fast;

  // Fall back to LLM for complex patterns
  return computeNextDueAtWithLLM(recurrence, fromDate);
}

/**
 * Fast regex-based parser for common recurrence patterns.
 * Returns null if the pattern isn't recognized.
 */
function computeNextDueAtFast(recurrence: string, fromDate: string): string | null {
  const from = new Date(fromDate);
  if (isNaN(from.getTime())) return null;

  const normalized = recurrence.trim().toLowerCase();

  // Direct keywords
  if (normalized === "daily") return addDays(from, 1);
  if (normalized === "weekly") return addDays(from, 7);
  if (normalized === "biweekly" || normalized === "bi-weekly") return addDays(from, 14);
  if (normalized === "semi-monthly" || normalized === "semimonthly") return addDays(from, 14);
  if (normalized === "monthly") return addMonths(from, 1);
  if (normalized === "quarterly") return addMonths(from, 3);
  if (normalized === "yearly" || normalized === "annually") return addMonths(from, 12);

  // "every N <unit>" pattern
  const everyMatch = normalized.match(/^every\s+(\d+)\s+(day|week|month|year)s?$/);
  if (everyMatch) {
    const n = parseInt(everyMatch[1], 10);
    const unit = everyMatch[2];
    if (unit === "day") return addDays(from, n);
    if (unit === "week") return addDays(from, n * 7);
    if (unit === "month") return addMonths(from, n);
    if (unit === "year") return addMonths(from, n * 12);
  }

  return null;
}

/**
 * LLM-based recurrence computation for patterns the regex can't handle.
 * Makes a single focused API call to interpret the recurrence string.
 */
async function computeNextDueAtWithLLM(
  recurrence: string,
  fromDate: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[recurrence] ANTHROPIC_API_KEY not set, cannot compute nextDueAt via LLM");
    return null;
  }

  try {
    const refDate = fromDate.slice(0, 10); // YYYY-MM-DD for clarity
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: `Given the recurrence "${recurrence}" and the reference date ${refDate}, what is the next occurrence date? Return ONLY the date in YYYY-MM-DD format, nothing else.`,
        },
      ],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const match = text.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!match) {
      console.error(`[recurrence] LLM returned unparseable date: "${text}"`);
      return null;
    }

    // Convert YYYY-MM-DD to a UTC noon anchor (consistent with other date handling)
    return `${match[0]}T12:00:00.000Z`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[recurrence] LLM computation failed: ${msg}`);
    return null;
  }
}

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString();
}

function addMonths(date: Date, months: number): string {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result.toISOString();
}
