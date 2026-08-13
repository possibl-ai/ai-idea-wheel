/**
 * Chat module — send chat messages + stream completions.
 *
 *   const res = await client.chat.send({ message: 'Hello', session_id: 'sess-1' });
 *   for await (const event of client.chat.stream('sess-1', { signal })) {
 *     if (event.type === 'agent.message') { ... }
 *   }
 */
import type { FetchContext, RequestOptions } from '../internal/fetch.js';
import type { SSEEvent } from '../sse.js';
import type { components } from './openapi.js';
type ChatRequest = components['schemas']['ChatRequest'];
type ChatResponse = components['schemas']['ChatResponse'];
export declare class ChatModule {
    private readonly ctx;
    constructor(ctx: FetchContext);
    /** Send a chat message (triggers the agent pipeline). */
    send(input: ChatRequest, options?: RequestOptions): Promise<ChatResponse>;
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
    stream(sessionId: string, options?: {
        signal?: AbortSignal;
        lastEventId?: string;
    }): AsyncGenerator<SSEEvent>;
}
export {};
//# sourceMappingURL=chat.d.ts.map