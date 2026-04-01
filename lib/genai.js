/**
 * OpenTelemetry GenAI semantic conventions (development / experimental).
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/
 */

export function compact(attrs) {
  const out = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/** Merge objects; later keys win; drop undefined/null. */
export function mergeAttributes(...parts) {
  return compact(Object.assign({}, ...parts));
}

export function providerName() {
  const v = process.env.CLAUDE_OTEL_GEN_AI_PROVIDER?.trim();
  return v || 'anthropic';
}

/** Optional model name for span names and gen_ai.request.model (not in hook JSON). */
export function requestModel() {
  const v = process.env.CLAUDE_OTEL_GEN_AI_MODEL?.trim();
  return v || undefined;
}

export function conversationId(raw) {
  const id = raw?.session_id;
  if (id == null || id === '') return undefined;
  return String(id);
}

export function parentConversationId(raw) {
  const id = raw?.parent_session_id;
  if (id == null || id === '') return undefined;
  return String(id);
}

/**
 * Claude runs tools in the client; MCP tools use mcp__* names.
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/#execute-tool-span
 */
export function inferToolType(toolName) {
  if (!toolName || toolName === 'unknown') return undefined;
  const s = String(toolName);
  if (s.startsWith('mcp__')) return 'extension';
  return 'function';
}

export function toolCallId(raw) {
  const id = raw?.tool_use_id ?? raw?.tool_call_id;
  if (id == null || id === '') return undefined;
  return String(id);
}

/** Span name SHOULD be `execute_tool {gen_ai.tool.name}`. */
export function spanNameExecuteTool(toolName) {
  const t = toolName && toolName !== 'unknown' ? String(toolName) : 'unknown';
  return `execute_tool ${t}`;
}

/** Inference span name SHOULD be `{gen_ai.operation.name} {gen_ai.request.model}` when model known. */
export function spanNameChat() {
  const m = requestModel();
  return m ? `chat ${m}` : 'chat';
}

export function spanNameInvokeAgent(raw) {
  const t = raw?.agent_type;
  return t ? `invoke_agent ${String(t)}` : 'invoke_agent';
}

function withProvider(extra) {
  return compact({ 'gen_ai.provider.name': providerName(), ...extra });
}

/** Session start: conversation id; no standard operation for “IDE session”. */
export function attributesSessionStart(raw) {
  return withProvider({
    'gen_ai.conversation.id': conversationId(raw),
  });
}

/** User message → chat operation. */
export function attributesUserPrompt(raw) {
  return withProvider({
    'gen_ai.operation.name': 'chat',
    'gen_ai.conversation.id': conversationId(raw),
    'gen_ai.request.model': requestModel(),
  });
}

/** PreToolUse / PostToolUse / PostToolUseFailure / PermissionRequest (tool-related). */
export function attributesExecuteTool(raw, { errorType } = {}) {
  const toolName = raw?.tool_name ?? 'unknown';
  const out = {
    'gen_ai.operation.name': 'execute_tool',
    'gen_ai.conversation.id': conversationId(raw),
    'gen_ai.request.model': requestModel(),
    'gen_ai.tool.name': toolName,
    'gen_ai.tool.type': inferToolType(toolName),
  };
  const tc = toolCallId(raw);
  if (tc) out['gen_ai.tool.call.id'] = tc;
  if (errorType) out['error.type'] = errorType;
  return withProvider(out);
}

/** SubagentStart / SubagentStop */
export function attributesInvokeAgent(raw) {
  const conv = conversationId(raw) ?? parentConversationId(raw);
  const out = {
    'gen_ai.operation.name': 'invoke_agent',
    'gen_ai.conversation.id': conv,
    'gen_ai.request.model': requestModel(),
  };
  const aid = raw?.agent_id;
  if (aid != null && aid !== '') out['gen_ai.agent.id'] = String(aid);
  const at = raw?.agent_type;
  if (at != null && at !== '') out['gen_ai.agent.name'] = String(at);
  return withProvider(out);
}

/** Best-effort: map context size to usage.input_tokens (no separate “compact” op in spec). */
export function attributesPreCompact(raw) {
  const out = {
    'gen_ai.conversation.id': conversationId(raw),
    'gen_ai.request.model': requestModel(),
  };
  const n = raw?.context_tokens;
  if (typeof n === 'number') out['gen_ai.usage.input_tokens'] = n;
  return withProvider(out);
}

export function attributesPostCompact(raw) {
  const out = {
    'gen_ai.conversation.id': conversationId(raw),
    'gen_ai.request.model': requestModel(),
  };
  const after = raw?.tokens_after;
  if (typeof after === 'number') out['gen_ai.usage.input_tokens'] = after;
  return withProvider(out);
}

/** Stop / Notification: only provider + conversation where applicable. */
export function attributesConversationOnly(raw) {
  return withProvider({
    'gen_ai.conversation.id': conversationId(raw),
  });
}
