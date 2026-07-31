export function createBackendClient(baseUrl, fetchImpl = fetch) {
  async function request(path, { method = "GET", body } = {}) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new Error(`The local outreach backend is unavailable at ${baseUrl}. Start it with npm run dev:backend. ${error.message}`);
    }
    const text = await response.text();
    let value = {};
    try {
      value = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`The local outreach backend returned an invalid response for ${path}.`);
    }
    if (!response.ok) throw new Error(value.error || `Backend request failed with HTTP ${response.status}.`);
    return value;
  }

  return { request };
}
