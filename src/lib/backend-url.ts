export const FALLBACK_BACKEND_URL = "http://127.0.0.1:43127";

type RuntimeLocation = {
  hostname: string;
  origin: string;
  protocol: string;
};

export function resolveDefaultBackendUrl({
  configured,
  production,
  location,
}: {
  configured?: string;
  production: boolean;
  location?: RuntimeLocation;
}): string {
  const explicit = normalizeLoopbackUrl(configured);
  if (explicit) return explicit;
  if (!production || !location || !isLoopbackHost(location.hostname)) return FALLBACK_BACKEND_URL;
  if (location.protocol !== "http:" && location.protocol !== "https:") return FALLBACK_BACKEND_URL;
  return normalizeLoopbackUrl(location.origin) ?? FALLBACK_BACKEND_URL;
}

function normalizeLoopbackUrl(value: string | undefined): string | null {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.username || parsed.password || !isLoopbackHost(parsed.hostname)) return null;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1";
}
