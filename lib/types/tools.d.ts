/**
 * weixinread-flomo — model-facing tools.
 *
 * Mounted via ctx.tools.register. Covers the WeRead surface: status,
 * config, search, book info, shelf, notes/highlights, reading stats,
 * cache sync, and flomo export. Every tool resolves to { ok, message, ... }
 * and never throws for API-level outcomes.
 */
import type { WereadStore } from './store.ts';
/** Shared tool dependencies. */
export interface ToolContext {
    store: WereadStore;
}
/** Status tool: configuration + cache + flomo linkage. */
export declare function wereadStatusTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Config tool: set/clear the API key, default flomo tag, and export limit. */
export declare function wereadConfigTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Search tool: book store search. */
export declare function wereadSearchTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Book tool: metadata + progress + chapter catalog summary. */
export declare function wereadBookTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Shelf tool: live bookshelf (optionally from cache). */
export declare function wereadShelfTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Notes tool: notebook overview or per-book highlights + thoughts. */
export declare function wereadNotesTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Readdata tool: reading statistics. */
export declare function wereadReaddataTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Sync tool: pull shelf + notebooks into the local cache. */
export declare function wereadSyncTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Flomo tool: export a book's highlights to flomo with a custom tag. */
export declare function wereadFlomoTool(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition;
/** Build every weread tool. */
export declare function buildTools(ctx: ToolContext): import("@deepseek-ai/dsh-tools").ToolDefinition[];
