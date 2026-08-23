/**
 * weixinread-flomo — loopback HTTP routes for the web settings panel.
 *
 * Route family: /api/weixinread-flomo/*. All routes are loopback-only
 * (127.0.0.1/localhost, same-origin) — the settings panel is the only
 * consumer.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WereadStore } from './store.ts';
/** Route paths. */
export declare const WEREAD_API: {
    readonly config: "/api/weixinread-flomo/config";
    readonly status: "/api/weixinread-flomo/status";
    readonly test: "/api/weixinread-flomo/test";
    readonly sync: "/api/weixinread-flomo/sync";
    readonly export: "/api/weixinread-flomo/export";
    readonly flomo: "/api/weixinread-flomo/flomo";
    readonly books: "/api/weixinread-flomo/books";
};
/** Route handler context. */
export interface RouteContext {
    store: WereadStore;
}
/**
 * Build every /api/weixinread-flomo route (exact paths).
 * @param deps - store (the API client is built lazily per request).
 * @returns the route list.
 */
export declare function makeRoutes(deps: RouteContext): ({
    kind: "exact";
    path: "/api/weixinread-flomo/config";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weixinread-flomo/status";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weixinread-flomo/test";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weixinread-flomo/sync";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weixinread-flomo/books";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weixinread-flomo/export";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
} | {
    kind: "exact";
    path: "/api/weixinread-flomo/flomo";
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
})[];
