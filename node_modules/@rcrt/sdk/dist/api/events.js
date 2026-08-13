/**
 * Events module — SSE event stream (breadcrumb lifecycle + edge agent events).
 *
 *   for await (const event of client.events.stream({ filter: 'session:abc' })) {
 *     if (event.type === 'breadcrumb.created') { ... }
 *   }
 */
import { openSSEStream } from '../internal/fetch.js';
export class EventsModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /**
     * Open the /v1/events SSE stream. Yields parsed SSE events until the stream
     * closes, the consumer breaks, or the AbortSignal aborts.
     */
    async *stream(options = {}) {
        const path = options.filter
            ? `/v1/events?filter=${encodeURIComponent(options.filter)}`
            : '/v1/events';
        const response = await openSSEStream(this.ctx, path, {
            method: 'GET',
            signal: options.signal,
            lastEventId: options.lastEventId,
        });
        if (!response.body)
            return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
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
                    const evt = parseEvent(raw);
                    if (evt)
                        yield evt;
                }
            }
        }
        finally {
            reader.releaseLock();
        }
    }
}
function parseEvent(block) {
    const lines = block.split(/\r\n|\r|\n/);
    let type;
    let data = '';
    let id;
    let hasData = false;
    for (const line of lines) {
        if (line === '' || line.startsWith(':'))
            continue;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? '' : line.slice(colon + 1);
        if (value.startsWith(' '))
            value = value.slice(1);
        if (field === 'event')
            type = value;
        else if (field === 'data') {
            data += (hasData ? '\n' : '') + value;
            hasData = true;
        }
        else if (field === 'id' && !value.includes('\0'))
            id = value;
    }
    return hasData ? { type, data, id, retry: undefined } : undefined;
}
//# sourceMappingURL=events.js.map