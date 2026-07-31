export function ok(message, structured = {}) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { message, ...structured },
  };
}

export function fail(message, structured = {}) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { message, ...structured },
    isError: true,
  };
}
