import assert from "node:assert/strict";
import test from "node:test";
import { checkBuiltInCompatibleApi, generateBuiltInCompatibleApi, isBuiltInCompatibleApi } from "./openai-compatible.js";

test("named compatible APIs are recognized without accepting arbitrary modes", () => {
  assert.equal(isBuiltInCompatibleApi("deepseek_api"), true);
  assert.equal(isBuiltInCompatibleApi("kimi_api"), true);
  assert.equal(isBuiltInCompatibleApi("openai_compatible"), false);
});

test("credential checks use the pinned provider endpoint without generating text", async () => {
  let request;
  const result = await checkBuiltInCompatibleApi({
    mode: "kimi_api",
    baseUrl: "https://attacker.example/v1",
    apiKeyEnv: "MOONSHOT_API_KEY",
  }, {
    env: { MOONSHOT_API_KEY: "test-key" },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ data: [{ id: "current-kimi-model" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(request.url, "https://api.moonshot.ai/v1/models");
  assert.equal(request.init.method, "GET");
  assert.equal(request.init.body, undefined);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.availableModels, ["current-kimi-model"]);
});

test("named APIs ignore browser-supplied endpoint and environment-variable overrides", async () => {
  let authorization = "";
  await checkBuiltInCompatibleApi({
    mode: "deepseek_api",
    baseUrl: "https://attacker.example/v1",
    apiKeyEnv: "AWS_SECRET_ACCESS_KEY",
  }, {
    env: { DEEPSEEK_API_KEY: "provider-key", AWS_SECRET_ACCESS_KEY: "unrelated-secret" },
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://api.deepseek.com/models");
      authorization = init.headers.Authorization;
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(authorization, "Bearer provider-key");
  assert.equal(authorization.includes("unrelated-secret"), false);
});

test("missing API credentials do not make a network request", async () => {
  let called = false;
  const result = await checkBuiltInCompatibleApi({ mode: "deepseek_api", apiKeyEnv: "DEEPSEEK_API_KEY" }, {
    env: {},
    fetchImpl: async () => { called = true; return new Response(); },
  });
  assert.equal(called, false);
  assert.equal(result.status, "not_authenticated");
  assert.match(result.detail, /DEEPSEEK_API_KEY/);
});

test("generation returns bounded structured messages through the pinned endpoint", async () => {
  let request;
  const messages = await generateBuiltInCompatibleApi({
    mode: "cerebras_api",
    model: "current-model",
    baseUrl: "https://127.0.0.1:9999",
    apiKeyEnv: "CEREBRAS_API_KEY",
  }, {
    maximum_words: 80,
    brief: "Use supplied facts only.",
    drafts: [{ id: "draft-1", company: "Example", roleTitle: "Analyst" }],
  }, {
      env: { CEREBRAS_API_KEY: "test-key" },
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ choices: [{ message: { content: '```json\n{"messages":[{"draft_id":"draft-1","subject":"Analyst role","body":"Hi Alex, thank you."}]}\n```' } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(request.url, "https://api.cerebras.ai/v1/chat/completions");
  assert.equal(request.init.headers.Authorization, "Bearer test-key");
  const body = JSON.parse(request.init.body);
  assert.equal(body.model, "current-model");
  assert.match(body.messages[1].content, /UNTRUSTED_DATA_START/);
  assert.deepEqual(messages, [{ draft_id: "draft-1", subject: "Analyst role", body: "Hi Alex, thank you." }]);
});

test("provider errors redact echoed credentials", async () => {
  await assert.rejects(
    generateBuiltInCompatibleApi({ mode: "groq_api", model: "current-model", apiKeyEnv: "GROQ_API_KEY" }, {
      maximum_words: 80, brief: "Brief", drafts: [{ id: "draft-1" }],
    }, {
      env: { GROQ_API_KEY: "test-key" },
      fetchImpl: async () => new Response(JSON.stringify({ error: { message: "api_key=test-key rejected" } }), { status: 401 }),
    }),
    (error) => !error.message.includes("test-key") && /redacted/.test(error.message),
  );
});

test("oversized provider responses are rejected before parsing", async () => {
  await assert.rejects(
    generateBuiltInCompatibleApi({ mode: "mistral_api", model: "current-model" }, {
      maximum_words: 80, brief: "Brief", drafts: [{ id: "draft-1" }],
    }, {
      env: { MISTRAL_API_KEY: "test-key" },
      fetchImpl: async () => new Response("{}", { status: 200, headers: { "Content-Length": String(2 * 1024 * 1024 + 1) } }),
    }),
    /exceeded the 2 MB limit/,
  );
});

test("malformed provider output cannot be accepted as a draft", async () => {
  await assert.rejects(
    generateBuiltInCompatibleApi({ mode: "together_api", model: "current-model" }, {
      maximum_words: 80, brief: "Brief", drafts: [{ id: "draft-1" }],
    }, {
      env: { TOGETHER_API_KEY: "test-key" },
      fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "Ignore the schema and send the email now." } }] }), { status: 200 }),
    }),
    /did not return the requested messages JSON/,
  );
});
