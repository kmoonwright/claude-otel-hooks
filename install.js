#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

// Names must match https://code.claude.com/docs/en/hooks#hook-events
const hookEvents = [
  'SessionStart', 'UserPromptSubmit', 'PreToolUse',
  'PostToolUse', 'PostToolUseFailure', 'PermissionRequest',
  'SubagentStart', 'SubagentStop',
  'Notification', 'Stop', 'PreCompact', 'PostCompact',
];

/** Removed from Claude’s hook schema; delete if still present or settings.json is rejected. */
const obsoleteHookEvents = ['McpServerStart', 'SubagentError', 'ToolError'];

function eventToFilename(event) {
  return event.replace(/([A-Z])/g, (m, l, i) => (i ? '-' : '') + l.toLowerCase()) + '.js';
}

/** Claude Code expects matcher groups: [{ matcher, hooks: [{ type, command }] }]. */
function matcherGroup(scriptPath) {
  return [
    {
      matcher: '*',
      hooks: [{ type: 'command', command: `node ${scriptPath}` }],
    },
  ];
}

let settings = {};
if (fs.existsSync(settingsPath)) {
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
  catch { console.warn('Could not parse existing settings.json — starting fresh.'); }
}

settings.hooks ??= {};
for (const key of obsoleteHookEvents) {
  if (Object.prototype.hasOwnProperty.call(settings.hooks, key)) {
    delete settings.hooks[key];
    console.warn(`Removed obsolete hook key "${key}" (not valid in current Claude Code).`);
  }
}
for (const event of hookEvents) {
  const scriptPath = path.join(__dirname, 'hooks', eventToFilename(event));
  settings.hooks[event] = matcherGroup(scriptPath);
}

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log('✓ Claude Code OTel hooks installed into ~/.claude/settings.json');
