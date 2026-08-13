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
export { createClient, type ClientOptions, type RcrtClient } from './client.js';
export { staticToken, passwordTokenProvider, 
/** @deprecated Firebase is not an auth path on this platform; throws when called. */
firebaseTokenProvider, cachedTokenProvider, createAuthContext, type TokenProvider, type PasswordCredentials, type AuthContext, } from './auth.js';
export { RcrtError, SdkError, isRcrtError, isSdkError, type ErrorCode, type ErrorEnvelope, type ErrorCause, type WorkspaceOption, } from './errors.js';
export { openSSE, parseJSON, type SSEEvent, type SSEOptions, type TypedSSEStream } from './sse.js';
export { withRetry, fullJitterDelay, isRetryableError, sleep, type RetryOptions } from './retry.js';
export { noopLogger, consoleLogger, generateRequestId, generateTraceparent, createTelemetryContext, type ILogger, type IOtelTracer, type IOtelSpan, type TelemetryContext, } from './telemetry.js';
export { BreadcrumbsModule, type BreadcrumbQuery, type BreadcrumbSearchParams, } from './api/breadcrumbs.js';
export { ChatModule } from './api/chat.js';
export { SessionsModule } from './api/sessions.js';
export { EventsModule, type EventsStreamOptions } from './api/events.js';
export { OrganizationsModule } from './api/organizations.js';
export { TenantsModule } from './api/tenants.js';
export { BillingModule } from './api/billing.js';
export { FilesModule } from './api/files.js';
export { BulkModule, type BulkUploadOptions, type BulkRowResult } from './api/bulk.js';
export type { paths, components, operations } from './api/openapi.js';
//# sourceMappingURL=index.d.ts.map