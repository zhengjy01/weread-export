/**
 * weread-export — loopback HTTP routes for the web settings panel.
 *
 * Route family: /api/weread-export/*. All routes are loopback-only
 * (127.0.0.1/localhost, same-origin) — the settings panel is the only
 * consumer.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WereadStore } from './store.ts';
/** Route paths. */
export declare const WEREAD_API: {
    readonly config: "/api/weread-export/config";
    readonly status: "/api/weread-export/status";
    readonly test: "/api/weread-export/test";
    readonly sync: "/api/weread-export/sync";
    readonly export: "/api/weread-export/export";
    readonly flomo: "/api/weread-export/flomo";
    readonly books: "/api/weread-export/books";
};
/** Route handler context. */
export interface RouteContext {
    store: WereadStore;
}
/**
 * Build every /api/weread-export route (exact paths).
 * @param deps - store (the API client is built lazily per request).
 * @returns the route list.
 */
export declare function makeRoutes(deps: RouteContext): ({
    kind: "exact";
    path: "/api/weread-export/config";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weread-export/status";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weread-export/test";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weread-export/sync";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weread-export/books";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weread-export/export";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weread-export/flomo";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
})[];
