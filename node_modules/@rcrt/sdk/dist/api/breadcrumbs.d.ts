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
import type { FetchContext, RequestOptions } from '../internal/fetch.js';
import type { components } from './openapi.js';
type Breadcrumb = components['schemas']['Breadcrumb'];
type BreadcrumbCreate = components['schemas']['BreadcrumbCreate'];
type BreadcrumbUpdate = components['schemas']['BreadcrumbUpdate'];
type BreadcrumbWriteResult = components['schemas']['BreadcrumbWriteResult'];
/**
 * Query parameters for listing breadcrumbs.
 *
 * There is no `cursor`: the endpoint has no pagination. It used to be declared
 * here because the spec declared it, and the gateway has never read it — a
 * caller paging through results would have silently re-read page one forever.
 * `limit` is the only size control (default 100, max 1000).
 */
export interface BreadcrumbQuery {
    /** One tag, or several. Repeated as `?tags=a&tags=b`. */
    tags?: string | string[];
    /** Exact name match. Takes precedence over every other filter. */
    name?: string;
    parent_id?: string;
    limit?: number;
}
/** Search parameters for semantic search. */
export interface BreadcrumbSearchParams {
    q: string;
    tags?: string | string[];
    limit?: number;
}
export declare class BreadcrumbsModule {
    private readonly ctx;
    constructor(ctx: FetchContext);
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
    create(input: BreadcrumbCreate, options?: RequestOptions): Promise<Breadcrumb>;
    /** Create a breadcrumb, keeping the `action` the gateway reported. */
    createWithAction(input: BreadcrumbCreate, options?: RequestOptions): Promise<BreadcrumbWriteResult>;
    /** Query breadcrumbs by tags, name or parent. Returns a bare array. */
    query(query: BreadcrumbQuery, options?: RequestOptions): Promise<Breadcrumb[]>;
    /**
     * Semantic (hybrid) search over breadcrumbs. Returns a bare array in
     * descending relevance order — the gateway computes similarity scores but
     * does not serialise them, so position is the only ranking signal available.
     */
    search(params: BreadcrumbSearchParams, options?: RequestOptions): Promise<Breadcrumb[]>;
    /** Get a breadcrumb by id. */
    get(id: string, options?: RequestOptions): Promise<Breadcrumb>;
    /** Update a breadcrumb. */
    update(id: string, input: BreadcrumbUpdate, options?: RequestOptions): Promise<Breadcrumb>;
    /** Soft-delete a breadcrumb. */
    delete(id: string, options?: RequestOptions): Promise<void>;
}
export {};
//# sourceMappingURL=breadcrumbs.d.ts.map