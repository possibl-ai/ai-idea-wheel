/**
 * Files module — upload + metadata + content download.
 */
import type { FetchContext, RequestOptions } from '../internal/fetch.js';
import type { components } from './openapi.js';
type FileMetadata = components['schemas']['FileMetadata'];
export declare class FilesModule {
    private readonly ctx;
    constructor(ctx: FetchContext);
    /** Upload a file. Pass a File (browser) or Buffer (Node). */
    upload(file: File | Blob, options?: RequestOptions & {
        name?: string;
    }): Promise<FileMetadata>;
    get(id: string, options?: RequestOptions): Promise<FileMetadata>;
    delete(id: string, options?: RequestOptions): Promise<void>;
    /** Download file content (binary). Returns the Response body (a ReadableStream). */
    getContent(id: string, options?: RequestOptions): Promise<ReadableStream<Uint8Array>>;
}
export {};
//# sourceMappingURL=files.d.ts.map