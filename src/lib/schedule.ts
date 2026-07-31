export type ScheduleDecision = "run_now" | "arm" | "invalid";

export function decideSchedule(scheduledAt: string, now = Date.now()): ScheduleDecision {
  const timestamp = new Date(scheduledAt).getTime();
  if (!Number.isFinite(timestamp)) return "invalid";
  return timestamp <= now ? "run_now" : "arm";
}
