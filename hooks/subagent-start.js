import { SpanKind } from '@opentelemetry/api';
import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext, saveContext } from '../lib/context.js';
import { mergeAttributes, spanNameInvokeAgent, attributesInvokeAgent } from '../lib/genai.js';

const raw = await readStdin();
const span = tracer.startSpan(spanNameInvokeAgent(raw),
  { kind: SpanKind.INTERNAL, attributes: mergeAttributes(
    { 'claude.event_type': 'SubagentStart',
      'claude.session_id': raw.session_id ?? 'unknown',
      'claude.parent_session_id': raw.parent_session_id ?? 'unknown' },
    attributesInvokeAgent(raw),
  ) },
  makeChildContext(loadContext(raw.session_id ?? raw.parent_session_id)));
if (raw.session_id) saveContext(raw.session_id, span.spanContext().traceId, span.spanContext().spanId);
span.end(); await shutdown();
