import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext, clearContext } from '../lib/context.js';
import { mergeAttributes, attributesConversationOnly } from '../lib/genai.js';
import { spanAttributesOutputMessages, outputMessagesFromStop } from '../lib/genai-messages.js';

const raw = await readStdin();
const ctx = loadContext(raw.session_id);
const span = tracer.startSpan('claude_code.session_stop',
  { attributes: mergeAttributes(
    { 'claude.event_type': 'Stop',
      'claude.session_id': raw.session_id ?? 'unknown',
      'claude.total_duration_ms': ctx ? Date.now() - ctx.startTime : undefined,
      'claude.turn_count': raw.turn_count ?? undefined },
    attributesConversationOnly(raw),
    spanAttributesOutputMessages(raw, outputMessagesFromStop),
  ) },
  makeChildContext(ctx));
span.end(); clearContext(raw.session_id); await shutdown();
