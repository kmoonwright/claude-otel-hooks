import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext } from '../lib/context.js';
import { mergeAttributes, attributesConversationOnly } from '../lib/genai.js';

const raw = await readStdin();
const span = tracer.startSpan('claude_code.notification',
  { attributes: mergeAttributes(
    { 'claude.event_type': 'Notification',
      'claude.session_id': raw.session_id ?? 'unknown',
      'claude.notification_type': raw.type ?? 'unknown' },
    attributesConversationOnly(raw),
  ) },
  makeChildContext(loadContext(raw.session_id)));
span.end(); await shutdown();
