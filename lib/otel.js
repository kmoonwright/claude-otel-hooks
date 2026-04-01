import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace } from '@opentelemetry/api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, '..');
const rawDotenvPath = process.env.CLAUDE_OTEL_DOTENV_PATH;
const dotenvPath = rawDotenvPath
  ? path.isAbsolute(rawDotenvPath)
    ? rawDotenvPath
    : path.join(packageRoot, rawDotenvPath)
  : path.join(packageRoot, '.env');

dotenv.config({ path: dotenvPath });

const HONEYCOMB_API_KEY = process.env.HONEYCOMB_API_KEY;
const HONEYCOMB_DATASET = process.env.HONEYCOMB_DATASET ?? 'claude-code';
const HONEYCOMB_OTLP_TRACES_ENDPOINT =
  process.env.HONEYCOMB_OTLP_TRACES_ENDPOINT ?? 'https://api.honeycomb.io/v1/traces';

export const exporter = new OTLPTraceExporter({
  url: HONEYCOMB_OTLP_TRACES_ENDPOINT,
  headers: {
    'x-honeycomb-team': HONEYCOMB_API_KEY ?? '',
    'x-honeycomb-dataset': HONEYCOMB_DATASET,
  },
});

export const sdk = new NodeSDK({ traceExporter: exporter });
sdk.start();
export const tracer = trace.getTracer('claude-code-hooks', '1.0.0');
export async function shutdown() { await sdk.shutdown(); }

export function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    setTimeout(() => resolve({}), 100);
  });
}
