/** Africa/Lagos wall-clock helpers for edge functions (UTC runtime). */

export const PAYOUT_TZ = "Africa/Lagos";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Lagos calendar YYYY-MM-DD for an instant. */
export function lagosDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PAYOUT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Lagos wall-clock hour/minute for an instant. */
export function lagosHoursMinutes(date: Date): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PAYOUT_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return {
    hours: Number(parts.find((p) => p.type === "hour")?.value ?? 9),
    minutes: Number(parts.find((p) => p.type === "minute")?.value ?? 0),
  };
}

/**
 * Build a timestamptz ISO string for a Lagos calendar day + wall-clock time.
 * Avoids Deno UTC setHours treating local hours as UTC (+1h in Nigeria).
 */
export function lagosWallClockToISO(
  date: Date,
  hours: number,
  minutes: number
): string {
  const day = lagosDateString(date);
  return new Date(
    `${day}T${pad2(hours % 24)}:${pad2(minutes % 60)}:00+01:00`
  ).toISOString();
}
