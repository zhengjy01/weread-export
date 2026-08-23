/**
 * weixinread-flomo — 微信读书 (WeChat Reading) integration for DeepSeek Harness.
 * Host half.
 *
 * Mounts the weread tools (status / config / search / book / shelf / notes /
 * readdata / sync / flomo), the /api/weixinread-flomo route family the settings
 * panel talks to, and a system-prompt announcement. Data rides the official
 * WeRead Skills Agent Gateway (i.weread.qq.com/api/agent/gateway) with a
 * user-bound wrk- API key created at https://weread.qq.com/r/weread-skills.
 * The key lives in ~/.dsh/weixinread-flomo.json (mode 0600) and the sync snapshot
 * in ~/.dsh/weixinread-flomo-cache.json. Tools and routes build the API client
 * lazily from the store, so a key configured later takes effect immediately.
 */
import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
/** Stable cordis plugin name. */
export declare const name = "weread";
/** Services required before the weread surfaces can mount. */
export declare const inject: string[];
/** Model-facing announcement: plugin presence, capabilities, and limits. */
export declare const WEREAD_GUIDANCE: string;
/** Plugin config, read from the composition row. */
export interface Config {
    /** When true (default), a system-prompt section announces the plugin. */
    announceToAgent?: boolean;
    /** Master switch for the plugin (routes, tools, prompt section). */
    enabled?: boolean;
}
/**
 * Mount the weread tools, routes, and announcement.
 * @param ctx - host plugin context carrying tools/systemPrompt/webServer.
 * @param config - plugin config from the composition row.
 */
export declare function apply(ctx: Context, config?: Config): void;
/** Re-exports for host consumers and smoke tests. */
export { WereadStore, mask, configPath, cachePath, type WereadConfigView, type WereadCredentials } from './store.ts';
export { WereadApi, WereadApiError, WEREAD_GATEWAY, SKILL_VERSION, type BookInfo, type ShelfBook, type NotebookEntry, type Highlight, type MineReviewEntry } from './api.ts';
export { wereadStatusTool, wereadConfigTool, wereadSearchTool, wereadBookTool, wereadShelfTool, wereadNotesTool, wereadReaddataTool, wereadSyncTool, wereadFlomoTool, buildTools, type ToolContext } from './tools.ts';
export { doSync, readCache, writeCache, emptyCache, buildNotesMarkdown, buildFlomoMemo, formatDate, formatDuration, formatRating, dateLabel, deepLink, shelfLine, notebookLines, type WereadCache } from './cache.ts';
export { resolveFlomoUrl, flomoConfigured, postMemo, buildTaggedContent, FLOMO_CONFIG_FILE } from './flomo.ts';
export { makeRoutes, WEREAD_API } from './routes.ts';
export { defineTool };
