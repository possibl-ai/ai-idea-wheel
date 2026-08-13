/**
 * Organizations module — org CRUD + members + tenants.
 */
import { request } from '../internal/fetch.js';
export class OrganizationsModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    async create(input, options) {
        const { data } = await request(this.ctx, 'POST', '/v1/orgs', {
            ...options,
            json: input,
        });
        return data;
    }
    async get(orgId, options) {
        const { data } = await request(this.ctx, 'GET', `/v1/orgs/${encodeURIComponent(orgId)}`, options);
        return data;
    }
    async update(orgId, input, options) {
        const { data } = await request(this.ctx, 'PUT', `/v1/orgs/${encodeURIComponent(orgId)}`, {
            ...options,
            json: input,
        });
        return data;
    }
    async delete(orgId, options) {
        await request(this.ctx, 'DELETE', `/v1/orgs/${encodeURIComponent(orgId)}`, options);
    }
    async listMembers(orgId, options) {
        const { data } = await request(this.ctx, 'GET', `/v1/orgs/${encodeURIComponent(orgId)}/members`, options);
        return data ?? [];
    }
    async addMember(orgId, input, options) {
        const { data } = await request(this.ctx, 'POST', `/v1/orgs/${encodeURIComponent(orgId)}/members`, {
            ...options,
            json: input,
        });
        return data;
    }
    async listTenants(orgId, options) {
        const { data } = await request(this.ctx, 'GET', `/v1/orgs/${encodeURIComponent(orgId)}/tenants`, options);
        return data ?? [];
    }
    async createTenant(orgId, input, options) {
        const { data } = await request(this.ctx, 'POST', `/v1/orgs/${encodeURIComponent(orgId)}/tenants`, {
            ...options,
            json: input,
        });
        return data;
    }
}
//# sourceMappingURL=organizations.js.map