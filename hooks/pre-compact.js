import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext } from '../lib/context.js';
import { mergeAttributes, attributesPreCompact } from '../lib/genai.js';

const raw = await readStdin();
const span = tracer.startSpan('claude_code.pre_compact',
  { attributes: mergeAttributes(
    { 'claude.event_type': 'PreCompact',
      'claude.session_id': raw.session_id ?? 'unknown',
      'claude.context_tokens': raw.context_tokens ?? undefined },
    attributesPreCompact(raw),
  ) },
  makeChildContext(loadContext(raw.session_id)));
span.end(); await shutdown();
