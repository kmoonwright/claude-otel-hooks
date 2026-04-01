# claude-otel-hooks — Comprehensive README

This file is the **full** documentation: install details, behavior, privacy, Honeycomb usage, and troubleshooting. For a short overview, see [README.md](./README.md).

---

Privacy-first OpenTelemetry instrumentation for [Claude Code](https://claude.ai/code). Each supported lifecycle hook runs a small Node script that emits **one span per event** to [Honeycomb](https://www.honeycomb.io/) over OTLP/HTTP—useful for understanding session flow, tool usage, errors, and compaction without shipping prompt or tool body text by default.

## Contents

- [What you get](#what-you-get)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Installation options](#installation-options)
- [Configuration (.env)](#configuration-env)
- [Environment variables](#environment-variables)
- [How it works](#how-it-works)
- [Privacy and data minimization](#privacy-and-data-minimization)
- [OpenTelemetry GenAI conventions](#opentelemetry-genai-conventions)
- [Events and span attributes](#events-and-span-attributes)
- [Using Honeycomb effectively](#using-honeycomb-effectively)
- [Operational notes](#operational-notes)
- [Troubleshooting](#troubleshooting)
- [Uninstall](#uninstall)
- [Repository layout](#repository-layout)
- [Developing and publishing](#developing-and-publishing)

---

## What you get

- **12 Claude Code hook events** wired to Node commands in `~/.claude/settings.json` (via `install.js` on `npm install`), using the current [hooks schema](https://code.claude.com/docs/en/hooks) (matcher group + nested `hooks` array).
- **Traces in Honeycomb** using the standard OTLP endpoint `https://api.honeycomb.io/v1/traces` with `x-honeycomb-team` and `x-honeycomb-dataset` headers.
- **Trace correlation across hooks** for a session using small JSON files under your OS temp directory (`claude-otel/session-<id>.json`), so child spans share the session root trace when context is available.
- **Configuration without shell exports:** a **`.env` file in the package root** (gitignored) is loaded on every hook run; you can still use real environment variables, which take precedence over `.env`.
- **OpenTelemetry [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)** (development status): spans include `gen_ai.*` attributes where hook data allows—see [OpenTelemetry GenAI conventions](#opentelemetry-genai-conventions).

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | Version **18+** recommended (ES modules, modern APIs). `node` must be on `PATH` when Claude Code invokes hooks. |
| **Claude Code** | Hooks are configured in `~/.claude/settings.json`. Restart Claude Code after changing hooks or env. |
| **Honeycomb account** | Create an environment and API key; choose or create a dataset (default dataset name in code: `claude-code`). |
| **Git** (optional) | If the workspace is a git repo, `SessionStart` adds `vcs.branch` and `vcs.repo` (from `origin`). Otherwise values fall back to `unknown`. |

---

## Quick start

1. **Configure Honeycomb** using a **`.env` file** in the package root (recommended), or with shell exports.

   ```bash
   cp .env.example .env
   # Edit .env: set HONEYCOMB_API_KEY (required); optional HONEYCOMB_DATASET, etc.
   ```

   Alternatively:

   ```bash
   export HONEYCOMB_API_KEY="your-api-key"
   export HONEYCOMB_DATASET="claude-code"   # optional; default in code is claude-code
   ```

   Precedence: variables **already in the process environment** are **not** overridden by `.env`. See [Configuration (.env)](#configuration-env).

2. **Install this package** so dependencies are present and hooks register:

   ```bash
   cd /path/to/claude-otel-hooks
   npm install
   ```

   `postinstall` runs `install.js`, which merges hook entries into `~/.claude/settings.json`.

3. **Restart Claude Code** and use it normally. Open Honeycomb → your dataset → run a trace query (e.g. filter or group by `claude.event_type` or `claude.session_id`).

---

## Installation options

### From a clone (local development)

```bash
git clone <your-fork-or-url> claude-otel-hooks
cd claude-otel-hooks
npm install
```

Hook commands in `settings.json` point at **`node <package-root>/hooks/<event>.js`**. Keep the directory stable, or reinstall after moving the folder.

### Global install (after publishing)

Rename `package.json` `name` from `@yourorg/claude-otel-hooks` to your scope, publish, then:

```bash
npm install -g @yourorg/claude-otel-hooks
```

Global installs resolve `__dirname` to the global package path; hooks still work as long as that global path remains valid. Place **`.env` next to that package’s `package.json`** (for example under `$(npm root -g)/@yourorg/claude-otel-hooks/`).

### What `install.js` does

- Reads existing `~/.claude/settings.json` if present; on parse failure, starts from `{}` and warns.
- Ensures `settings.hooks` exists.
- For each known event name, sets `settings.hooks[<EventName>]` to a **matcher group**: `[{ "matcher": "*", "hooks": [{ "type": "command", "command": "node <absolute-path>/hooks/<kebab-event>.js" }] }]`, as required by Claude Code.
- Writes the file back with pretty-printed JSON.

**Important:** For each listed event, the script **replaces** the hook entry with the OTel hook command. If you had custom hooks on the same event keys, back up `settings.json` or merge manually after install.

**Upgrade cleanup:** The installer **deletes** obsolete hook keys (`ToolError`, `SubagentError`, `McpServerStart`) that older versions wrote but current Claude Code rejects—re-run `node install.js` or `npm install` if `settings.json` fails validation with “Invalid key in record” for those names.

---

## Configuration (.env)

- **`lib/otel.js`** loads **`dotenv`** before reading configuration. The default file is **`.env`** in the **package root** (the directory that contains `package.json` for this package), resolved from the installed location of `lib/otel.js`, not from the current working directory of the hook.
- **`CLAUDE_OTEL_DOTENV_PATH`** (optional): path to a different env file. If relative, it is resolved against the **package root**. This variable must be set in the **real environment** (not only inside the file it points to) if you need to redirect loading before the default `.env` is read.
- **`.env.example`** in the repository lists supported keys; copy it to `.env` and fill in secrets. **`.env` is gitignored**—never commit API keys.
- **Precedence:** `dotenv` does **not** overwrite existing `process.env` entries, so exports in your shell or OS still win.

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `HONEYCOMB_API_KEY` | **Yes** (for data to be accepted) | — | Sent as `x-honeycomb-team`. |
| `HONEYCOMB_DATASET` | No | `claude-code` | Sent as `x-honeycomb-dataset`. |
| `HONEYCOMB_OTLP_TRACES_ENDPOINT` | No | `https://api.honeycomb.io/v1/traces` | OTLP/HTTP traces URL (e.g. alternate region or proxy). |
| `CLAUDE_OTEL_DOTENV_PATH` | No | — | Alternate env file path (absolute, or relative to package root). Must be set outside that file if used to choose the file. |
| `CLAUDE_OTEL_GEN_AI_PROVIDER` | No | `anthropic` | `gen_ai.provider.name` on spans ([registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)). |
| `CLAUDE_OTEL_GEN_AI_MODEL` | No | — | `gen_ai.request.model` and span names like `chat <model>` when set (not supplied by hook JSON). |
| `CLAUDE_OTEL_RECORD_GEN_AI_MESSAGES` | No | off | Set `true` to enable both message attributes. |
| `CLAUDE_OTEL_RECORD_GEN_AI_INPUT_MESSAGES` | No | off | Set `true` for `gen_ai.input.messages` only. |
| `CLAUDE_OTEL_RECORD_GEN_AI_OUTPUT_MESSAGES` | No | off | Set `true` for `gen_ai.output.messages` only. |
| `CLAUDE_OTEL_GEN_AI_MESSAGE_MAX_CHARS` | No | `32768` | Truncation limit for embedded text in message JSON. |

Hooks run as separate short-lived processes. With **`.env` in the package root**, they pick up keys even when Claude Code was not launched from a shell that exported them. If spans never appear, verify **`HONEYCOMB_API_KEY`** ends up set after load (either in `.env` or in the environment).

---

## How it works

1. **Claude Code** triggers a hook and passes a **JSON payload on stdin** to the command.
2. **`lib/otel.js`** loads **`.env`** from the package root (unless redirected), then starts a minimal `NodeSDK` with an `OTLPTraceExporter` to Honeycomb, creates a span, then **`shutdown()`** so the process exits cleanly after export.
3. **`readStdin()`** buffers stdin, parses JSON, or returns `{}` on failure/timeout (there is a **100ms** timeout fallback—very slow stdin could theoretically yield empty payload; in practice hook payloads arrive quickly).
4. **`lib/context.js`** stores `traceId`, `spanId`, and `startTime` per `session_id` under `$TMPDIR/claude-otel/` (or OS equivalent). **`SessionStart`** seeds context; **`PostToolUse`** updates the stored span for continuation; **`Stop`** / **`SubagentStop`** clear session files when applicable.
5. **`lib/git.js`** runs read-only git commands from the **current working directory** of the hook process (typically the project root Claude Code uses).

Span names are stable strings like `claude_code.session`, `claude_code.user_prompt_submit`, etc., with `claude.event_type` mirroring the Claude hook name for easy filtering.

---

## Privacy and data minimization

This project is **opinionated about not exfiltrating raw conversation or tool I/O** in the default hooks:

- **User prompts:** by default only `claude.prompt_length` is recorded, not `message` content. You can opt in to `gen_ai.input.messages` / `gen_ai.output.messages` (see below)—treat that as **highly sensitive**.
- **Tool runs:** by default `claude.tool_name`, `claude.exit_code`, and `claude.output_length`—not raw I/O. Opt-in message capture includes tool arguments and results in structured `gen_ai.input.messages` where hooks expose them.
- **Session start:** `claude.working_dir`, git **branch/repo** (short form), host user and OS—useful for correlation, not file contents.

You should still treat **session IDs**, **paths**, and **repo names** as potentially sensitive in regulated environments. For stricter policies, fork and remove or hash attributes (e.g. working directory, repo) before exporting.

---

## OpenTelemetry GenAI conventions

This package aligns with the OpenTelemetry **[Gen AI](https://opentelemetry.io/docs/specs/semconv/gen-ai/)** and **[generative client spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/)** documentation where lifecycle hooks expose enough structure. Those conventions are marked **development** in upstream docs; attribute names may evolve as the spec stabilizes (see upstream notes on `OTEL_SEMCONV_STABILITY_OPT_IN`).

**By default** we do **not** emit full-message attributes (`gen_ai.input.messages`, `gen_ai.output.messages`). Enable them only with explicit env flags (below). Values are stored as **JSON strings** on spans (per upstream guidance for backends that do not support structured attributes). Content is **truncated** with `CLAUDE_OTEL_GEN_AI_MESSAGE_MAX_CHARS`.

| Env flag | Effect |
|----------|--------|
| `CLAUDE_OTEL_RECORD_GEN_AI_MESSAGES=true` | Enables both input and output message attributes. |
| `CLAUDE_OTEL_RECORD_GEN_AI_INPUT_MESSAGES=true` | `gen_ai.input.messages` only. |
| `CLAUDE_OTEL_RECORD_GEN_AI_OUTPUT_MESSAGES=true` | `gen_ai.output.messages` only. |
| `CLAUDE_OTEL_GEN_AI_MESSAGE_MAX_CHARS` | Max characters per text blob (default `32768`). |

| Hook | `gen_ai.input.messages` (when enabled) | `gen_ai.output.messages` (when enabled) |
|------|----------------------------------------|----------------------------------------|
| `UserPromptSubmit` | User `message` as [input schema](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-input-messages.json) | — |
| `PreToolUse` | Assistant `tool_call` part from `tool_name`, `tool_use_id`, `tool_input` / `input` / `arguments` | — |
| `PostToolUse` / `PostToolUseFailure` | Tool `tool_call_response` from `tool_response.output` or error fields | — |
| `Stop` | — | Assistant text if `last_assistant_message`, `assistant_message`, `assistant_response`, or `response` exists in the hook JSON |

If Claude Code does not ship a field in the hook payload, the corresponding attribute is omitted.

| Mapping | Details |
|--------|---------|
| **Provider** | `gen_ai.provider.name` defaults to `anthropic`; override with `CLAUDE_OTEL_GEN_AI_PROVIDER`. |
| **Model** | Hook payloads do not include the model id; set **`CLAUDE_OTEL_GEN_AI_MODEL`** so spans get `gen_ai.request.model` and `chat <model>` span names. |
| **Conversation** | `gen_ai.conversation.id` ← `session_id` when present. |
| **User prompt** | `gen_ai.operation.name` = `chat`; span name `chat` or `chat <model>`; span **kind** `CLIENT` (inference-style client). |
| **Tool hooks** | `gen_ai.operation.name` = `execute_tool`; span name `execute_tool <tool_name>` per [execute tool span](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/#execute-tool-span); span **kind** `INTERNAL`; `gen_ai.tool.name`, `gen_ai.tool.type` (`function` vs `extension` for `mcp__*` tools); optional `gen_ai.tool.call.id` from `tool_use_id` / `tool_call_id`; `error.type` on failures / non-zero exit. |
| **Subagent** | `gen_ai.operation.name` = `invoke_agent`; span name `invoke_agent` or `invoke_agent <agent_type>`; span **kind** `INTERNAL`; `gen_ai.agent.id` / `gen_ai.agent.name` when the hook JSON includes them. |
| **Compaction** | `gen_ai.usage.input_tokens` maps from `context_tokens` (pre) or `tokens_after` (post)—approximate context size, not a full “inference” span. |
| **Session / stop / notification** | `gen_ai.provider.name` and `gen_ai.conversation.id` where applicable; no standard GenAI operation name for every IDE-only event. |

Existing **`claude.*`** attributes remain for backward compatibility and Claude-specific fields.

---

## Events and span attributes

| Claude event | Hook file | Span name (examples) | Notable `claude.*` + `gen_ai.*` |
|--------------|-----------|------------------------|--------------------|
| `SessionStart` | `session-start.js` | `claude_code.session` | `claude.session_id`, `claude.working_dir`, `vcs.*`, `host.*` |
| `UserPromptSubmit` | `user-prompt-submit.js` | `claude_code.user_prompt_submit` | `claude.prompt_length` |
| `PreToolUse` | `pre-tool-use.js` | `claude_code.pre_tool_use` | `claude.tool_name` |
| `PostToolUse` | `post-tool-use.js` | `claude_code.post_tool_use` | `claude.exit_code`, `claude.output_length`; ERROR status if non-zero exit |
| `PostToolUseFailure` | `post-tool-use-failure.js` | `claude_code.post_tool_use_failure` | ERROR status (failed tool calls; replaces legacy `ToolError`) |
| `PermissionRequest` | `permission-request.js` | `claude_code.permission_request` | `claude.permission_type`, `claude.granted` |
| `SubagentStart` | `subagent-start.js` | `claude_code.subagent_start` | `claude.parent_session_id` |
| `SubagentStop` | `subagent-stop.js` | `claude_code.subagent_stop` | clears subagent session context file |
| `Notification` | `notification.js` | `claude_code.notification` | `claude.notification_type` |
| `Stop` | `stop.js` | `claude_code.session_stop` | `claude.total_duration_ms`, `claude.turn_count` |
| `PreCompact` | `pre-compact.js` | `claude_code.pre_compact` | `claude.context_tokens` |
| `PostCompact` | `post-compact.js` | `claude_code.post_compact` | `claude.tokens_before/after/saved` |

Older drafts used hook names (`ToolError`, `SubagentError`, `McpServerStart`) that are **not** in the current [Hooks reference](https://code.claude.com/docs/en/hooks#hook-events); failed tools are covered by **`PostToolUseFailure`**.

Exact field names on the JSON payload depend on Claude Code’s hook contract; hooks use optional chaining and defaults like `unknown` when fields are missing.

---

## Using Honeycomb effectively

- **Dataset:** Ensure `HONEYCOMB_DATASET` matches the dataset you’re querying (or use Honeycomb’s environment-wide views if configured).
- **Break down by `claude.event_type`:** See volume per lifecycle stage (prompts vs tools vs compaction).
- **Filter `claude.session_id`:** Reconstruct a single session’s timeline; use trace view if your UI groups spans into traces.
- **Errors:** Filter spans with error status or high `claude.exit_code` on `PostToolUse`.
- **Latency / gaps:** Hook spans measure **hook execution and export time**, not model latency. For model timing you’d extend instrumentation or correlate with other signals.
- **Sampling:** This package does not configure head sampling; every emitted span is exported. For high volume, configure sampling in SDK or at ingest (per Honeycomb product behavior).

---

## Operational notes

- **API keys:** Prefer **`.env` in the package root** for local and global installs so Claude Code does not depend on shell-inherited exports. Alternatively use a shell profile, secrets manager, or OS env. Never commit keys to the repo.
- **macOS / GUI Claude Code:** A package-local **`.env`** avoids needing terminal `export` or `launchctl setenv` for Honeycomb variables.
- **`settings.json`:** Back up `~/.claude/settings.json` before first install. Invalid JSON is replaced with a fresh object for hook merging—corrupt files could lose unrelated settings if not backed up.
- **Moving the package:** Re-run `node install.js` from the new location or `npm install` again so hook paths stay absolute and correct.
- **Temp directory:** Session correlation files live under `claude-otel` in the system temp dir. Clearing temp or rebooting may drop context files mid-session and produce **disconnected traces** until the next `SessionStart` or context save.

---

## Troubleshooting

| Symptom | Things to check |
|---------|------------------|
| No data in Honeycomb | `HONEYCOMB_API_KEY` in **`.env`** (package root) or in the environment; correct dataset; reachable `HONEYCOMB_OTLP_TRACES_ENDPOINT`; key has ingest permission. |
| Spans but wrong / empty attributes | stdin JSON shape may differ by Claude version; inspect by temporarily logging `raw` in a hook (avoid logging secrets). |
| Traces not linked | Missing `session_id` alignment, wiped temp dir, or first event not `SessionStart` for that id; check `claude-otel` files under `$TMPDIR`. |
| `unknown` for git fields | Not a git repo, or no `origin` remote; expected in some workspaces. |
| Install overwrites hooks | `install.js` sets each event to a single command; merge custom hooks manually if needed. |
| Parse warning on install | Existing `settings.json` was invalid JSON; fix or restore from backup. |

**Manual smoke test** (exporter only—uses `.env` in this directory if present):

```bash
echo '{}' | node hooks/session-start.js
```

If Honeycomb shows a new span for dataset `claude-code` (or your override), plumbing works.

---

## Uninstall

1. **Remove hooks.** Edit `~/.claude/settings.json` and delete the entries for these events (or remove the entire `hooks` object if nothing else uses it):  
   `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `SubagentStart`, `SubagentStop`, `Notification`, `Stop`, `PreCompact`, `PostCompact`.  
   You can also remove only the hook definitions whose `command` points at this package’s `hooks/*.js` paths if you share `settings.json` with other tools.
2. **Restart Claude Code** so changes take effect.
3. **Remove the package (optional):** delete a local clone, or run `npm uninstall -g @yourorg/claude-otel-hooks` using the same `name` as in `package.json`.
4. **Secrets and temp files (optional):** delete the package **`.env`**; remove `HONEYCOMB_*` (or `CLAUDE_OTEL_DOTENV_PATH`) from your shell profile if you added them only for this tool. Leftover files under `$TMPDIR/claude-otel/` are safe to delete when Claude Code is not running.

There is no separate daemon or OS service—only `settings.json`, optional npm install, and those files.

---

## Repository layout

| Path | Role |
|------|------|
| `.env.example` | Template for `.env`; copy to `.env` locally (`.env` is gitignored). |
| `package.json` | Package metadata, `postinstall` → `install.js`, OTel + `dotenv` dependencies. |
| `install.js` | Writes Claude Code hook commands pointing at `hooks/*.js`. |
| `lib/otel.js` | Loads `.env`, Honeycomb OTLP exporter, tracer, stdin helper, SDK lifecycle. |
| `lib/genai.js` | OpenTelemetry GenAI semantic convention helpers ([spec](https://opentelemetry.io/docs/specs/semconv/gen-ai/)). |
| `lib/genai-messages.js` | Optional `gen_ai.input.messages` / `gen_ai.output.messages` builders ([input](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-input-messages.json) / [output](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-output-messages.json) schemas). |
| `lib/context.js` | Session trace context persistence under temp dir. |
| `lib/git.js` | Optional git branch/repo metadata. |
| `hooks/*.js` | One script per registered hook event (12 files). |

Source of truth for behavior is these files; edit them directly rather than duplicating snippets elsewhere.

---

## Developing and publishing

1. After edits, run `npm install` (or `node install.js`) to refresh `settings.json` paths if you moved the tree.
2. Use `node --check hooks/<file>.js` for a quick syntax check.
3. Before `npm publish`, change `name` in `package.json` from `@yourorg/claude-otel-hooks` to your npm scope and verify `files` / `.npmignore` if you add any (defaults include most of the tree).

---

## License

Add a `LICENSE` file if you distribute this package; none is included by default in this template.
