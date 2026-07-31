import { describe, expect, it, vi } from "vitest";
import { writeLinkedCsv } from "./sourceFile";

describe("linked source writes", () => {
  it("requests permission and closes the writer before returning refreshed metadata", async () => {
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const refreshed = new File(["company,job_title,job_url\n"], "applications.csv", { type: "text/csv", lastModified: 42 });
    const handle = {
      name: "applications.csv",
      getFile: vi.fn(async () => refreshed),
      createWritable: vi.fn(async () => ({ write, close })),
      queryPermission: vi.fn(async () => "prompt" as PermissionState),
      requestPermission: vi.fn(async () => "granted" as PermissionState),
    };

    const result = await writeLinkedCsv(handle, "company,job_title,job_url\n");

    expect(write).toHaveBeenCalledWith("company,job_title,job_url\n");
    expect(close).toHaveBeenCalledOnce();
    expect(result.lastModified).toBe(42);
  });
});
