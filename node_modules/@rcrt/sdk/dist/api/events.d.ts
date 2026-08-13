/**
 * Events module — SSE event stream (breadcrumb lifecycle + edge agent events).
 *
 *   for await (const event of client.events.stream({ filter: 'session:abc' })) {
 *     if (event.type === 'breadcrumb.created') { ... }
 *   }
 */
import type { FetchContext } from '../internal/fetch.js';
import type { SSEEvent } from '../sse.js';
export interface EventsStreamOptions {
    signal?: AbortSignal;
    lastEventId?: string;
    /** Tag filter expression (e.g. 'session:abc', 'location:queenstown-1'). */
    filter?: string;
}
export declare class EventsModule {
    private readonly ctx;
    constructor(ctx: FetchContext);
    /**
     * Open the /v1/events SSE stream. Yields parsed SSE events until the stream
     * closes, the consumer breaks, or the AbortSignal aborts.
     */
    stream(options?: EventsStreamOptions): AsyncGenerator<SSEEvent>;
}
//# sourceMappingURL=events.d.ts.map