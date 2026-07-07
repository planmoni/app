/**
 * Helpers for custom payout date/time handling (local calendar dates + HH:mm).
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

/** Combine YYYY-MM-DD + HH:mm into an ISO string using local timezone. */
export function buildDateTimeISO(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const { hour, minute } = parseTimeString(timeStr);
  const dt = new Date(y, m - 1, d, hour, minute, 0, 0);
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
