import { describe, expect, it } from "vitest";
import { decideSchedule } from "./schedule";

describe("decideSchedule", () => {
  it("runs due batches immediately and arms future batches", () => {
    const now = new Date("2026-07-31T14:00:00").getTime();
    expect(decideSchedule("2026-07-31T13:59:00", now)).toBe("run_now");
    expect(decideSchedule("2026-07-31T14:00:00", now)).toBe("run_now");
    expect(decideSchedule("2026-07-31T14:01:00", now)).toBe("arm");
  });

  it("rejects invalid schedules instead of arming a timer that can never fire", () => {
    expect(decideSchedule("not-a-date")).toBe("invalid");
  });
});
