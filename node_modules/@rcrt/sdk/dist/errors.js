/**
 * Typed errors matching the api-gateway's structured error envelope.
 *
 * Every error response from the api-gateway uses the envelope defined in
 * `docs/architecture/06_LOGGING_SYSTEM.md` §4:
 *
 *   {
 *     "error": {
 *       "code": "platform.scope_violation",
 *       "message": "...",
 *       "retryable": false,
 *       "cause": { "code": "...", "message": "..." }
 *     }
 *   }
 *
 * The SDK maps this into `RcrtError` so consumers can:
 *
 *   try {
 *     await client.breadcrumbs.create({ ... });
 *   } catch (e) {
 *     if (e instanceof RcrtError) {
 *       if (e.code === 'platform.scope_violation') { ... }
 *       if (e.retryable) { ... retry ... }
 *     }
 *   }
 *
 * See docs/sdk/04_ERROR_HANDLING.md for the full error code catalogue.
 */
/**
 * RcrtError — the typed error thrown by the SDK for non-2xx responses.
 *
 * Carries the HTTP status, the structured error envelope, correlation IDs
 * (request_id, trace_id), and the Retry-After hint (for 429/503).
 */
export class RcrtError extends Error {
    status;
    code;
    retryable;
    cause;
    requestId;
    traceId;
    retryAfterMs;
    rawBody;
    /** The gateway's instruction for fixing this, when it sent one. */
    remediation;
    /** On `auth.workspace_not_selected`, the workspaces that would work. */
    selectableWorkspaces;
    /** On a 405, the methods this path does serve. */
    allowedMethods;
    /** When the request body was over the cap, the size that would have fit. */
    maxBytes;
    /** On 429 (and 503 when sent), the wait in seconds. */
    retryAfterSeconds;
    /** Handler-specific extras, e.g. a validation handler's field-level list. */
    details;
    /** In-repo doc path for this condition, when the gateway named one. */
    docs;
    constructor(status, envelope, opts = {}) {
        super(envelope.message);
        this.name = 'RcrtError';
        this.status = status;
        this.code = envelope.code;
        this.retryable = envelope.retryable;
        this.cause = envelope.cause;
        this.requestId = opts.requestId;
        this.traceId = opts.traceId;
        this.retryAfterMs = opts.retryAfterMs;
        this.rawBody = opts.rawBody;
        this.remediation = envelope.remediation;
        this.selectableWorkspaces = envelope.selectableWorkspaces;
        this.allowedMethods = envelope.allowedMethods;
        this.maxBytes = envelope.maxBytes;
        this.retryAfterSeconds = envelope.retryAfterSeconds;
        this.details = envelope.details;
        this.docs = envelope.docs;
    }
    /**
     * True when this 401 means "no workspace selected", NOT "bad credential".
     *
     * Branch on this before doing anything with the token. The two conditions
     * share a status code, and treating this one as an auth failure is an
     * infinite loop: re-authentication succeeds, the retry returns the identical
     * 401, forever. `selectableWorkspaces` names the ids that would work; an
     * empty array means the account is a member of nothing yet and needs
     * `POST /v1/auth/signup`, not a new token.
     */
    get isWorkspaceNotSelected() {
        return this.code === 'auth.workspace_not_selected';
    }
    /**
     * True only when the credential itself is the problem and re-authenticating
     * could plausibly help. Deliberately narrower than `status === 401`.
     */
    get isCredentialProblem() {
        if (this.isWorkspaceNotSelected)
            return false;
        return (this.status === 401 ||
            this.code === 'auth.token_expired' ||
            this.code === 'auth.token_invalid');
    }
    /**
     * Parse an HTTP response into an RcrtError.
     *
     * api-gateway and the bulk routes always send the structured
     * `{"error": {...}}` envelope with a `code` — that is enforced at one seam
     * (`services/internal/httperr.Normalize`), so the first branch below is the
     * only one those two hit.
     *
     * The fallbacks are kept deliberately, and are not dead code: a request may be
     * answered by something that is not either of them — a mesh sidecar, an
     * ingress, a load balancer, or a deployment older than the seam. A client that
     * threw on an unexpected body would turn "the proxy returned 502 HTML" into a
     * parse error instead of a 502.
     *
     * - The structured `{"error": {...}}` envelope (what the platform sends).
     * - A flat `{"error": "string"}` (code derived from status).
     * - Non-JSON bodies, including empty ones (code and message derived from
     *   status).
     */
    static async fromResponse(response) {
        const status = response.status;
        const requestId = response.headers.get('x-request-id') ?? undefined;
        const traceId = response.headers.get('x-trace-id') ?? undefined;
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : undefined;
        const rawBody = await response.text().catch(() => '');
        let envelope;
        try {
            const parsed = JSON.parse(rawBody);
            const err = parsed?.error;
            if (err && typeof err === 'object') {
                const code = typeof err.code === 'string' ? err.code : deriveCode(status);
                const message = typeof err.message === 'string' ? err.message : deriveMessage(status);
                const retryable = typeof err.retryable === 'boolean' ? err.retryable : false;
                const cause = (() => {
                    if (!err.cause || typeof err.cause !== 'object')
                        return undefined;
                    const c = err.cause;
                    const codeStr = typeof c.code === 'string' ? c.code : 'unknown';
                    const msgStr = typeof c.message === 'string' ? c.message : '';
                    return { code: codeStr, message: msgStr };
                })();
                envelope = {
                    code,
                    message,
                    retryable,
                    cause,
                    remediation: typeof err.remediation === 'string' ? err.remediation : undefined,
                    selectableWorkspaces: parseWorkspaceOptions(err.selectable_workspaces),
                    allowedMethods: parseStringArray(err.allowed_methods),
                    maxBytes: typeof err.max_bytes === 'number' ? err.max_bytes : undefined,
                    retryAfterSeconds: typeof err.retry_after_seconds === 'number' ? err.retry_after_seconds : undefined,
                    details: parseDetails(err.details),
                    docs: typeof err.docs === 'string' ? err.docs : undefined,
                };
            }
            else if (err && typeof err === 'string') {
                envelope = {
                    code: deriveCode(status),
                    message: err,
                    retryable: false,
                };
            }
            else {
                envelope = {
                    code: deriveCode(status),
                    message: deriveMessage(status),
                    retryable: status >= 500 || status === 429,
                };
            }
        }
        catch {
            envelope = {
                code: deriveCode(status),
                message: rawBody || deriveMessage(status),
                retryable: status >= 500 || status === 429,
            };
        }
        return new RcrtError(status, envelope, {
            requestId,
            traceId,
            retryAfterMs,
            rawBody,
        });
    }
}
/**
 * SdkError — thrown by the SDK before reaching the server (misconfiguration,
 * aborted request, network failure). Distinct from RcrtError (which is always
 * a server response).
 */
export class SdkError extends Error {
    cause;
    code;
    constructor(code, message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'SdkError';
        this.code = code;
    }
}
/** Narrow `allowed_methods` without trusting its shape. */
function parseStringArray(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const out = raw.filter((v) => typeof v === 'string');
    return out.length > 0 ? out : undefined;
}
/**
 * Narrow `details` to a plain object. Its keys are handler-specific by
 * definition, so the values stay `unknown` — the SDK will not pretend to know a
 * shape the gateway does not promise.
 */
function parseDetails(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return undefined;
    return raw;
}
/** Narrow the gateway's `selectable_workspaces` array without trusting its shape. */
function parseWorkspaceOptions(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const out = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== 'object')
            continue;
        const e = entry;
        if (typeof e.id !== 'string')
            continue;
        out.push({
            id: e.id,
            name: typeof e.name === 'string' ? e.name : '',
            role: typeof e.role === 'string' ? e.role : '',
        });
    }
    return out;
}
/**
 * Derive a stable dotted code from an HTTP status when the server didn't send one.
 *
 * 401 maps to `auth.unauthorized`, NOT `auth.token_invalid`. It used to map to
 * the latter, which was a factual claim the status does not support: this
 * gateway answers 401 both for a rejected credential and for an accepted
 * credential with no workspace selected. Naming the token as the cause told
 * every caller to re-authenticate, which fixes the first case and loops forever
 * on the second. A code that says only "unauthorized" is less specific and
 * true; `auth.token_invalid` is specific and, half the time, wrong. Callers
 * that need to tell the two apart should read the server-sent `error.code` —
 * see `RcrtError.isWorkspaceNotSelected`.
 */
function deriveCode(status) {
    switch (status) {
        case 400:
            return 'client.bad_request';
        case 401:
            return 'auth.unauthorized';
        case 403:
            return 'auth.forbidden';
        case 404:
            return 'client.not_found';
        case 402:
            return 'billing.payment_required';
        case 405:
            return 'client.method_not_allowed';
        case 408:
            return 'client.request_timeout';
        case 409:
            return 'client.conflict';
        case 410:
            return 'client.gone';
        case 413:
            return 'client.payload_too_large';
        case 415:
            return 'client.unsupported_media_type';
        case 422:
            return 'client.validation_failed';
        case 429:
            return 'client.rate_limited';
        case 500:
            return 'server.internal';
        case 501:
            return 'server.not_implemented';
        case 502:
        case 503:
            return 'server.unavailable';
        case 504:
            return 'server.timeout';
        default:
            return status >= 500 ? 'server.internal' : 'client.error';
    }
}
function deriveMessage(status) {
    switch (status) {
        case 400:
            return 'Bad request.';
        case 401:
            return 'Unauthorized. This may be a bad credential OR a valid credential with no workspace selected — check error.code.';
        case 403:
            return 'Forbidden (scope or tenant mismatch).';
        case 404:
            return 'Resource not found.';
        case 429:
            return 'Rate limit exceeded.';
        case 500:
            return 'Internal server error.';
        case 503:
            return 'Service unavailable.';
        case 504:
            return 'Gateway timeout.';
        default:
            return `HTTP ${status}.`;
    }
}
/** Parse a Retry-After header (seconds or HTTP-date) into milliseconds. */
function parseRetryAfter(value) {
    const seconds = Number(value);
    if (!Number.isNaN(seconds)) {
        return seconds * 1000;
    }
    const date = Date.parse(value);
    if (!Number.isNaN(date)) {
        return Math.max(0, date - Date.now());
    }
    return 0;
}
/** Type guard: is this error an RcrtError? */
export function isRcrtError(e) {
    return e instanceof RcrtError;
}
/** Type guard: is this error an SdkError? */
export function isSdkError(e) {
    return e instanceof SdkError;
}
//# sourceMappingURL=errors.js.map