/**
 * dsh-weread — loopback HTTP routes for the web settings panel.
 *
 * Route family: /api/dsh-weread/*. All routes are loopback-only
 * (127.0.0.1/localhost, same-origin) — the settings panel is the only
 * consumer.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WereadStore } from './store.ts';
/** Route paths. */
export declare const WEREAD_API: {
    readonly config: "/api/dsh-weread/config";
    readonly status: "/api/dsh-weread/status";
    readonly test: "/api/dsh-weread/test";
    readonly sync: "/api/dsh-weread/sync";
    readonly flomo: "/api/dsh-weread/flomo";
    readonly books: "/api/dsh-weread/books";
};
/** Route handler context. */
export interface RouteContext {
    store: WereadStore;
}
/**
 * Build every /api/dsh-weread route (exact paths).
 * @param deps - store (the API client is built lazily per request).
 * @returns the route list.
 */
export declare function makeRoutes(deps: RouteContext): ({
    kind: "exact";
    path: "/api/dsh-weread/config";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/dsh-weread/status";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/dsh-weread/test";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/dsh-weread/sync";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/dsh-weread/books";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/dsh-weread/flomo";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
})[];
