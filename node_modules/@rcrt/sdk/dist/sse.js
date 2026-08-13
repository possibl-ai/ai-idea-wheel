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
/**
 * Open an SSE stream and return an async generator of parsed events.
 *
 * The generator yields until the stream closes, the consumer breaks, or the
 * AbortSignal aborts. On network errors, it throws (the caller can retry by
 * re-opening with `lastEventId` set to the last received event id).
 */
export async function* openSSE(opts) {
    const headers = new Headers(opts.headers);
    headers.set('Accept', 'text/event-stream');
    if (opts.lastEventId) {
        headers.set('Last-Event-ID', opts.lastEventId);
    }
    const response = await fetch(opts.url, {
        ...opts,
        headers,
        method: opts.method ?? 'GET',
    });
    if (!response.ok) {
        const { RcrtError } = await import('./errors.js');
        throw await RcrtError.fromResponse(response);
    }
    if (!response.body) {
        throw new Error('SSE response has no body.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            // SSE events are separated by a blank line (\n\n).
            let separatorIndex;
            while ((separatorIndex = buffer.indexOf('\n\n')) >= 0) {
                const rawEvent = buffer.slice(0, separatorIndex);
                buffer = buffer.slice(separatorIndex + 2);
                const event = parseSSEEvent(rawEvent);
                if (event)
                    yield event;
            }
        }
        // Flush any trailing event.
        if (buffer.trim()) {
            const event = parseSSEEvent(buffer);
            if (event)
                yield event;
        }
    }
    finally {
        reader.releaseLock();
    }
}
/**
 * Parse a single SSE event block (the text between two \n\n separators).
 * Returns undefined for comment lines (lines starting with ':') or empty events.
 */
function parseSSEEvent(block) {
    const lines = block.split(/\r\n|\r|\n/);
    let type;
    let data = '';
    let id;
    let retry;
    let hasData = false;
    for (const line of lines) {
        if (line === '' || line.startsWith(':'))
            continue;
        const colonIndex = line.indexOf(':');
        const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
        let value = colonIndex === -1 ? '' : line.slice(colonIndex + 1);
        if (value.startsWith(' '))
            value = value.slice(1);
        switch (field) {
            case 'event':
                type = value;
                break;
            case 'data':
                data += (hasData ? '\n' : '') + value;
                hasData = true;
                break;
            case 'id':
                if (!value.includes('\0'))
                    id = value;
                break;
            case 'retry':
                {
                    const parsed = Number(value);
                    if (!Number.isNaN(parsed))
                        retry = parsed;
                }
                break;
        }
    }
    if (!hasData)
        return undefined;
    return { type, data, id, retry };
}
/**
 * Wrap an SSE stream with a JSON parser, yielding parsed payloads.
 *   const stream = await openSSE({ url, ... });
 *   for await (const event of parseJSON(stream)) {
 *     console.log(event.parsed); // typed payload
 *   }
 */
export async function* parseJSON(stream) {
    for await (const event of stream) {
        let parsed;
        if (event.data) {
            try {
                parsed = JSON.parse(event.data);
            }
            catch {
                // Non-JSON data (e.g. heartbeat "connected" event) — yield without parsed.
            }
        }
        yield { ...event, parsed };
    }
}
//# sourceMappingURL=sse.js.map