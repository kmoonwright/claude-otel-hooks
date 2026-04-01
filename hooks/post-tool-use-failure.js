import { SpanKind } from '@opentelemetry/api';
import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext } from '../lib/context.js';
import { SpanStatusCode } from '@opentelemetry/api';
import { mergeAttributes, spanNameExecuteTool, attributesExecuteTool } from '../lib/genai.js';
import { spanAttributesInputMessages, inputMessagesFromPostToolFailure } from '../lib/genai-messages.js';

const raw = await readStdin();
const toolName = raw.tool_name ?? 'unknown';
const span = tracer.startSpan(spanNameExecuteTool(toolName),
  { kind: SpanKind.INTERNAL, attributes: mergeAttributes(
    { 'claude.event_type': 'PostToolUseFailure',
      'claude.session_id': raw.session_id ?? 'unknown',
      'claude.tool_name': toolName },
    attributesExecuteTool(raw, { errorType: 'tool.execution_failed' }),
    spanAttributesInputMessages(raw, inputMessagesFromPostToolFailure),
  ) },
  makeChildContext(loadContext(raw.session_id)));
span.setStatus({ code: SpanStatusCode.ERROR }); span.end(); await shutdown();
