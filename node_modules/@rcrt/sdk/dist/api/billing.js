/**
 * Billing module — subscription status + checkout + portal.
 */
import { request } from '../internal/fetch.js';
export class BillingModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    async getSubscription(options) {
        const { data } = await request(this.ctx, 'GET', '/v1/billing/subscription', options);
        return data;
    }
    async checkout(input, options) {
        const { data } = await request(this.ctx, 'POST', '/v1/billing/checkout', {
            ...options,
            json: input,
        });
        return data;
    }
}
//# sourceMappingURL=billing.js.map