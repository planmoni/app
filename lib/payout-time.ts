/**
 * Helpers for custom payout date/time handling (local calendar dates + HH:mm).
 *
 * Nigeria runs on Africa/Lagos (UTC+1, no DST). Selected payout hours are wall-clock
 * local times — never treat them as UTC or you get a permanent +1h display shift.
 */

export function parseTimeString(
  timeStr: string | undefined,
  fallbackHour = 12,
  fallbackMinute = 0
): { hour: number; minute: number } {
  const [h, m] = (timeStr || '').split(':').map(Number);
  return {
    hour: isNaN(h) ? fallbackHour : h % 24,
    minute: isNaN(m) ? fallbackMinute : m % 60,
  };
}

export function formatTimeString(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC midnight from Date("YYYY-MM-DD")). */
export function parseLocalDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/** Combine YYYY-MM-DD + HH:mm into an ISO string using local timezone. */
export function buildDateTimeISO(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const { hour, minute } = parseTimeString(timeStr);
  const dt = new Date(y, m - 1, d, hour, minute, 0, 0);
  return dt.toISOString();
}

/** Apply wall-clock hour/minute on a local Date, then serialize to ISO (UTC). */
export function toPayoutTimestampISO(
  date: Date,
  hour = 9,
  minute = 0
): string {
  const dt = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour % 24,
    minute % 60,
    0,
    0
  );
  return dt.toISOString();
}

/** Ensure every custom date has a time entry (defaults to noon). */
export function buildCustomDateTimesMap(
  dates: string[],
  times: Record<string, string> | undefined,
  defaultTime = '12:00'
): Record<string, string> {
  return Object.fromEntries(dates.map((d) => [d, times?.[d] || defaultTime]));
}

/** 12-hour display for HH:mm (e.g. "12:00 PM"). */
export function formatTimeForDisplay(timeStr: string): string {
  const { hour, minute } = parseTimeString(timeStr);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} ${period}`;
}

/** Postgres `time` / HH:mm:ss → HH:mm */
export function payoutTimeToHHmm(payoutTime: string | null | undefined): string {
  if (!payoutTime) return '12:00';
  const parts = payoutTime.split(':');
  if (parts.length < 2) return '12:00';
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return '12:00';
  return formatTimeString(hour % 24, minute % 60);
}
