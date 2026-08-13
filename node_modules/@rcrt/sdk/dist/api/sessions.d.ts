/**
 * Sessions module — multi-agent session participants.
 *
 *   const participants = await client.sessions.listParticipants('sess-1');
 *   await client.sessions.addParticipant('sess-1', { agent_id: 'ag-researcher' });
 */
import type { FetchContext, RequestOptions } from '../internal/fetch.js';
import type { components } from './openapi.js';
type SessionParticipants = components['schemas']['SessionParticipants'];
type SessionParticipantInput = components['schemas']['SessionParticipantInput'];
export declare class SessionsModule {
    private readonly ctx;
    constructor(ctx: FetchContext);
    /** List session participants. */
    listParticipants(sessionId: string, options?: RequestOptions): Promise<SessionParticipants>;
    /** Add an agent to a session. */
    addParticipant(sessionId: string, input: SessionParticipantInput, options?: RequestOptions): Promise<SessionParticipants>;
    /** Remove an agent from a session. */
    removeParticipant(sessionId: string, agentId: string, options?: RequestOptions): Promise<void>;
}
export {};
//# sourceMappingURL=sessions.d.ts.map