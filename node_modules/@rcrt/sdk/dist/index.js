/**
 * @rcrt/sdk — the RCRT Consumer SDK.
 *
 * The primary way consumer apps connect to + build on the RCRT platform.
 *
 *   import { createClient, passwordTokenProvider } from '@rcrt/sdk';
 *
 *   const baseURL = 'https://api.platform-dev.rcrt.cloud';
 *   const client = createClient({
 *     baseURL,
 *     tokenProvider: passwordTokenProvider({ baseURL, email, password }),
 *     tenantId: process.env.RCRT_TENANT_ID!, // see below — this is required
 *   });
 *
 *   const crumb = await client.breadcrumbs.create({ ... });
 *   for await (const event of client.events.stream()) { ... }
 *
 * `tenantId` is not optional in practice: the gateway answers every
 * tenant-scoped route with `401 auth.workspace_not_selected` until a workspace
 * id is supplied, and that 401 is NOT a credential failure — see
 * `RcrtError.isWorkspaceNotSelected`. `GET /v1/auth/tenants` lists the
 * workspaces an identity may use.
 *
 * See docs/sdk/ for the quickstart, API reference, auth flow, error handling,
 * SSE, bulk/CDC, and release runbooks. docs/consumer/AGENTS.md is the condensed
 * entry point if you are an AI agent building against this platform.
 *
 * @packageDocumentation
 */
// Client + types
export { createClient } from './client.js';
// Auth
export { staticToken, passwordTokenProvider, 
/** @deprecated Firebase is not an auth path on this platform; throws when called. */
firebaseTokenProvider, cachedTokenProvider, createAuthContext, } from './auth.js';
// Errors
export { RcrtError, SdkError, isRcrtError, isSdkError, } from './errors.js';
// SSE
export { openSSE, parseJSON } from './sse.js';
// Retry
export { withRetry, fullJitterDelay, isRetryableError, sleep } from './retry.js';
// Telemetry
export { noopLogger, consoleLogger, generateRequestId, generateTraceparent, createTelemetryContext, } from './telemetry.js';
// API modules (for explicit typing)
export { BreadcrumbsModule, } from './api/breadcrumbs.js';
export { ChatModule } from './api/chat.js';
export { SessionsModule } from './api/sessions.js';
export { EventsModule } from './api/events.js';
export { OrganizationsModule } from './api/organizations.js';
export { TenantsModule } from './api/tenants.js';
export { BillingModule } from './api/billing.js';
export { FilesModule } from './api/files.js';
export { BulkModule } from './api/bulk.js';
//# sourceMappingURL=index.js.map