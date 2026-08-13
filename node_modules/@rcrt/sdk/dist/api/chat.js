/**
 * Chat module — send chat messages + stream completions.
 *
 *   const res = await client.chat.send({ message: 'Hello', session_id: 'sess-1' });
 *   for await (const event of client.chat.stream('sess-1', { signal })) {
 *     if (event.type === 'agent.message') { ... }
 *   }
 */
import { request, openSSEStream } from '../internal/fetch.js';
export class ChatModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /** Send a chat message (triggers the agent pipeline). */
    async send(input, options) {
        const { data } = await request(this.ctx, 'POST', '/v1/chat', {
            ...options,
            json: input,
        });
        return data;
    }
    /**
     * Stream session events (assistant messages, tool progress) as an async
     * generator. Opens an SSE connection to /v1/sessions/{session_id}/stream.
     *
     *   for await (const event of client.chat.stream(sessionId, { signal })) {
     *     if (event.type === 'agent.message') {
     *       const payload = JSON.parse(event.data);
     *     }
     *   }
     */
    async *stream(sessionId, options = {}) {
        const response = await openSSEStream(this.ctx, `/v1/sessions/${encodeURIComponent(sessionId)}/stream`, {
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
//# sourceMappingURL=chat.js.map