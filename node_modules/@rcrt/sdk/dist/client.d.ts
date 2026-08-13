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
import type { TokenProvider } from './auth.js';
import { type AuthContext } from './auth.js';
import { type ILogger, type IOtelTracer } from './telemetry.js';
import type { RetryOptions } from './retry.js';
import { BreadcrumbsModule } from './api/breadcrumbs.js';
import { ChatModule } from './api/chat.js';
import { SessionsModule } from './api/sessions.js';
import { EventsModule } from './api/events.js';
import { OrganizationsModule } from './api/organizations.js';
import { TenantsModule } from './api/tenants.js';
import { BillingModule } from './api/billing.js';
import { FilesModule } from './api/files.js';
import { BulkModule } from './api/bulk.js';
/** Options for createClient. */
export interface ClientOptions {
    /** The api-gateway base URL (e.g. https://api.platform-dev.rcrt.cloud). */
    baseURL: string;
    /** The token provider (session token or API key). See auth.ts. */
    tokenProvider: TokenProvider;
    /** The auth method (for telemetry). Default 'custom'. */
    authMethod?: AuthContext['method'];
    /** Optional workspace (tenant) id — sent as X-Tenant-ID on every request. */
    tenantId?: string;
    /** Optional fetch override (for testing / SSR). */
    fetchImpl?: typeof fetch;
    /** Optional logger (default no-op). */
    logger?: ILogger;
    /** Optional OpenTelemetry tracer (for distributed tracing). */
    otel?: IOtelTracer;
    /** Default retry options (maxAttempts, baseMs, capMs, deadlineMs). */
    retry?: RetryOptions;
}
/** The RCRT client — the main SDK entry point. */
export interface RcrtClient {
    readonly baseURL: string;
    readonly auth: AuthContext;
    /** Set the tenant (workspace) scope. */
    setTenantId(tenantId: string): void;
    /** Create a client scoped to a different tenant (for fleet fan-out). */
    forTenant(tenantId: string): RcrtClient;
    /** Typed API modules. */
    readonly breadcrumbs: BreadcrumbsModule;
    readonly chat: ChatModule;
    readonly sessions: SessionsModule;
    readonly events: EventsModule;
    readonly organizations: OrganizationsModule;
    readonly tenants: TenantsModule;
    readonly billing: BillingModule;
    readonly files: FilesModule;
    readonly bulk: BulkModule;
}
/** Create an RCRT client. */
export declare function createClient(options: ClientOptions): RcrtClient;
//# sourceMappingURL=client.d.ts.map