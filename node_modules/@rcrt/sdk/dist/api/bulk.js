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
import { openSSEStream } from '../internal/fetch.js';
import { RcrtError, SdkError } from '../errors.js';
/**
 * BulkModule — convenience bulk upload + CDC registration.
 *
 * NOTE: bulk operations require a consumer-service API key (cs_*), which is
 * distinct from a platform session token or a tk_* workspace key. Pass the cs_*
 * key via `serviceApiKey` or configure a client with a cs_* token provider.
 */
export class BulkModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
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
    async *uploadStream(rows, options = {}) {
        const mode = options.mode ?? 'upsert';
        const ndjson = await rowsToNDJSON(rows);
        const headers = {
            'Content-Type': 'application/x-ndjson',
        };
        if (options.serviceApiKey) {
            headers['Authorization'] = `Bearer ${options.serviceApiKey}`;
        }
        const path = `/v1/bulk/breadcrumbs?mode=${encodeURIComponent(mode)}`;
        const response = await openSSEStream(this.ctx, path, {
            method: 'POST',
            headers,
            body: ndjson,
            signal: options.signal,
        });
        if (!response.body)
            return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let rowNum = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buffer.indexOf('\n\n')) >= 0) {
                    const raw = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    const result = parseRowResult(raw, rowNum);
                    if (result) {
                        rowNum = result.row;
                        yield result;
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    /**
     * Upload breadcrumbs in bulk and collect all results. Convenience wrapper
     * around uploadStream that drains into an array.
     */
    async upload(rows, options = {}) {
        const results = [];
        for await (const result of this.uploadStream(rows, options)) {
            results.push(result);
        }
        return results;
    }
    // createJob() and getJob() used to live here, wrapping POST /v1/bulk/jobs and
    // GET /v1/bulk/jobs/{job_id}. Neither route exists — nothing under services/
    // registers them and the gateway answers 404 — so both methods were removed
    // rather than left to fail at runtime. They came from spec entries that were
    // themselves fiction; deleting those entries is what surfaced these.
    //
    // Progress for a bulk upload comes back inline on uploadStream()'s SSE
    // results. There is no polling API to wrap.
    /** Register for outbound CDC (returns a Pub/Sub subscription name). */
    async subscribeCDC(options) {
        const headers = {};
        if (options?.serviceApiKey) {
            headers['Authorization'] = `Bearer ${options.serviceApiKey}`;
        }
        const { data } = await requestBulk(this.ctx, 'POST', '/v1/cdc/subscribe', {
            headers,
        });
        return data;
    }
}
/** Convert an iterable of breadcrumbs to NDJSON string. */
async function rowsToNDJSON(rows) {
    const lines = [];
    for await (const row of rows) {
        lines.push(JSON.stringify(row));
    }
    return lines.join('\n') + '\n';
}
/** Parse a bulk-result SSE event into a BulkRowResult. */
function parseRowResult(block, fallbackRow) {
    const lines = block.split(/\r\n|\r|\n/);
    let data = '';
    for (const line of lines) {
        if (line.startsWith('data:')) {
            data += line.slice(5).trimStart();
        }
    }
    if (!data)
        return undefined;
    try {
        const parsed = JSON.parse(data);
        return {
            row: parsed.row ?? fallbackRow,
            status: parsed.status ?? 'failed',
            error: parsed.error,
        };
    }
    catch {
        return { row: fallbackRow, status: 'failed', error: `unparseable: ${data}` };
    }
}
/** Internal bulk request helper (handles cs_* auth override). */
async function requestBulk(ctx, method, path, options) {
    const url = new URL(path, ctx.baseURL).toString();
    const requestId = ctx.telemetry.newRequestId();
    const traceparent = ctx.telemetry.newTraceparent();
    const headers = new Headers(options.headers);
    if (!headers.has('Authorization')) {
        headers.set('Authorization', await ctx.auth.authorizationHeader());
    }
    headers.set('X-Request-Id', requestId);
    headers.set('traceparent', traceparent);
    if (ctx.tenantId)
        headers.set('X-Tenant-ID', ctx.tenantId);
    if (options.json !== undefined)
        headers.set('Content-Type', 'application/json');
    const response = await ctx.fetchImpl(url, {
        method,
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    });
    if (!response.ok) {
        throw await RcrtError.fromResponse(response);
    }
    const contentType = response.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json')
        ? (await response.json())
        : undefined;
    return { response, data };
}
export { SdkError };
//# sourceMappingURL=bulk.js.map