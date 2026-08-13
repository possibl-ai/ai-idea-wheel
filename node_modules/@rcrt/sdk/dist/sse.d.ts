/**
 * SSE — typed async-iterator wrapper for Server-Sent Events.
 *
 * The api-gateway streams via text/event-stream for: chat completions
 * (/v1/sessions/{id}/stream), bulk ingest row results (/v1/bulk/breadcrumbs),
 * and the events stream (/v1/events). This module parses the SSE wire format
 * into an async generator the consumer can `for await` over.
 *
 * Uses fetch + ReadableStream (not EventSource — EventSource only supports GET;
 * chat + bulk are POST). Cancellation via AbortSignal. Resumability via
 * Last-Event-ID.
 *
 *   const stream = await openSSE(url, {
 *     method: 'POST',
 *     body: JSON.stringify({ message: 'hello' }),
 *     signal: controller.signal,
 *     headers: { Authorization: await auth.authorizationHeader() },
 *   });
 *   for await (const event of stream) {
 *     if (event.type === 'agent.message') {
 *       console.log(JSON.parse(event.data));
 *     }
 *   }
 *
 * Grounded in 2026 SSE best practice (freeCodeCamp + DEV.to). See
 * docs/sdk/05_SSE_STREAMS.md.
 */
/** A parsed SSE event. `data` is the raw string (may be JSON — consumer parses). */
export interface SSEEvent {
    /** The `event:` field (event type). Undefined if not set. */
    type: string | undefined;
    /** The `data:` field(s), concatenated with newlines. */
    data: string;
    /** The `id:` field (for Last-Event-ID resumability). */
    id: string | undefined;
    /** The `retry:` field (reconnection interval in ms). */
    retry: number | undefined;
}
/** Options for openSSE — extends the standard fetch init. */
export interface SSEOptions extends RequestInit {
    /** The URL to fetch. */
    url: string;
    /** Optional Last-Event-ID for resumability (sent as a header). */
    lastEventId?: string;
}
/**
 * Open an SSE stream and return an async generator of parsed events.
 *
 * The generator yields until the stream closes, the consumer breaks, or the
 * AbortSignal aborts. On network errors, it throws (the caller can retry by
 * re-opening with `lastEventId` set to the last received event id).
 */
export declare function openSSE(opts: SSEOptions): AsyncGenerator<SSEEvent>;
/** Type helper: a typed async generator of SSE events with a known payload type. */
export type TypedSSEStream<T> = AsyncGenerator<SSEEvent & {
    parsed?: T;
}>;
/**
 * Wrap an SSE stream with a JSON parser, yielding parsed payloads.
 *   const stream = await openSSE({ url, ... });
 *   for await (const event of parseJSON(stream)) {
 *     console.log(event.parsed); // typed payload
 *   }
 */
export declare function parseJSON<T>(stream: AsyncGenerator<SSEEvent>): AsyncGenerator<SSEEvent & {
    parsed?: T;
}>;
//# sourceMappingURL=sse.d.ts.map