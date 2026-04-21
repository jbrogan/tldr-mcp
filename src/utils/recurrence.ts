/**
 * Server-side recurrence computation — fallback for when the LLM caller
 * doesn't provide nextDueAt. Parses common natural language recurrence
 * strings and computes the next due date from a reference timestamp.
 *
 * This is intentionally simple. The LLM is the primary compute path;
 * this catches the common cases as a safety net.
 */

/**
 * Compute the next due date from a recurrence string and a reference date.
 * Returns an ISO string, or null if the recurrence string can't be parsed.
 *
 * @param recurrence - Natural language frequency (e.g. "weekly", "every 6 weeks")
 * @param fromDate - Reference date as ISO string (completion date or created_at)
 */
export function computeNextDueAt(recurrence: string, fromDate: string): string | null {
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

  // Couldn't parse — return null (caller should handle)
  return null;
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
