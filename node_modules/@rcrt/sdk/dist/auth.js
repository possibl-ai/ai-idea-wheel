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
/** A static token provider (for API keys — tk_* or cs_*). */
export function staticToken(token) {
    return () => Promise.resolve(token);
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
export function passwordTokenProvider(creds) {
    const leadTimeMs = creds.refreshLeadTimeMs ?? 5 * 60_000;
    let cached = null;
    let inFlight = null;
    const base = creds.baseURL.replace(/\/$/, '');
    const doFetch = creds.fetch ?? globalThis.fetch;
    const applyBody = (body) => ({
        token: body.access_token,
        expiresAtMs: Date.parse(body.expires_at),
        refresh: body.refresh_token,
    });
    const signIn = async () => {
        const res = await doFetch(`${base}/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: creds.email, password: creds.password }),
        });
        if (!res.ok) {
            const { SdkError } = await import('./errors.js');
            const body = await res.text().catch(() => '');
            throw new SdkError('AUTH_LOGIN_FAILED', `POST /v1/auth/login returned ${res.status}. The gateway returns one uniform ` +
                `message for every credential failure, so this says nothing about which ` +
                `field is wrong. Body: ${body}`);
        }
        return applyBody((await res.json()));
    };
    const refresh = async (refreshToken) => {
        const res = await doFetch(`${base}/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok)
            return null;
        return applyBody((await res.json()));
    };
    return async () => {
        if (cached && cached.expiresAtMs - Date.now() > leadTimeMs) {
            return cached.token;
        }
        inFlight ??= (async () => {
            if (cached?.refresh) {
                const rotated = await refresh(cached.refresh);
                if (rotated)
                    return rotated;
            }
            return signIn();
        })().finally(() => {
            inFlight = null;
        });
        cached = await inFlight;
        return cached.token;
    };
}
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
export function firebaseTokenProvider(_getUser) {
    return async () => {
        const { SdkError } = await import('./errors.js');
        throw new SdkError('AUTH_FIREBASE_REMOVED', 'Firebase is no longer an authentication path for the RCRT platform: the ' +
            'gateway verifies its own session tokens and will reject a Firebase ID ' +
            'token even though that token is valid. Use passwordTokenProvider({ baseURL, ' +
            'email, password }) for a user identity, or staticToken("tk_..."/"cs_...") ' +
            'for a service. See docs/sdk/03_AUTH_FLOW.md.');
    };
}
/**
 * A cached token provider — wraps another provider, caching the token + its
 * expiry. Useful when the underlying provider is expensive (e.g. a network call
 * to mint a token). `passwordTokenProvider` already caches; this is for a
 * bring-your-own token source.
 */
export function cachedTokenProvider(provider, refreshLeadTimeMs = 60_000) {
    let cached = null;
    return async () => {
        const now = Date.now();
        if (cached && cached.expiresAtMs - now > refreshLeadTimeMs) {
            return cached.token;
        }
        cached = await provider();
        return cached.token;
    };
}
/** Build an AuthContext from a token provider + method. */
export function createAuthContext(provider, method = 'custom') {
    return {
        method,
        async authorizationHeader() {
            const token = await provider();
            return `Bearer ${token}`;
        },
    };
}
//# sourceMappingURL=auth.js.map