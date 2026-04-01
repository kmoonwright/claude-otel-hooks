/**
 * Opt-in gen_ai.input.messages / gen_ai.output.messages (JSON strings on spans).
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-input-messages.json
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-output-messages.json
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/#recording-content-on-attributes
 */

function envTrue(key) {
  const v = process.env[key]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function recordGenAiInputMessages() {
  return envTrue('CLAUDE_OTEL_RECORD_GEN_AI_MESSAGES')
    || envTrue('CLAUDE_OTEL_RECORD_GEN_AI_INPUT_MESSAGES');
}

export function recordGenAiOutputMessages() {
  return envTrue('CLAUDE_OTEL_RECORD_GEN_AI_MESSAGES')
    || envTrue('CLAUDE_OTEL_RECORD_GEN_AI_OUTPUT_MESSAGES');
}

export function maxMessageChars() {
  const n = parseInt(process.env.CLAUDE_OTEL_GEN_AI_MESSAGE_MAX_CHARS ?? '32768', 10);
  return Number.isFinite(n) && n > 0 ? n : 32768;
}

/** Truncate a string for message bodies (not JSON structure). */
export function truncateText(str) {
  if (str == null) return '';
  const s = typeof str === 'string' ? str : JSON.stringify(str);
  const max = maxMessageChars();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…[truncated ${s.length - max} chars]`;
}

function textPart(content) {
  return { type: 'text', content: truncateText(content) };
}

/** Serialize message arrays for span attributes (OTLP commonly uses string values). */
export function messagesAttribute(key, messages) {
  if (!messages?.length) return {};
  return { [key]: JSON.stringify(messages) };
}

/** UserPromptSubmit — user message only. */
export function inputMessagesFromUserPrompt(raw) {
  const msg = raw?.message;
  if (msg == null) return undefined;
  const text = typeof msg === 'string' ? msg : (typeof msg === 'object' ? JSON.stringify(msg) : String(msg));
  if (!text) return undefined;
  return [{ role: 'user', parts: [textPart(text)] }];
}

/** PreToolUse — assistant requested a tool call. */
export function inputMessagesFromPreTool(raw) {
  const name = raw?.tool_name;
  if (!name || name === 'unknown') return undefined;
  const id = raw?.tool_use_id ?? raw?.tool_call_id ?? null;
  let args = raw?.tool_input ?? raw?.input ?? raw?.arguments;
  if (args !== undefined && args !== null && typeof args !== 'object') {
    args = { value: args };
  }
  const part = {
    type: 'tool_call',
    name: String(name),
    ...(id ? { id: String(id) } : {}),
    ...(args !== undefined && args !== null ? { arguments: args } : {}),
  };
  return [{ role: 'assistant', parts: [part] }];
}

/** PostToolUse — tool result returned toward the model. */
export function inputMessagesFromPostTool(raw) {
  const id = raw?.tool_use_id ?? raw?.tool_call_id;
  const out = raw?.tool_response?.output;
  if (id == null && (out === undefined || out === null)) return undefined;
  let response = out;
  if (typeof response === 'string') response = truncateText(response);
  else if (response !== undefined && response !== null) response = response;
  else response = '';
  const part = {
    type: 'tool_call_response',
    ...(id ? { id: String(id) } : {}),
    response,
  };
  return [{ role: 'tool', parts: [part] }];
}

/** PostToolUseFailure — tool error as response payload. */
export function inputMessagesFromPostToolFailure(raw) {
  const id = raw?.tool_use_id ?? raw?.tool_call_id;
  const err = raw?.error ?? raw?.error_message ?? raw?.message ?? 'tool_execution_failed';
  const response = typeof err === 'object' && err !== null ? err : String(err);
  const part = {
    type: 'tool_call_response',
    ...(id ? { id: String(id) } : {}),
    response,
  };
  return [{ role: 'tool', parts: [part] }];
}

/** Stop — last assistant text when the hook exposes it. */
export function outputMessagesFromStop(raw) {
  const text = raw?.last_assistant_message
    ?? raw?.assistant_message
    ?? raw?.assistant_response
    ?? raw?.response;
  if (text == null || text === '') return undefined;
  const t = typeof text === 'string' ? text : JSON.stringify(text);
  return [{
    role: 'assistant',
    parts: [textPart(t)],
    finish_reason: 'stop',
  }];
}

export function spanAttributesInputMessages(raw, builder) {
  if (!recordGenAiInputMessages()) return {};
  const messages = builder(raw);
  return messagesAttribute('gen_ai.input.messages', messages);
}

export function spanAttributesOutputMessages(raw, builder) {
  if (!recordGenAiOutputMessages()) return {};
  const messages = builder(raw);
  return messagesAttribute('gen_ai.output.messages', messages);
}
