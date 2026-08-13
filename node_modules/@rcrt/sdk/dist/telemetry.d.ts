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
/** The logger interface the consumer implements. */
export interface ILogger {
    debug(event: string, fields?: Record<string, unknown>): void;
    info(event: string, fields?: Record<string, unknown>): void;
    warn(event: string, fields?: Record<string, unknown>): void;
    error(event: string, fields?: Record<string, unknown>): void;
}
/** A no-op logger (the default — emits nothing). */
export declare const noopLogger: ILogger;
/** A console logger (useful for development). */
export declare const consoleLogger: ILogger;
/**
 * An OpenTelemetry tracer interface (the consumer wraps their @opentelemetry/api
 * Tracer). The SDK calls `startSpan` for each request + SSE stream.
 */
export interface IOtelTracer {
    startSpan(name: string, opts?: {
        attributes?: Record<string, unknown>;
    }): IOtelSpan;
}
export interface IOtelSpan {
    setAttribute(key: string, value: unknown): void;
    recordError(error: unknown): void;
    end(): void;
}
/** Generate a W3C traceparent header value (trace_id + span_id). */
export declare function generateTraceparent(): string;
/** Generate a request_id (UUID v4 style). */
export declare function generateRequestId(): string;
/** The telemetry context — carries the logger, otel tracer, and correlation IDs. */
export interface TelemetryContext {
    logger: ILogger;
    otel: IOtelTracer | undefined;
    /** Generate a new request_id for each request. */
    newRequestId(): string;
    /** Generate a new traceparent for each request (or reuse an inbound one). */
    newTraceparent(): string;
}
/** Build a TelemetryContext from consumer-provided options. */
export declare function createTelemetryContext(opts?: {
    logger?: ILogger;
    otel?: IOtelTracer;
}): TelemetryContext;
//# sourceMappingURL=telemetry.d.ts.map