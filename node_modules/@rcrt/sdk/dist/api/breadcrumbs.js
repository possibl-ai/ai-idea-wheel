/**
 * Breadcrumbs module — CRUD + semantic search.
 *
 *   const crumb = await client.breadcrumbs.create({
 *     name: 'kb-listing-123',
 *     content: { text: '...' },
 *     tags: ['interpret:knowledge'],
 *   });
 *   const results = await client.breadcrumbs.query({ tags: 'interpret:knowledge' });
 *   const hits = await client.breadcrumbs.search({ q: 'property brief', limit: 5 });
 */
import { request } from '../internal/fetch.js';
export class BreadcrumbsModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Create a breadcrumb (single-row; use client.bulk for >=100 rows).
     *
     * Pass `upsert: true` with a stable `name` on anything you might retry — the
     * default inserts a new row per attempt and `name` is not unique.
     *
     * Unwraps the gateway's `{ breadcrumb, action }` envelope. This method used to
     * return that envelope typed as a `Breadcrumb`, so `crumb.id` was `undefined`
     * on every successful create — including in the quickstart's own example. Use
     * `createWithAction` when you need to know whether an upsert inserted or
     * updated.
     */
    async create(input, options) {
        const { breadcrumb } = await this.createWithAction(input, options);
        return breadcrumb;
    }
    /** Create a breadcrumb, keeping the `action` the gateway reported. */
    async createWithAction(input, options) {
        const { data } = await request(this.ctx, 'POST', '/v1/breadcrumbs', {
            ...options,
            json: input,
        });
        return data;
    }
    /** Query breadcrumbs by tags, name or parent. Returns a bare array. */
    async query(query, options) {
        const { data } = await request(this.ctx, 'GET', '/v1/breadcrumbs', {
            ...options,
            query: query,
        });
        return data ?? [];
    }
    /**
     * Semantic (hybrid) search over breadcrumbs. Returns a bare array in
     * descending relevance order — the gateway computes similarity scores but
     * does not serialise them, so position is the only ranking signal available.
     */
    async search(params, options) {
        const { data } = await request(this.ctx, 'GET', '/v1/breadcrumbs/search', {
            ...options,
            query: params,
        });
        return data ?? [];
    }
    /** Get a breadcrumb by id. */
    async get(id, options) {
        const { data } = await request(this.ctx, 'GET', `/v1/breadcrumbs/${encodeURIComponent(id)}`, options);
        return data;
    }
    /** Update a breadcrumb. */
    async update(id, input, options) {
        const { data } = await request(this.ctx, 'PATCH', `/v1/breadcrumbs/${encodeURIComponent(id)}`, {
            ...options,
            json: input,
        });
        return data;
    }
    /** Soft-delete a breadcrumb. */
    async delete(id, options) {
        await request(this.ctx, 'DELETE', `/v1/breadcrumbs/${encodeURIComponent(id)}`, options);
    }
}
//# sourceMappingURL=breadcrumbs.js.map