/**
 * Sessions module — multi-agent session participants.
 *
 *   const participants = await client.sessions.listParticipants('sess-1');
 *   await client.sessions.addParticipant('sess-1', { agent_id: 'ag-researcher' });
 */
import { request } from '../internal/fetch.js';
export class SessionsModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /** List session participants. */
    async listParticipants(sessionId, options) {
        const { data } = await request(this.ctx, 'GET', `/v1/sessions/${encodeURIComponent(sessionId)}/participants`, options);
        return data;
    }
    /** Add an agent to a session. */
    async addParticipant(sessionId, input, options) {
        const { data } = await request(this.ctx, 'POST', `/v1/sessions/${encodeURIComponent(sessionId)}/participants`, { ...options, json: input });
        return data;
    }
    /** Remove an agent from a session. */
    async removeParticipant(sessionId, agentId, options) {
        await request(this.ctx, 'DELETE', `/v1/sessions/${encodeURIComponent(sessionId)}/participants/${encodeURIComponent(agentId)}`, options);
    }
}
//# sourceMappingURL=sessions.js.map