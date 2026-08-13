/**
 * Tenants module — tenant CRUD + members + API keys + usage.
 */
import { request } from '../internal/fetch.js';
export class TenantsModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    async delete(tenantId, options) {
        await request(this.ctx, 'DELETE', `/v1/tenants/${encodeURIComponent(tenantId)}`, options);
    }
    async listMembers(tenantId, options) {
        const { data } = await request(this.ctx, 'GET', `/v1/tenants/${encodeURIComponent(tenantId)}/members`, options);
        return data ?? [];
    }
    async addMember(tenantId, input, options) {
        const { data } = await request(this.ctx, 'POST', `/v1/tenants/${encodeURIComponent(tenantId)}/members`, {
            ...options,
            json: input,
        });
        return data;
    }
    async generateAPIKey(tenantId, options) {
        const { data } = await request(this.ctx, 'POST', `/v1/tenants/${encodeURIComponent(tenantId)}/api-key`, options);
        return data;
    }
    async getAPIKeyStatus(tenantId, options) {
        const { data } = await request(this.ctx, 'GET', `/v1/tenants/${encodeURIComponent(tenantId)}/api-key`, options);
        return data;
    }
    async revokeAPIKey(tenantId, options) {
        await request(this.ctx, 'DELETE', `/v1/tenants/${encodeURIComponent(tenantId)}/api-key`, options);
    }
    async getUsage(tenantId, options) {
        const { data } = await request(this.ctx, 'GET', `/v1/tenants/${encodeURIComponent(tenantId)}/usage`, options);
        return data;
    }
}
//# sourceMappingURL=tenants.js.map