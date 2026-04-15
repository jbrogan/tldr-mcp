/**
 * Timezone utilities — bridge user IANA timezones to UTC instants for
 * DB storage/queries and user-local date computations.
 *
 * Contract:
 *  - TIMESTAMPTZ columns store UTC instants.
 *  - DATE columns (or bare YYYY-MM-DD strings in tool I/O) are user-local days.
 *  - Any conversion between the two MUST go through these helpers.
 */

import { getUserTimezone } from "../store/users.js";

export { getUserTimezone };

/**
 * Today's date in the given timezone as YYYY-MM-DD.
 */
export function todayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Offset (in minutes, west-of-UTC is negative) of the given IANA timezone
 * at the given UTC instant. EST → -300, EDT → -240.
 */
function tzOffsetMinutes(utcInstant: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcInstant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtcIfLocal = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return (asUtcIfLocal - utcInstant) / 60_000;
}

/**
 * Convert a local wall-clock time (y/m/d/h/m/s in `tz`) to a UTC ISO instant.
 * Uses two-pass fixed-point iteration to handle DST boundaries.
 */
function localWallTimeToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  tz: string,
): string {
  const wallUtc = Date.UTC(y, m - 1, d, h, mi, s);
  let offset = tzOffsetMinutes(wallUtc, tz);
  let result = wallUtc - offset * 60_000;
  offset = tzOffsetMinutes(result, tz);
  result = wallUtc - offset * 60_000;
  return new Date(result).toISOString();
}

/**
 * Convert a user-local YYYY-MM-DD to the UTC ISO range that covers that local day.
 * `endUtc` is the START of the next local day — use `.gte(startUtc).lt(endUtc)`.
 */
export function localDateToUtcRange(
  date: string,
  tz: string,
): { startUtc: string; endUtc: string } {
  const [y, m, d] = date.split("-").map(Number);
  const startUtc = localWallTimeToUtc(y, m, d, 0, 0, 0, tz);
  const endUtc = localWallTimeToUtc(y, m, d + 1, 0, 0, 0, tz);
  return { startUtc, endUtc };
}

/**
 * Convert a user-local YYYY-MM-DD to a UTC ISO timestamp anchored at local noon.
 * Used for backfill timestamps where the user gives a date but not a time.
 * Noon is used so the result lands on the intended day even if later viewed in
 * a zone a few hours off from the user's.
 */
export function localDateToUtcAnchor(date: string, tz: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return localWallTimeToUtc(y, m, d, 12, 0, 0, tz);
}

/**
 * Offset a user-local YYYY-MM-DD by N days, staying in that timezone's calendar.
 */
export function offsetDayInTz(date: string, days: number, tz: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // Anchor at local noon to sidestep DST, then shift by days and reformat.
  const anchor = new Date(localWallTimeToUtc(y, m, d, 12, 0, 0, tz));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Resolve a period shorthand to a user-local YYYY-MM-DD range.
 */
export function periodToDateRange(
  period: "today" | "yesterday" | "this_week",
  tz: string,
): { fromDate: string; toDate: string } {
  const today = todayInTz(tz);
  if (period === "today") {
    return { fromDate: today, toDate: today };
  }
  if (period === "yesterday") {
    const yesterday = offsetDayInTz(today, -1, tz);
    return { fromDate: yesterday, toDate: yesterday };
  }
  // this_week: Monday through Sunday, user-local
  const [y, m, d] = today.split("-").map(Number);
  // Get local day-of-week via Intl
  const dowStr = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .format(new Date(localWallTimeToUtc(y, m, d, 12, 0, 0, tz)));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[dowStr] ?? 0;
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = offsetDayInTz(today, mondayOffset, tz);
  const sunday = offsetDayInTz(monday, 6, tz);
  return { fromDate: monday, toDate: sunday };
}
