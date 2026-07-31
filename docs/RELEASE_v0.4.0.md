# Outreach Console v0.4.0

Version 0.4.0 makes the public package easier to start, broadens writing choices,
and turns the default email guidance into enforceable behavior.

## Easier First Run

The Lite archive now includes ordinary and locked Sample Mode launchers for
Windows, macOS, and Linux. They start the loopback service and open the console.
The package still has no runtime npm dependencies and remains subject to the 50
MiB release ceiling.

Fresh workspaces receive four broad, editable job profiles in a one-time shuffled
order. Existing profile order is not changed. The Customize view adds five subtle
CSS background effects and an Off setting; reduced-motion preferences stop their
animation.

## More Writing Choices

The console already supported ChatGPT/Codex, Claude, Cursor, and OpenCode Go plan
CLIs. It now includes a small compatible API bridge for Gemini, Groq, OpenRouter,
DeepSeek, Kimi, Mistral, Together AI, and Cerebras. It uses Node's built-in network
client, so no provider SDK enters the base package.

Named modes ignore user-supplied endpoint and key-variable overrides. They call
only the configured official HTTPS host and read only that provider's documented
environment variable. Replies are capped and provider errors are sanitized. Other
protocols and arbitrary endpoints remain behind the writing-adapter contract.

## Shorter Recruiter Follow-Up

The new default follows the supplied under-80-word framework and the useful parts
of Instantly's public email guidance. A message opens with a factual responsibility
from the listing, connects one supplied profile strength, notes that the application
was submitted, and ends with one routing question.

Generated copy that exceeds the configured word limit stays in writing review.
The default prompt also rejects invented company problems, praise, experience,
results, urgency, and extra calls to action.

## Public Package

The GitHub README is now written for operators. Detailed AI and coding context moved
to `docs/LLM_OPERATOR_GUIDE.md`. The Lite package also includes the small
`outreach-console-operator` skill for compatible agents.

The MIT copyright holder is Vincent Quimby. Standard MIT terms apply: copies or
substantial portions retain the notice and license, while link-back credit remains
optional.

## Verification Scope

The release suite covers preferences, first-run shuffling, message length, provider
endpoint pinning, missing credentials, structured API output, error redaction,
sample-mode isolation, static-file traversal and symlink escape, backend recovery,
MCP confirmation and privacy redaction, malformed stored settings, mail-header
injection, packaged launch, archive contents, size, and privacy scanning. Tests use
synthetic inputs and fake providers. They do not spend credits, read a mailbox,
send email, or call a model.
