/**
 * Tenants module — tenant CRUD + members + API keys + usage.
 */
import type { FetchContext, RequestOptions } from '../internal/fetch.js';
import type { components } from './openapi.js';
type TenantMember = components['schemas']['TenantMember'];
type TenantMemberInput = components['schemas']['TenantMemberInput'];
type APIKey = components['schemas']['APIKey'];
type APIKeyStatus = components['schemas']['APIKeyStatus'];
type Usage = components['schemas']['Usage'];
export declare class TenantsModule {
    private readonly ctx;
    constructor(ctx: FetchContext);
    delete(tenantId: string, options?: RequestOptions): Promise<void>;
    listMembers(tenantId: string, options?: RequestOptions): Promise<TenantMember[]>;
    addMember(tenantId: string, input: TenantMemberInput, options?: RequestOptions): Promise<TenantMember>;
    generateAPIKey(tenantId: string, options?: RequestOptions): Promise<APIKey>;
    getAPIKeyStatus(tenantId: string, options?: RequestOptions): Promise<APIKeyStatus>;
    revokeAPIKey(tenantId: string, options?: RequestOptions): Promise<void>;
    getUsage(tenantId: string, options?: RequestOptions): Promise<Usage>;
}
export {};
//# sourceMappingURL=tenants.d.ts.map