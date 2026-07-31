import { describe, expect, it } from "vitest";
import { createDefaultProfiles, DEFAULT_PROFILES } from "./profiles";

describe("starter profiles", () => {
  it("provides four broad editable job-search profiles", () => {
    expect(DEFAULT_PROFILES.map((profile) => profile.key).sort()).toEqual([
      "business_analyst",
      "data_analyst",
      "project_manager",
      "software_engineer",
    ]);
    expect(DEFAULT_PROFILES.every((profile) => profile.senderName === "Your Name" && profile.senderEmail === "")).toBe(true);
  });

  it("shuffles fresh defaults without mutating the canonical definitions", () => {
    const original = DEFAULT_PROFILES.map((profile) => profile.key);
    const shuffled = createDefaultProfiles(() => 0).map((profile) => profile.key);
    expect(shuffled).not.toEqual(original);
    expect([...shuffled].sort()).toEqual([...original].sort());
    expect(DEFAULT_PROFILES.map((profile) => profile.key)).toEqual(original);
  });
});
