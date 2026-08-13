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
/** Default retry options. */
export const DEFAULT_RETRY = {
    maxAttempts: 3,
    baseMs: 200,
    capMs: 5_000,
    deadlineMs: 30_000,
};
/** Compute the full-jitter delay for an attempt (0-indexed). */
export function fullJitterDelay(attempt, baseMs = DEFAULT_RETRY.baseMs, capMs = DEFAULT_RETRY.capMs) {
    const expo = baseMs * Math.pow(2, attempt);
    const capped = Math.min(capMs, expo);
    return Math.floor(Math.random() * capped);
}
/** Should this error be retried? 5xx + 429 are retryable; 4xx (except 429) are not. */
export function isRetryableError(error) {
    if (error && typeof error === 'object' && 'status' in error) {
        const status = error.status;
        return status >= 500 || status === 429;
    }
    // Network errors (TypeError: Failed to fetch) are retryable.
    if (error instanceof TypeError) {
        return true;
    }
    return false;
}
/**
 * Run an async function with retry + exponential backoff + full jitter.
 * The function receives the attempt number (0-indexed).
 */
export async function withRetry(fn, options = {}) {
    const maxAttempts = options.maxAttempts ?? DEFAULT_RETRY.maxAttempts;
    const deadlineMs = options.deadlineMs ?? DEFAULT_RETRY.deadlineMs;
    const signal = options.signal;
    const onRetry = options.onRetry;
    const start = Date.now();
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (signal?.aborted) {
            throw new Error('Aborted.');
        }
        if (Date.now() - start > deadlineMs) {
            throw lastError ?? new Error('Retry deadline exceeded.');
        }
        try {
            return await fn(attempt);
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt >= maxAttempts - 1 || !isRetryableError(error)) {
                throw error;
            }
            const delayMs = retryDelayMs(error, attempt, options);
            onRetry?.({ attempt: attempt + 1, delayMs, error });
            await sleep(delayMs, signal);
        }
    }
    throw lastError ?? new Error('Retry exhausted.');
}
/** Compute the retry delay, honoring Retry-After if the error carries it. */
function retryDelayMs(error, attempt, options) {
    const jittered = fullJitterDelay(attempt, options.baseMs ?? DEFAULT_RETRY.baseMs, options.capMs ?? DEFAULT_RETRY.capMs);
    if (error && typeof error === 'object' && 'retryAfterMs' in error) {
        const retryAfterMs = error.retryAfterMs;
        if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
            return Math.max(retryAfterMs, jittered);
        }
    }
    return jittered;
}
/** Cancellable sleep — rejects if the signal aborts. */
export function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error('Aborted.'));
            return;
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new Error('Aborted.'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
//# sourceMappingURL=retry.js.map