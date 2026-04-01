import { SpanKind } from '@opentelemetry/api';
import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext } from '../lib/context.js';
import { mergeAttributes, spanNameChat, attributesUserPrompt } from '../lib/genai.js';
import { spanAttributesInputMessages, inputMessagesFromUserPrompt } from '../lib/genai-messages.js';

const raw = await readStdin();
const span = tracer.startSpan(spanNameChat(),
  { kind: SpanKind.CLIENT, attributes: mergeAttributes(
    { 'claude.event_type': 'UserPromptSubmit',
      'claude.session_id': raw.session_id ?? 'unknown',
      'claude.prompt_length': raw.message?.length ?? 0 },
    attributesUserPrompt(raw),
    spanAttributesInputMessages(raw, inputMessagesFromUserPrompt),
  ) },
  makeChildContext(loadContext(raw.session_id)));
span.end(); await shutdown();
