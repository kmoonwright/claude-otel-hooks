## Reference

Blog Post here: https://www.honeycomb.io/blog/measuring-claude-code-roi-adoption-honeycomb#configuring-claude-code-to-send-telemetry-to-honeycomb
Implement log and metrics signals using built-in configurations


```json
{
    "env": {
      "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
      "OTEL_METRICS_EXPORTER": "otlp",
      "OTEL_LOGS_EXPORTER": "otlp",
      "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
      "OTEL_METRIC_EXPORT_INTERVAL": "10000",
      "OTEL_LOGS_EXPORT_INTERVAL": "5000",
      "OTEL_EXPORTER_OTLP_ENDPOINT": "api.honeycomb.io:443",
      "OTEL_EXPORTER_OTLP_HEADERS": "x-honeycomb-dataset=claude,x-honeycomb-team=YOUR_API_KEY",
      "OTEL_SERVICE_NAME": "claude",
      "OTEL_RESOURCE_ATTRIBUTES": "service.name=claude"
    }
  }
```