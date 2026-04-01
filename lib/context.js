import fs from 'fs';
import path from 'path';
import os from 'os';
import { trace, context, TraceFlags } from '@opentelemetry/api';

const CTX_DIR = path.join(os.tmpdir(), 'claude-otel');
fs.mkdirSync(CTX_DIR, { recursive: true });

const ctxFile = id => path.join(CTX_DIR, `session-${id}.json`);

export function saveContext(sessionId, traceId, spanId) {
  fs.writeFileSync(ctxFile(sessionId), JSON.stringify({ traceId, spanId, startTime: Date.now() }));
}
export function loadContext(sessionId) {
  try { return JSON.parse(fs.readFileSync(ctxFile(sessionId), 'utf8')); }
  catch { return null; }
}
export function clearContext(sessionId) {
  try { fs.unlinkSync(ctxFile(sessionId)); } catch {}
}
export function makeChildContext(ctx) {
  if (!ctx) return context.active();
  return trace.setSpan(context.active(), trace.wrapSpanContext({
    traceId: ctx.traceId, spanId: ctx.spanId,
    traceFlags: TraceFlags.SAMPLED, isRemote: false,
  }));
}
