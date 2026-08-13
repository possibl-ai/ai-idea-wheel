/**
 * createClient — the main entry point to the RCRT Consumer SDK.
 *
 *   import { createClient, passwordTokenProvider } from '@rcrt/sdk';
 *
 *   const baseURL = 'https://api.platform-dev.rcrt.cloud';
 *
 *   const client = createClient({
 *     baseURL,
 *     tokenProvider: passwordTokenProvider({
 *       baseURL,
 *       email: process.env.RCRT_EMAIL!,
 *       password: process.env.RCRT_PASSWORD!,
 *     }),
 *     tenantId: process.env.RCRT_TENANT_ID!,
 *   });
 *
 *   const breadcrumb = await client.breadcrumbs.create({ name: 'kb-1', ... });
 *   for await (const event of client.events.stream()) { ... }
 *
 * For a service with no user, swap the provider for a long-lived key:
 * `staticToken(process.env.RCRT_SERVICE_KEY!)` with a `tk_*` (workspace) or
 * `cs_*` (consumer-service) key. There is no identity provider in either path —
 * see auth.ts, and docs/sdk/03_AUTH_FLOW.md for workspace selection, which is a
 * separate step that also answers 401.
 *
 * The client exposes typed modules: breadcrumbs, chat, sessions, events,
 * organizations, tenants, billing, files, bulk. Each module maps to an OpenAPI
 * tag. The bulk module is a convenience re-export of the bulk SDKs.
 */
import { createAuthContext } from './auth.js';
import { createTelemetryContext } from './telemetry.js';
import { SdkError } from './errors.js';
import { BreadcrumbsModule } from './api/breadcrumbs.js';
import { ChatModule } from './api/chat.js';
import { SessionsModule } from './api/sessions.js';
import { EventsModule } from './api/events.js';
import { OrganizationsModule } from './api/organizations.js';
import { TenantsModule } from './api/tenants.js';
import { BillingModule } from './api/billing.js';
import { FilesModule } from './api/files.js';
import { BulkModule } from './api/bulk.js';
/** Create an RCRT client. */
export function createClient(options) {
    if (!options.baseURL) {
        throw new SdkError('MISSING_BASE_URL', 'createClient requires `baseURL`.');
    }
    if (!options.tokenProvider) {
        throw new SdkError('MISSING_TOKEN_PROVIDER', 'createClient requires `tokenProvider`.');
    }
    const auth = createAuthContext(options.tokenProvider, options.authMethod ?? 'custom');
    const telemetry = createTelemetryContext({
        logger: options.logger,
        otel: options.otel,
    });
    const defaultRetry = options.retry ?? {};
    const ctx = {
        baseURL: options.baseURL.replace(/\/$/, ''),
        auth,
        telemetry,
        defaultRetry,
        fetchImpl: options.fetchImpl ?? fetch,
        tenantId: options.tenantId,
    };
    const buildModules = (fetchCtx) => ({
        breadcrumbs: new BreadcrumbsModule(fetchCtx),
        chat: new ChatModule(fetchCtx),
        sessions: new SessionsModule(fetchCtx),
        events: new EventsModule(fetchCtx),
        organizations: new OrganizationsModule(fetchCtx),
        tenants: new TenantsModule(fetchCtx),
        billing: new BillingModule(fetchCtx),
        files: new FilesModule(fetchCtx),
        bulk: new BulkModule(fetchCtx),
    });
    function buildClient(fetchCtx) {
        const clientModules = buildModules(fetchCtx);
        const setTenantId = (id) => {
            fetchCtx.tenantId = id;
        };
        const forTenant = (id) => {
            const childCtx = { ...fetchCtx, tenantId: id };
            return buildClient(childCtx);
        };
        return {
            baseURL: fetchCtx.baseURL,
            auth,
            setTenantId,
            forTenant,
            ...clientModules,
        };
    }
    return buildClient(ctx);
}
//# sourceMappingURL=client.js.map