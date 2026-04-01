import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { loadContext, makeChildContext } from '../lib/context.js';
import { mergeAttributes, attributesPostCompact } from '../lib/genai.js';

const raw = await readStdin();
const span = tracer.startSpan('claude_code.post_compact',
  { attributes: mergeAttributes(
    { 'claude.event_type': 'PostCompact',
      'claude.session_id': raw.session_id ?? 'unknown',
      'claude.tokens_before': raw.tokens_before ?? undefined,
      'claude.tokens_after': raw.tokens_after ?? undefined,
      'claude.tokens_saved': raw.tokens_saved ?? undefined },
    attributesPostCompact(raw),
  ) },
  makeChildContext(loadContext(raw.session_id)));
span.end(); await shutdown();
