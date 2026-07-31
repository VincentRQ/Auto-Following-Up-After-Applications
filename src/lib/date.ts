const DAY_MS = 24 * 60 * 60 * 1000;

export function isRecent(value: string, now = new Date()): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const diff = now.getTime() - parsed.getTime();
  return diff >= 0 && diff <= 3 * DAY_MS;
}

export function formatLocalInputDate(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

export function formatRelativeSchedule(value: string): string {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "unscheduled";
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return "ready";
  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
