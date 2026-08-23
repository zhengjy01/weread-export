/**
 * Browser-side API client for the /api/weixinread-flomo route family. The only
 * data access path the settings panel uses — plain fetch, same origin.
 */
/** Public config view (mirrors the host contract). */
export interface WereadConfigView {
    configured: boolean;
    apiKeyMasked: string;
    defaultFlomoTag: string;
    lastSyncAt: string;
    configPath: string;
}
/** Status view with cache + flomo stats. */
export interface WereadStatusView extends WereadConfigView {
    flomoConfigured: boolean;
    cachedShelfBooks: number;
    cachedNoteBooks: number;
    cacheUpdatedAt: string;
}
/** Sync result. */
export interface WereadSyncResult {
    ok: boolean;
    message: string;
    shelfBooks: number;
    notebooks: number;
}
/** One cached book for the export picker. */
export interface WereadBook {
    bookId: string;
    title: string;
    author: string;
}
/** Flomo export result. */
export interface WereadFlomoResult {
    ok: boolean;
    message: string;
    sent: number;
    bookId?: string;
}
/** Error carrying the route's JSON error message. */
export declare class WereadApiError extends Error {
    constructor(message: string);
}
/** The weread panel API. */
export declare class WereadApi {
    getConfig(): Promise<WereadConfigView>;
    setConfig(patch: Record<string, unknown>): Promise<WereadConfigView>;
    getStatus(): Promise<WereadStatusView>;
    test(): Promise<{
        ok: boolean;
        message: string;
    }>;
    sync(): Promise<WereadSyncResult>;
    books(): Promise<WereadBook[]>;
    exportFlomo(bookId: string, tag: string, limit?: number): Promise<WereadFlomoResult>;
}
