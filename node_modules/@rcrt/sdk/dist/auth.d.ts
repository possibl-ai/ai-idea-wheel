/**
 * Auth — platform session tokens + API keys.
 *
 * The SDK accepts a `tokenProvider` callback that resolves to a bearer token.
 * There are exactly two ways to get one, and no identity provider is involved
 * in either:
 *
 *   1. **A user.** `POST /v1/auth/login` with an email and a password returns
 *      a self-contained session JWT (~8h). Use `passwordTokenProvider`, which
 *      signs in on first use and re-signs-in when the token nears expiry.
 *   2. **A service.** A long-lived `tk_*` (workspace) or `cs_*`
 *      (consumer-service) key. Use `staticToken`.
 *
 * When the gateway issues a `refresh_token` (`AUTH_ACCESS_TTL_MINUTES` set),
 * `passwordTokenProvider` rotates via `POST /v1/auth/refresh`. Otherwise it
 * re-signs-in near access-token expiry (pre-refresh deployments).
 *
 * This file used to be built around Firebase, and `firebaseTokenProvider` was
 * the documented default. Firebase was removed from the sign-in path entirely
 * (docs/findings/17_SELF_HOSTED_PASSWORD_AUTH.md). It is kept below, throwing,
 * because the failure it replaces was silent: a Firebase ID token is a real,
 * valid JWT, so the old provider handed the gateway a well-formed credential it
 * has no way to verify, and the caller saw a 401 that looked like bad
 * credentials rather than a removed integration.
 *
 * See docs/sdk/03_AUTH_FLOW.md for the full flow.
 */
/**
 * A token provider — a function returning the current bearer token.
 * The SDK calls this before every request; the provider handles refresh.
 */
export type TokenProvider = () => Promise<string>;
/** A static token provider (for API keys — tk_* or cs_*). */
export declare function staticToken(token: string): TokenProvider;
/** Credentials for `passwordTokenProvider`. */
export interface PasswordCredentials {
    baseURL: string;
    email: string;
    password: string;
    /**
     * Re-sign-in this long before the token's own `exp`. Default 5 minutes —
     * enough to cover a slow request that starts just before the boundary.
     */
    refreshLeadTimeMs?: number;
    /** Injectable for tests / non-global-fetch runtimes. */
    fetch?: typeof globalThis.fetch;
}
/**
 * The provider for a user identity: email + password against
 * `POST /v1/auth/login`, with optional refresh via `/v1/auth/refresh`.
 *
 *   const client = createClient({
 *     baseURL: 'https://api.platform-dev.rcrt.cloud',
 *     tokenProvider: passwordTokenProvider({
 *       baseURL: 'https://api.platform-dev.rcrt.cloud',
 *       email: process.env.RCRT_EMAIL!,
 *       password: process.env.RCRT_PASSWORD!,
 *     }),
 *     tenantId: process.env.RCRT_TENANT_ID!,
 *   });
 *
 * A rejected credential throws `SdkError('AUTH_LOGIN_FAILED')`.
 */
export declare function passwordTokenProvider(creds: PasswordCredentials): TokenProvider;
/**
 * @deprecated Firebase is not an auth path on this platform. Throws.
 *
 * Kept as a throwing stub rather than deleted so the failure is loud. Calling
 * `getIdToken()` against a live Firebase project succeeds and yields a valid
 * JWT — the gateway then rejects it, and the caller has no way to tell that
 * from an expired session or a wrong password. A stub that names the cause
 * turns a silent retry loop into a one-line fix.
 *
 * Use `passwordTokenProvider` for a user, `staticToken` for a service.
 */
export declare function firebaseTokenProvider(_getUser: () => {
    getIdToken: (forceRefresh?: boolean) => Promise<string>;
} | null): TokenProvider;
/**
 * A cached token provider — wraps another provider, caching the token + its
 * expiry. Useful when the underlying provider is expensive (e.g. a network call
 * to mint a token). `passwordTokenProvider` already caches; this is for a
 * bring-your-own token source.
 */
export declare function cachedTokenProvider(provider: () => Promise<{
    token: string;
    expiresAtMs: number;
}>, refreshLeadTimeMs?: number): TokenProvider;
/**
 * The auth context — resolves the Authorization header value for a request.
 * The SDK's fetch layer calls `auth.authorizationHeader()` per request.
 */
export interface AuthContext {
    /** Returns `Bearer <token>` for the Authorization header. */
    authorizationHeader(): Promise<string>;
    /** The auth method (for telemetry + logging). */
    readonly method: 'session_jwt' | 'workspace_api_key' | 'consumer_service_key' | 'custom';
}
/** Build an AuthContext from a token provider + method. */
export declare function createAuthContext(provider: TokenProvider, method?: AuthContext['method']): AuthContext;
//# sourceMappingURL=auth.d.ts.map