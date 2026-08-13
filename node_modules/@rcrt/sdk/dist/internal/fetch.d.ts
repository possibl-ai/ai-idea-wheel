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
import type { AuthContext } from '../auth.js';
import type { TelemetryContext } from '../telemetry.js';
import { SdkError } from '../errors.js';
import { type RetryOptions } from '../retry.js';
/** Request options (extends the standard fetch init). */
export interface RequestOptions extends RequestInit {
    /** Query string parameters (appended to the URL). */
    query?: Record<string, string | number | boolean | undefined>;
    /** Request body (will be JSON.stringify'd; sets Content-Type: application/json). */
    json?: unknown;
    /** Retry options (overrides the client default). */
    retry?: RetryOptions;
}
/** The result of a request — the Response + parsed JSON (if any). */
export interface RequestResult<T> {
    response: Response;
    data: T | undefined;
}
/** The fetch context — the shared state for all requests. */
export interface FetchContext {
    baseURL: string;
    auth: AuthContext;
    telemetry: TelemetryContext;
    defaultRetry: RetryOptions;
    fetchImpl: typeof fetch;
    /** Optional default tenant id (sent as X-Tenant-ID). */
    tenantId?: string;
}
/**
 * Build the full URL from baseURL + path + query.
 */
export declare function buildURL(baseURL: string, path: string, query?: Record<string, unknown>): string;
/**
 * Execute a request with auth + retry + telemetry. Returns the Response +
 * parsed JSON (if the response has a JSON body).
 *
 * Throws RcrtError on non-2xx responses. Throws SdkError on pre-request
 * failures (auth, abort).
 */
export declare function request<T = unknown>(ctx: FetchContext, method: string, path: string, options?: RequestOptions): Promise<RequestResult<T>>;
/**
 * Open an SSE stream with auth + telemetry (no retry — SSE retry is the
 * consumer's responsibility via Last-Event-ID).
 */
export declare function openSSEStream(ctx: FetchContext, path: string, options?: {
    method?: string;
    json?: unknown;
    body?: BodyInit;
    signal?: AbortSignal;
    lastEventId?: string;
    headers?: HeadersInit;
}): Promise<Response>;
export { SdkError };
//# sourceMappingURL=fetch.d.ts.map