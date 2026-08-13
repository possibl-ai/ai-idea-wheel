/**
 * Retry + backoff — configurable, with sensible 2026 defaults.
 *
 * Defaults: exponential backoff with full jitter, max 3 retries, base 200ms,
 * cap 5s. Retries 5xx + 429 (honoring Retry-After). Does not retry 4xx
 * (except 429). Honors AbortSignal — retries are cancellable.
 *
 *   const result = await withRetry(
 *     () => fetch(url, { signal }),
 *     { maxAttempts: 3, signal },
 *   );
 *
 * Grounded in AWS Architecture Blog "Exponential Backoff And Jitter" (full
 * jitter outperforms equal jitter + no-jitter). See docs/sdk/00 §9.
 */
export interface RetryOptions {
    /** Max attempts (including the first). Default 3. */
    maxAttempts?: number;
    /** Base delay in ms (first retry's expected wait is base/2 with full jitter). Default 200. */
    baseMs?: number;
    /** Cap on the backoff delay. Default 5000. */
    capMs?: number;
    /** Total deadline in ms (caps retry time). Default 30000. */
    deadlineMs?: number;
    /** AbortSignal — retries abort when the signal aborts. */
    signal?: AbortSignal;
    /** Optional callback invoked on each retry (for telemetry). */
    onRetry?: (info: {
        attempt: number;
        delayMs: number;
        error: unknown;
    }) => void;
}
/** Default retry options. */
export declare const DEFAULT_RETRY: Required<Omit<RetryOptions, 'signal' | 'onRetry'>>;
/** Compute the full-jitter delay for an attempt (0-indexed). */
export declare function fullJitterDelay(attempt: number, baseMs?: number, capMs?: number): number;
/** Should this error be retried? 5xx + 429 are retryable; 4xx (except 429) are not. */
export declare function isRetryableError(error: unknown): boolean;
/**
 * Run an async function with retry + exponential backoff + full jitter.
 * The function receives the attempt number (0-indexed).
 */
export declare function withRetry<T>(fn: (attempt: number) => Promise<T>, options?: RetryOptions): Promise<T>;
/** Cancellable sleep — rejects if the signal aborts. */
export declare function sleep(ms: number, signal?: AbortSignal): Promise<void>;
//# sourceMappingURL=retry.d.ts.map