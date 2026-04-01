import { SpanKind } from '@opentelemetry/api';
import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext } from '../lib/context.js';
import { mergeAttributes, spanNameExecuteTool, attributesExecuteTool } from '../lib/genai.js';

const raw = await readStdin();
const toolName = raw.tool_name ?? 'unknown';
const span = tracer.startSpan(spanNameExecuteTool(toolName),
  { kind: SpanKind.INTERNAL, attributes: mergeAttributes(
    { 'claude.event_type': 'PermissionRequest',
      'claude.session_id': raw.session_id ?? 'unknown',
      'claude.tool_name': toolName,
      'claude.permission_type': raw.permission_type ?? 'unknown',
      'claude.granted': raw.granted ?? false },
    attributesExecuteTool(raw),
  ) },
  makeChildContext(loadContext(raw.session_id)));
span.end(); await shutdown();
