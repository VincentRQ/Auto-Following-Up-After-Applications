import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import test from "node:test";

import { checkPlanAiConnection, generatePlanAiMessages, normalizeAiConnection, parsePlanAiOutput } from "./ai-cli.js";

function result(stdout = "", stderr = "") {
  return { stdout, stderr, code: 0 };
}

test("Codex plan check accepts ChatGPT login and removes API-key overrides", async () => {
  const previousOpenAi = process.env.OPENAI_API_KEY;
  const previousCodex = process.env.CODEX_API_KEY;
  process.env.OPENAI_API_KEY = "test";
  process.env.CODEX_API_KEY = "test";
  const calls = [];
  try {
    const checked = await checkPlanAiConnection({ mode: "codex_cli" }, {
      runner: async (call) => {
        calls.push(call);
        assert.equal(call.env.OPENAI_API_KEY, undefined);
        assert.equal(call.env.CODEX_API_KEY, undefined);
        return call.args[0] === "--version" ? result("codex-cli 1.2.3") : result("Logged in using ChatGPT");
      },
    });
    assert.equal(checked.status, "ready");
    assert.equal(checked.authenticated, true);
    assert.equal(checked.version, "codex-cli 1.2.3");
    assert.equal(calls.length, 2);
  } finally {
    restoreEnvironment("OPENAI_API_KEY", previousOpenAi);
    restoreEnvironment("CODEX_API_KEY", previousCodex);
  }
});

test("Codex plan check rejects API-key authentication", async () => {
  const checked = await checkPlanAiConnection({ mode: "codex_cli" }, {
    runner: async (call) => call.args[0] === "--version" ? result("codex-cli 1.2.3") : result("Logged in using an API key"),
  });
  assert.equal(checked.status, "not_authenticated");
  assert.match(checked.detail, /ChatGPT login was not detected/);
});

test("Claude plan check requires Claude.ai subscription auth and removes API credentials", async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test";
  try {
    const checked = await checkPlanAiConnection({ mode: "claude_cli" }, {
      runner: async (call) => {
        assert.equal(call.env.ANTHROPIC_API_KEY, undefined);
        return call.args[0] === "--version"
          ? result("2.0.0 (Claude Code)")
          : result(JSON.stringify({ loggedIn: true, authMethod: "claude.ai", subscriptionType: "pro" }));
      },
    });
    assert.equal(checked.status, "ready");
    assert.equal(checked.authenticated, true);
  } finally {
    restoreEnvironment("ANTHROPIC_API_KEY", previous);
  }
});

test("Cursor and OpenCode checks recognize account-backed credentials", async () => {
  const cursor = await checkPlanAiConnection({ mode: "cursor_cli" }, {
    runner: async (call) => call.args[0] === "--version" ? result("cursor-agent 1.0") : result("Authenticated as user@example.test"),
  });
  assert.equal(cursor.status, "ready");

  const openCode = await checkPlanAiConnection({ mode: "opencode_cli" }, {
    runner: async (call) => {
      if (call.args[0] === "--version") return result("1.0.0");
      if (call.args[0] === "auth") return result("OpenCode Go\nGitHub Copilot");
      return result("opencode-go/gpt-5\nopencode-go/claude-sonnet-4-5\nopenai/gpt-4o");
    },
  });
  assert.equal(openCode.status, "ready");
  assert.deepEqual(openCode.availableModels, ["opencode-go/gpt-5", "opencode-go/claude-sonnet-4-5"]);
});

test("plan CLI output parsing handles direct JSON and provider envelopes", () => {
  const messages = [{ draft_id: "draft-1", subject: "Role", body: "Hello." }];
  assert.deepEqual(parsePlanAiOutput("codex_cli", JSON.stringify({ messages })), messages);
  assert.deepEqual(parsePlanAiOutput("claude_cli", JSON.stringify({ result: JSON.stringify({ messages }) })), messages);
  assert.deepEqual(parsePlanAiOutput("cursor_cli", JSON.stringify({ content: [{ text: JSON.stringify({ messages }) }] })), messages);
  assert.deepEqual(parsePlanAiOutput("opencode_cli", `${JSON.stringify({ type: "step_start" })}\n${JSON.stringify({ part: { text: JSON.stringify({ messages }) } })}`), messages);
});

test("Codex generation uses a temporary read-only invocation and plan environment", async () => {
  const calls = [];
  let workDirectory = "";
  const messages = [{ draft_id: "draft-1", subject: "Analyst opening", body: "Hi Sam, I noticed the reporting focus in the role." }];
  const generated = await generatePlanAiMessages({ mode: "codex_cli", strictPlanOnly: true }, {
    brief: "Use a warm, direct tone.",
    maximum_words: 80,
    drafts: [{ id: "draft-1", recipientName: "Sam", company: "Example", roleTitle: "Analyst" }],
  }, {
    runner: async (call) => {
      calls.push(call);
      if (call.args[0] === "--version") return result("codex-cli 1.2.3");
      if (call.args[0] === "login") return result("Logged in using ChatGPT");
      workDirectory = call.cwd;
      assert.equal(call.env.OPENAI_API_KEY, undefined);
      assert.ok(call.args.includes("read-only"));
      assert.ok(call.args.includes('approval_policy="never"'));
      assert.ok(call.args.includes("--ephemeral"));
      assert.match(call.input, /UNTRUSTED_DATA_START/);
      const outputIndex = call.args.indexOf("--output-last-message");
      writeFileSync(call.args[outputIndex + 1], JSON.stringify({ messages }), "utf8");
      return result();
    },
  });
  assert.deepEqual(generated, messages);
  assert.equal(calls.length, 3);
  assert.equal(existsSync(workDirectory), false);
});

test("Claude generation disables tools, customizations, persistence, and MCP servers", async () => {
  const messages = [{ draft_id: "draft-1", subject: "Role", body: "Hi Sam, I noticed the reporting focus." }];
  const generated = await generatePlanAiMessages({ mode: "claude_cli", strictPlanOnly: true }, writingInput(), {
    runner: async (call) => {
      if (call.args[0] === "--version") return result("2.1.201 (Claude Code)");
      if (call.args[0] === "auth") return result(JSON.stringify({ loggedIn: true, authMethod: "claude.ai", subscriptionType: "pro" }));
      assert.ok(call.args.includes("--safe-mode"));
      assert.ok(call.args.includes("--no-session-persistence"));
      assert.ok(call.args.includes("--strict-mcp-config"));
      assert.equal(call.args[call.args.indexOf("--tools") + 1], "");
      assert.deepEqual(JSON.parse(call.args[call.args.indexOf("--mcp-config") + 1]), { mcpServers: {} });
      return result(JSON.stringify({ result: JSON.stringify({ messages }) }));
    },
  });
  assert.deepEqual(generated, messages);
});

test("OpenCode Go generation uses a denied-tool local configuration", async () => {
  const messages = [{ draft_id: "draft-1", subject: "Role", body: "Hi Sam, I noticed the reporting focus." }];
  let workDirectory = "";
  const generated = await generatePlanAiMessages({ mode: "opencode_cli", strictPlanOnly: true }, writingInput(), {
    runner: async (call) => {
      if (call.args[0] === "--version") return result("1.18.9");
      if (call.args[0] === "auth") return result("OpenCode Go");
      if (call.args[0] === "models") return result("opencode-go/test-model");
      workDirectory = call.cwd;
      assert.ok(call.args.includes("--pure"));
      assert.equal(call.args[call.args.indexOf("--model") + 1], "opencode-go/test-model");
      assert.deepEqual(JSON.parse(readFileSync(`${call.cwd}/opencode.json`, "utf8")), { permission: "deny", share: "disabled" });
      assert.match(call.env.OPENCODE_PERMISSION, /deny/);
      return result(`${JSON.stringify({ type: "step_start" })}\n${JSON.stringify({ part: { text: JSON.stringify({ messages }) } })}`);
    },
  });
  assert.deepEqual(generated, messages);
  assert.equal(existsSync(workDirectory), false);
});

test("OpenCode plan generation refuses models outside the Go subscription", async () => {
  await assert.rejects(
    generatePlanAiMessages({ mode: "opencode_cli", model: "openai/gpt-4o", strictPlanOnly: true }, {
      brief: "Brief",
      maximum_words: 80,
      drafts: [{ id: "draft-1", company: "Example", roleTitle: "Analyst" }],
    }, {
      runner: async (call) => {
        if (call.args[0] === "--version") return result("1.0.0");
        if (call.args[0] === "auth") return result("OpenCode Go");
        return result("opencode-go/gpt-5");
      },
    }),
    /requires an opencode-go/,
  );
});

test("AI connection normalization rejects command-shaped model values", () => {
  assert.throws(() => normalizeAiConnection({ mode: "codex_cli", model: "gpt-5; Remove-Item *" }), /Model IDs may contain only/);
});

test("plan-backed generation requires explicit strict plan-only confirmation", async () => {
  await assert.rejects(
    generatePlanAiMessages({ mode: "codex_cli" }, { brief: "Brief", maximum_words: 80, drafts: [{ id: "draft-1" }] }, { runner: async () => result() }),
    /Strict plan-only confirmation is required/,
  );
});

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function writingInput() {
  return {
    brief: "Use a warm, direct tone.",
    maximum_words: 80,
    drafts: [{ id: "draft-1", recipientName: "Sam", company: "Example", roleTitle: "Analyst" }],
  };
}
