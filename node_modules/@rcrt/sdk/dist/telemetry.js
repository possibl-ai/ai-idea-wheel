/**
 * Telemetry — client-side structured logging + optional OpenTelemetry hook.
 *
 * The SDK emits structured logs with the same `request_id` + `trace_id` the
 * server uses (propagated via X-Request-Id + W3C traceparent), so agents can
 * correlate a request end-to-end from consumer -> api-gateway -> kernel
 * services -> response (per architecture/06_LOGGING_SYSTEM.md §5).
 *
 * The logger is opt-in — the default is a no-op logger. The consumer passes
 * an ILogger implementation (e.g. a structured logger writing to their own
 * observability stack).
 *
 * Optional OpenTelemetry: the consumer passes an `otelTracer` — the SDK
 * creates spans for each request + SSE stream. This is opt-in (the SDK does
 * not depend on @opentelemetry/api unless the consumer provides a tracer).
 */
/** A no-op logger (the default — emits nothing). */
export const noopLogger = {
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
};
/** A console logger (useful for development). */
export const consoleLogger = {
    debug: (event, fields) => console.debug(event, fields ?? ''),
    info: (event, fields) => console.info(event, fields ?? ''),
    warn: (event, fields) => console.warn(event, fields ?? ''),
    error: (event, fields) => console.error(event, fields ?? ''),
};
/** Generate a W3C traceparent header value (trace_id + span_id). */
export function generateTraceparent() {
    const traceId = cryptoRandomHex(16);
    const spanId = cryptoRandomHex(8);
    return `00-${traceId}-${spanId}-01`;
}
/** Generate a request_id (UUID v4 style). */
export function generateRequestId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return cryptoRandomHex(16);
}
function cryptoRandomHex(bytes) {
    const arr = new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
        crypto.getRandomValues(arr);
    }
    else {
        for (let i = 0; i < bytes; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}
/** Build a TelemetryContext from consumer-provided options. */
export function createTelemetryContext(opts = {}) {
    return {
        logger: opts.logger ?? noopLogger,
        otel: opts.otel,
        newRequestId: generateRequestId,
        newTraceparent: generateTraceparent,
    };
}
//# sourceMappingURL=telemetry.js.map