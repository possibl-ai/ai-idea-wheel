/**
 * Organizations module — org CRUD + members + tenants.
 */
import type { FetchContext, RequestOptions } from '../internal/fetch.js';
import type { components } from './openapi.js';
type Organization = components['schemas']['Organization'];
type OrganizationInput = components['schemas']['OrganizationInput'];
type OrgMember = components['schemas']['OrgMember'];
type OrgMemberInput = components['schemas']['OrgMemberInput'];
type Tenant = components['schemas']['Tenant'];
type TenantInput = components['schemas']['TenantInput'];
export declare class OrganizationsModule {
    private readonly ctx;
    constructor(ctx: FetchContext);
    create(input: OrganizationInput, options?: RequestOptions): Promise<Organization>;
    get(orgId: string, options?: RequestOptions): Promise<Organization>;
    update(orgId: string, input: OrganizationInput, options?: RequestOptions): Promise<Organization>;
    delete(orgId: string, options?: RequestOptions): Promise<void>;
    listMembers(orgId: string, options?: RequestOptions): Promise<OrgMember[]>;
    addMember(orgId: string, input: OrgMemberInput, options?: RequestOptions): Promise<OrgMember>;
    listTenants(orgId: string, options?: RequestOptions): Promise<Tenant[]>;
    createTenant(orgId: string, input: TenantInput, options?: RequestOptions): Promise<Tenant>;
}
export {};
//# sourceMappingURL=organizations.d.ts.map