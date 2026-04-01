import { SpanKind } from '@opentelemetry/api';
import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext, clearContext } from '../lib/context.js';
import { mergeAttributes, spanNameInvokeAgent, attributesInvokeAgent } from '../lib/genai.js';

const raw = await readStdin();
const span = tracer.startSpan(spanNameInvokeAgent(raw),
  { kind: SpanKind.INTERNAL, attributes: mergeAttributes(
    { 'claude.event_type': 'SubagentStop',
      'claude.session_id': raw.session_id ?? 'unknown' },
    attributesInvokeAgent(raw),
  ) },
  makeChildContext(loadContext(raw.session_id)));
span.end(); clearContext(raw.session_id); await shutdown();
