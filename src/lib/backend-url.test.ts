import { describe, expect, it } from "vitest";
import { FALLBACK_BACKEND_URL, resolveDefaultBackendUrl } from "./backend-url";

describe("resolveDefaultBackendUrl", () => {
  it("uses the packaged app origin so custom Lite ports cannot target another local instance", () => {
    expect(resolveDefaultBackendUrl({
      production: true,
      location: { hostname: "127.0.0.1", origin: "http://127.0.0.1:51911", protocol: "http:" },
    })).toBe("http://127.0.0.1:51911");
  });

  it("retains the development fallback and accepts an explicit loopback override", () => {
    expect(resolveDefaultBackendUrl({
      production: false,
      location: { hostname: "127.0.0.1", origin: "http://127.0.0.1:5177", protocol: "http:" },
    })).toBe(FALLBACK_BACKEND_URL);
    expect(resolveDefaultBackendUrl({
      configured: "http://localhost:44000/path",
      production: true,
      location: { hostname: "127.0.0.1", origin: "http://127.0.0.1:51911", protocol: "http:" },
    })).toBe("http://localhost:44000");
  });

  it("rejects remote, credentialed, and non-http defaults", () => {
    for (const configured of ["https://example.com", "http://user:pass@localhost:43127", "file:///tmp/app"]) {
      expect(resolveDefaultBackendUrl({ configured, production: true })).toBe(FALLBACK_BACKEND_URL);
    }
  });
});
