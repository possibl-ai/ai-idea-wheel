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
/** A stable, dotted error code emitted by the api-gateway (see docs/error-codes.md). */
export type ErrorCode = string;
/** The structured error cause (nested envelope for wrapped errors). */
export interface ErrorCause {
    code: ErrorCode;
    message: string;
}
/** One workspace the caller may put in `X-Tenant-ID`. */
export interface WorkspaceOption {
    id: string;
    name: string;
    role: string;
}
/** The parsed error envelope returned by the api-gateway. */
export interface ErrorEnvelope {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    cause?: ErrorCause;
    /**
     * What to actually do about it, when the gateway knows. Present on the
     * consumer-facing failures where stating the problem is not enough to act on
     * — `auth.workspace_not_selected` above all.
     */
    remediation?: string;
    /**
     * The fields below all answer the same question — "what would have worked?" —
     * for different failures. `selectableWorkspaces` was the first; the rest
     * generalise it, because naming a way out is what makes an error actionable
     * rather than merely accurate.
     */
    /** Set on `auth.workspace_not_selected`: the ids that would work. */
    selectableWorkspaces?: WorkspaceOption[];
    /** Set on a 405: the methods this path does serve. */
    allowedMethods?: string[];
    /** Set when the request body exceeded the route's cap: the size that fits. */
    maxBytes?: number;
    /** Set on 429 (and 503 when sent): the wait, mirroring `Retry-After`. */
    retryAfterSeconds?: number;
    /**
     * Whatever the handler sent alongside its message that the fields above do not
     * model — most usefully a field-level `errors` list from a validation handler.
     * Keys are handler-specific: a diagnostic aid, not a contract.
     */
    details?: Record<string, unknown>;
    /** In-repo doc path for the condition, when the gateway names one. */
    docs?: string;
}
/**
 * RcrtError — the typed error thrown by the SDK for non-2xx responses.
 *
 * Carries the HTTP status, the structured error envelope, correlation IDs
 * (request_id, trace_id), and the Retry-After hint (for 429/503).
 */
export declare class RcrtError extends Error {
    readonly status: number;
    readonly code: ErrorCode;
    readonly retryable: boolean;
    readonly cause: ErrorCause | undefined;
    readonly requestId: string | undefined;
    readonly traceId: string | undefined;
    readonly retryAfterMs: number | undefined;
    readonly rawBody: string | undefined;
    /** The gateway's instruction for fixing this, when it sent one. */
    readonly remediation: string | undefined;
    /** On `auth.workspace_not_selected`, the workspaces that would work. */
    readonly selectableWorkspaces: WorkspaceOption[] | undefined;
    /** On a 405, the methods this path does serve. */
    readonly allowedMethods: string[] | undefined;
    /** When the request body was over the cap, the size that would have fit. */
    readonly maxBytes: number | undefined;
    /** On 429 (and 503 when sent), the wait in seconds. */
    readonly retryAfterSeconds: number | undefined;
    /** Handler-specific extras, e.g. a validation handler's field-level list. */
    readonly details: Record<string, unknown> | undefined;
    /** In-repo doc path for this condition, when the gateway named one. */
    readonly docs: string | undefined;
    constructor(status: number, envelope: ErrorEnvelope, opts?: {
        requestId?: string;
        traceId?: string;
        retryAfterMs?: number;
        rawBody?: string;
    });
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
    get isWorkspaceNotSelected(): boolean;
    /**
     * True only when the credential itself is the problem and re-authenticating
     * could plausibly help. Deliberately narrower than `status === 401`.
     */
    get isCredentialProblem(): boolean;
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
    static fromResponse(response: Response): Promise<RcrtError>;
}
/**
 * SdkError — thrown by the SDK before reaching the server (misconfiguration,
 * aborted request, network failure). Distinct from RcrtError (which is always
 * a server response).
 */
export declare class SdkError extends Error {
    readonly cause?: unknown;
    readonly code: string;
    constructor(code: string, message: string, cause?: unknown);
}
/** Type guard: is this error an RcrtError? */
export declare function isRcrtError(e: unknown): e is RcrtError;
/** Type guard: is this error an SdkError? */
export declare function isSdkError(e: unknown): e is SdkError;
//# sourceMappingURL=errors.d.ts.map