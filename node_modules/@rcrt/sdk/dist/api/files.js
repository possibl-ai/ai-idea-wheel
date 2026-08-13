/**
 * Files module — upload + metadata + content download.
 */
import { request } from '../internal/fetch.js';
export class FilesModule {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    /** Upload a file. Pass a File (browser) or Buffer (Node). */
    async upload(file, options) {
        const form = new FormData();
        form.append('file', file);
        if (options?.name) {
            form.append('name', options.name);
        }
        const { data } = await request(this.ctx, 'POST', '/v1/files', {
            ...options,
            body: form,
            headers: {
                ...options?.headers,
            },
        });
        return data;
    }
    async get(id, options) {
        const { data } = await request(this.ctx, 'GET', `/v1/files/${encodeURIComponent(id)}`, options);
        return data;
    }
    async delete(id, options) {
        await request(this.ctx, 'DELETE', `/v1/files/${encodeURIComponent(id)}`, options);
    }
    /** Download file content (binary). Returns the Response body (a ReadableStream). */
    async getContent(id, options) {
        const { response } = await request(this.ctx, 'GET', `/v1/files/${encodeURIComponent(id)}/content`, options);
        return response.body;
    }
}
//# sourceMappingURL=files.js.map