# claude-otel-hooks

OpenTelemetry hooks for [Claude Code](https://claude.ai/code) that send **12 lifecycle events** to [Honeycomb](https://www.honeycomb.io/) as spans. Spans include **[OpenTelemetry GenAI](https://opentelemetry.io/docs/specs/semconv/gen-ai/)** attributes (`gen_ai.*`) where applicable, plus `claude.*` for Claude-specific fields. Prompt and tool **content** are not sent by default—only lengths, names, and metadata. Optional **opt-in** env vars (`CLAUDE_OTEL_RECORD_GEN_AI_MESSAGES`, etc.) can add `gen_ai.input.messages` / `gen_ai.output.messages` (see [README.detailed.md](./README.detailed.md#opentelemetry-genai-conventions)).

**Full documentation:** [README.detailed.md](./README.detailed.md)

## Requirements

- **Node.js 18+** (`node` on `PATH` when Claude runs hooks)
- **Honeycomb** API key (and optionally a dataset name)

## Configure

Create a **`.env` file in the package root** (same directory as `package.json`—where this repo’s hooks resolve from). Copy the template:

```bash
cp .env.example .env
```

Edit `.env` and set at least `HONEYCOMB_API_KEY`. Optional: `HONEYCOMB_DATASET`, `HONEYCOMB_OTLP_TRACES_ENDPOINT`, `CLAUDE_OTEL_DOTENV_PATH`, GenAI metadata (`CLAUDE_OTEL_GEN_AI_MODEL` / `CLAUDE_OTEL_GEN_AI_PROVIDER`), and **opt-in** message capture (`CLAUDE_OTEL_RECORD_GEN_AI_MESSAGES`, etc.)—see [README.detailed.md](./README.detailed.md#environment-variables).

`.env` is loaded by every hook via `lib/otel.js`. Variables **already set in the process environment are not overwritten** (shell exports win). **Do not commit `.env`**—it is gitignored.

## Install

```bash
cd /path/to/claude-otel-hooks
npm install
```

`postinstall` runs `install.js` and registers hooks in `~/.claude/settings.json`. **Restart Claude Code** afterward.

Published package (after you set `name` in `package.json`):

```bash
npm install -g @yourorg/claude-otel-hooks
```

Put `.env` in that **global package directory** (next to its `package.json`), e.g. under `$(npm root -g)/@yourorg/claude-otel-hooks/`.

## Usage

Use Claude Code as usual. In Honeycomb, query your dataset and filter or group by `claude.event_type`, `claude.session_id`, or span names like `claude_code.session`.

## Uninstall

1. **Remove the hooks** so Claude Code stops calling this package. Edit `~/.claude/settings.json` and delete the `hooks` entries this installer added (or remove the whole `hooks` object if nothing else uses it). The events are: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `SubagentStart`, `SubagentStop`, `Notification`, `Stop`, `PreCompact`, `PostCompact`.
2. **Restart Claude Code** so it reloads settings.
3. **Optional — remove the package:** from a clone you can delete the directory; if you installed globally, run `npm uninstall -g @yourorg/claude-otel-hooks` (use the same `name` as in `package.json`).
4. **Optional — local secrets and cache:** delete the package **`.env`** if present; remove any `HONEYCOMB_*` entries you added only for this tool. Session helper files under `$TMPDIR/claude-otel/` are safe to delete when Claude Code is not running.

No other system integration is required—uninstall is limited to Claude settings, npm, and those files.

## Notes

- **`install.js` replaces** each listed hook in `settings.json` with these scripts (using Claude’s [matcher + `hooks` array](https://code.claude.com/docs/en/hooks) shape). It also **removes** deprecated keys (`ToolError`, `SubagentError`, `McpServerStart`) from an older install so the file validates. Back up `~/.claude/settings.json` if you use custom hooks on the same events.
- With **`.env` in the package root**, GUI Claude Code does not need shell `export` for Honeycomb keys ([more detail](./README.detailed.md#operational-notes)).

## Layout

| Path | Purpose |
|------|---------|
| `.env.example` | Template for `.env` (safe to commit) |
| `install.js` | Writes hook commands |
| `lib/` | Loads `.env`, OTel exporter, `genai.js` (GenAI semconv), session trace context, git metadata |
| `hooks/` | One script per registered Claude event (12) |
