/**
 * The internal fetch layer — composes auth + retry + telemetry.
 *
 * Every SDK request goes through `request()`, which:
 *   1. Resolves the Authorization header (auth context).
 *   2. Generates request_id + traceparent (telemetry).
 *   3. Calls fetch with the composed headers.
 *   4. On non-2xx, parses the error envelope into RcrtError.
 *   5. Retries retryable errors (5xx + 429) with backoff.
 *   6. Logs sdk.request.started / .succeeded / .failed (telemetry).
 */
import { RcrtError, SdkError } from '../errors.js';
import { withRetry } from '../retry.js';
/**
 * Build the full URL from baseURL + path + query.
 */
export function buildURL(baseURL, path, query) {
    const url = new URL(path, baseURL);
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined)
                continue;
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (item !== undefined) {
                        url.searchParams.append(key, typeof item === 'string' ? item : String(item));
                    }
                }
            }
            else {
                const strVal = typeof value === 'string'
                    ? value
                    : typeof value === 'number' || typeof value === 'boolean'
                        ? String(value)
                        : JSON.stringify(value);
                url.searchParams.set(key, strVal);
            }
        }
    }
    return url.toString();
}
/**
 * Execute a request with auth + retry + telemetry. Returns the Response +
 * parsed JSON (if the response has a JSON body).
 *
 * Throws RcrtError on non-2xx responses. Throws SdkError on pre-request
 * failures (auth, abort).
 */
export async function request(ctx, method, path, options = {}) {
    const { query, json, headers: customHeaders, retry, signal: _signal, ...restInit } = options;
    const signal = _signal ?? undefined;
    const url = buildURL(ctx.baseURL, path, query);
    const requestId = ctx.telemetry.newRequestId();
    const traceparent = ctx.telemetry.newTraceparent();
    const span = ctx.telemetry.otel?.startSpan(`sdk.request.${method.toLowerCase()}`, {
        attributes: {
            'http.method': method,
            'http.url': url,
            request_id: requestId,
        },
    });
    const headers = new Headers(customHeaders);
    headers.set('Authorization', await ctx.auth.authorizationHeader());
    headers.set('X-Request-Id', requestId);
    headers.set('traceparent', traceparent);
    if (ctx.tenantId) {
        headers.set('X-Tenant-ID', ctx.tenantId);
    }
    if (json !== undefined) {
        headers.set('Content-Type', 'application/json');
    }
    ctx.telemetry.logger.info('sdk.request.started', {
        method,
        url,
        request_id: requestId,
        trace_id: traceparent,
        auth_method: ctx.auth.method,
    });
    const startTime = Date.now();
    try {
        const response = await withRetry(async (attempt) => {
            if (attempt > 0) {
                ctx.telemetry.logger.info('sdk.retry.attempted', {
                    attempt,
                    method,
                    url,
                    request_id: requestId,
                });
            }
            const body = json !== undefined ? JSON.stringify(json) : options.body;
            const res = await ctx.fetchImpl(url, {
                ...restInit,
                method,
                headers,
                body,
                signal,
            });
            if (!res.ok) {
                const error = await RcrtError.fromResponse(res);
                span?.recordError(error);
                throw error;
            }
            return res;
        }, { ...ctx.defaultRetry, ...retry, signal });
        const latencyMs = Date.now() - startTime;
        const responseRequestId = response.headers.get('x-request-id') ?? requestId;
        ctx.telemetry.logger.info('sdk.request.succeeded', {
            method,
            url,
            status: response.status,
            latency_ms: latencyMs,
            request_id: responseRequestId,
            trace_id: traceparent,
        });
        span?.setAttribute('http.status_code', response.status);
        span?.setAttribute('latency_ms', latencyMs);
        const contentType = response.headers.get('content-type') ?? '';
        const data = contentType.includes('application/json')
            ? (await response.json())
            : undefined;
        return { response, data };
    }
    catch (error) {
        const latencyMs = Date.now() - startTime;
        const err = error;
        if (error instanceof RcrtError) {
            ctx.telemetry.logger.error('sdk.request.failed', {
                method,
                url,
                status: err.status,
                code: err.code,
                retryable: err.retryable,
                latency_ms: latencyMs,
                request_id: err.requestId ?? requestId,
                trace_id: traceparent,
            });
            span?.setAttribute('http.status_code', err.status);
        }
        else if (error instanceof Error && error.message === 'Aborted.') {
            ctx.telemetry.logger.warn('sdk.request.aborted', {
                method,
                url,
                latency_ms: latencyMs,
                request_id: requestId,
                trace_id: traceparent,
            });
        }
        else {
            ctx.telemetry.logger.error('sdk.request.failed', {
                method,
                url,
                error: String(error),
                latency_ms: latencyMs,
                request_id: requestId,
                trace_id: traceparent,
            });
        }
        span?.recordError(error);
        throw error;
    }
    finally {
        span?.end();
    }
}
/**
 * Open an SSE stream with auth + telemetry (no retry — SSE retry is the
 * consumer's responsibility via Last-Event-ID).
 */
export async function openSSEStream(ctx, path, options = {}) {
    const url = buildURL(ctx.baseURL, path);
    const requestId = ctx.telemetry.newRequestId();
    const traceparent = ctx.telemetry.newTraceparent();
    const headers = new Headers(options.headers);
    headers.set('Authorization', await ctx.auth.authorizationHeader());
    headers.set('X-Request-Id', requestId);
    headers.set('traceparent', traceparent);
    headers.set('Accept', 'text/event-stream');
    if (ctx.tenantId) {
        headers.set('X-Tenant-ID', ctx.tenantId);
    }
    if (options.lastEventId) {
        headers.set('Last-Event-ID', options.lastEventId);
    }
    if (options.json !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    ctx.telemetry.logger.info('sdk.sse.opening', {
        url,
        method: options.method ?? 'GET',
        request_id: requestId,
        trace_id: traceparent,
    });
    const body = options.body !== undefined
        ? options.body
        : options.json !== undefined
            ? JSON.stringify(options.json)
            : undefined;
    const response = await ctx.fetchImpl(url, {
        method: options.method ?? 'GET',
        headers,
        body,
        signal: options.signal,
    });
    if (!response.ok) {
        throw await RcrtError.fromResponse(response);
    }
    return response;
}
export { SdkError };
//# sourceMappingURL=fetch.js.map