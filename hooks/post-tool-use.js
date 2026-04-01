import { SpanKind } from '@opentelemetry/api';
import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext, saveContext } from '../lib/context.js';
import { SpanStatusCode } from '@opentelemetry/api';
import { mergeAttributes, spanNameExecuteTool, attributesExecuteTool } from '../lib/genai.js';
import { spanAttributesInputMessages, inputMessagesFromPostTool } from '../lib/genai-messages.js';

const raw = await readStdin();
const exitCode = raw.tool_response?.exit_code ?? 0;
const toolName = raw.tool_name ?? 'unknown';
const errorType = exitCode !== 0 ? 'tool.non_zero_exit' : undefined;
const span = tracer.startSpan(spanNameExecuteTool(toolName),
  { kind: SpanKind.INTERNAL, attributes: mergeAttributes(
    { 'claude.event_type': 'PostToolUse',
      'claude.session_id': raw.session_id ?? 'unknown',
      'claude.tool_name': toolName,
      'claude.exit_code': exitCode,
      'claude.output_length': raw.tool_response?.output?.length ?? 0 },
    attributesExecuteTool(raw, { errorType }),
    spanAttributesInputMessages(raw, inputMessagesFromPostTool),
  ) },
  makeChildContext(loadContext(raw.session_id)));
if (exitCode !== 0) span.setStatus({ code: SpanStatusCode.ERROR, message: `exit code ${exitCode}` });
saveContext(raw.session_id, span.spanContext().traceId, span.spanContext().spanId);
span.end(); await shutdown();
