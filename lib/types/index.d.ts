/**
 * weread-export — 微信读书 (WeChat Reading) integration for DeepSeek Harness.
 * Host half.
 *
 * Mounts the weread tools (status / config / search / book / shelf / notes /
 * readdata / sync / flomo), the /api/weread-export route family the settings
 * panel talks to, and a system-prompt announcement. Data rides the official
 * WeRead Skills Agent Gateway (i.weread.qq.com/api/agent/gateway) with a
 * user-bound wrk- API key created at https://weread.qq.com/r/weread-skills.
 * The key lives in ~/.dsh/weread-export.json (mode 0600) and the sync snapshot
 * in ~/.dsh/weread-export-cache.json. Tools and routes build the API client
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
export { WereadStore, mask, configPath, cachePath, DEFAULT_EXPORT_PROMPT, type WereadConfigView, type WereadCredentials, type ExportDest } from './store.ts';
export { WereadApi, WereadApiError, WEREAD_GATEWAY, SKILL_VERSION, type BookInfo, type ShelfBook, type NotebookEntry, type Highlight, type MineReviewEntry } from './api.ts';
export { wereadStatusTool, wereadConfigTool, wereadSearchTool, wereadBookTool, wereadShelfTool, wereadNotesTool, wereadReaddataTool, wereadSyncTool, wereadExportTool, wereadFlomoTool, runExport, buildTools, type ToolContext, type ExportRequest, type ExportResult } from './tools.ts';
export { doSync, readCache, writeCache, emptyCache, buildNotesMarkdown, buildFlomoMemo, buildFlomoMemos, FLOMO_MAX_CHARS, formatDate, formatDuration, formatRating, dateLabel, deepLink, shelfLine, notebookLines, type WereadCache } from './cache.ts';
export { resolveFlomoUrl, flomoConfigured, postMemo, buildTaggedContent, FLOMO_CONFIG_FILE } from './flomo.ts';
export { chatComplete, renderPrompt, llmConfigured, type LlmConfig } from './llm.ts';
export { buildExportMarkdown, processWithPrompt, exportToLocal, exportToNotion, exportToFlomo, chunkText, toNotionBlocks, normalizeNotionPageId, NOTION_API, NOTION_VERSION } from './export.ts';
export { makeRoutes, WEREAD_API } from './routes.ts';
export { defineTool };
