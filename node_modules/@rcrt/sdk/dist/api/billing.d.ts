/**
 * Billing module — subscription status + checkout + portal.
 */
import type { FetchContext, RequestOptions } from '../internal/fetch.js';
import type { components } from './openapi.js';
type BillingSubscription = components['schemas']['BillingSubscription'];
type BillingCheckoutInput = components['schemas']['BillingCheckoutInput'];
type BillingCheckoutResult = components['schemas']['BillingCheckoutResult'];
export declare class BillingModule {
    private readonly ctx;
    constructor(ctx: FetchContext);
    getSubscription(options?: RequestOptions): Promise<BillingSubscription>;
    checkout(input: BillingCheckoutInput, options?: RequestOptions): Promise<BillingCheckoutResult>;
}
export {};
//# sourceMappingURL=billing.d.ts.map