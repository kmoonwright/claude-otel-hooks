import { tracer, readStdin, shutdown } from '../lib/otel.js';
import { saveContext } from '../lib/context.js';
import { gitBranch, gitRepo } from '../lib/git.js';
import { mergeAttributes, attributesSessionStart } from '../lib/genai.js';
import os from 'os';

const raw = await readStdin();
const span = tracer.startSpan('claude_code.session', { attributes: mergeAttributes(
  {
    'claude.event_type': 'SessionStart',
    'claude.session_id': raw.session_id ?? 'unknown',
    'claude.working_dir': raw.cwd ?? process.cwd(),
    'vcs.branch': gitBranch(), 'vcs.repo': gitRepo(),
    'host.user': os.userInfo().username, 'host.os': os.platform(),
  },
  attributesSessionStart(raw),
)});
saveContext(raw.session_id, span.spanContext().traceId, span.spanContext().spanId);
span.end(); await shutdown();
