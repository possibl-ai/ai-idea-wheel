/**
 * Bulk module — convenience re-export of the bulk SDKs.
 *
 * The bulk SDKs (@rcrt/bulk-client for TS, pkg/rcrt-bulk for Go) are
 * companion packages that handle the streaming NDJSON/protobuf bulk-loader
 * protocol (SSE per-row results, checkpointing, batching, cs_* API key auth).
 * This module provides a thin `client.bulk.upload()` convenience that wraps
 * the bulk-loader's NDJSON endpoint directly, so common-case bulk uploads don't
 * require a separate package. For advanced features (protobuf, checkpointing,
 * resume), install @rcrt/bulk-client (a peer dependency, lazily imported).
 *
 *   const stream = client.bulk.uploadStream(rows, { mode: 'upsert' });
 *   for await (const result of stream) {
 *     if (result.status === 'failed') console.error(result);
 *   }
 *
 * See docs/sdk/06_BULK_AND_CDC.md + architecture/08_BULK_DATA_AND_CDC.md.
 */
import type { FetchContext } from '../internal/fetch.js';
import { SdkError } from '../errors.js';
import type { components } from './openapi.js';
type BreadcrumbCreate = components['schemas']['BreadcrumbCreate'];
type CDCSubscription = components['schemas']['CDCSubscription'];
/** Per-row result from the bulk-loader SSE stream. */
export interface BulkRowResult {
    row: number;
    status: 'created' | 'updated' | 'skipped' | 'failed';
    error?: string;
}
/** Options for a bulk upload. */
export interface BulkUploadOptions {
    /** 'upsert' (default) or 'create' (fail on existing name). */
    mode?: 'upsert' | 'create';
    /** AbortSignal for cancellation. */
    signal?: AbortSignal;
    /** Override the consumer-service API key (cs_*). If not set, the client's auth context is used. */
    serviceApiKey?: string;
}
/**
 * BulkModule — convenience bulk upload + CDC registration.
 *
 * NOTE: bulk operations require a consumer-service API key (cs_*), which is
 * distinct from a platform session token or a tk_* workspace key. Pass the cs_*
 * key via `serviceApiKey` or configure a client with a cs_* token provider.
 */
export declare class BulkModule {
    private readonly ctx;
    constructor(ctx: FetchContext);
    /**
     * Stream breadcrumbs to the bulk-loader via NDJSON. Returns an async
     * generator of per-row results. For >=100 rows, this is the only path
     * (the api-gateway rejects batches >100 rows via /v1/breadcrumbs).
     *
     *   const rows = [{ name: 'kb-1', content: {...}, tags: ['interpret:knowledge'] }];
     *   for await (const result of client.bulk.uploadStream(rows)) {
     *     if (result.status === 'failed') console.error('row', result.row, result.error);
     *   }
     */
    uploadStream(rows: AsyncIterable<BreadcrumbCreate> | Iterable<BreadcrumbCreate>, options?: BulkUploadOptions): AsyncGenerator<BulkRowResult>;
    /**
     * Upload breadcrumbs in bulk and collect all results. Convenience wrapper
     * around uploadStream that drains into an array.
     */
    upload(rows: AsyncIterable<BreadcrumbCreate> | Iterable<BreadcrumbCreate>, options?: BulkUploadOptions): Promise<BulkRowResult[]>;
    /** Register for outbound CDC (returns a Pub/Sub subscription name). */
    subscribeCDC(options?: {
        serviceApiKey?: string;
    }): Promise<CDCSubscription>;
}
export { SdkError };
//# sourceMappingURL=bulk.d.ts.map